import http from "node:http";
import { readConfig } from "./config.js";
import { HttpError, toErrorResponse } from "./errors.js";
import { LpAgentClient } from "./lpagent-client.js";
import { buildRebalancePlan, buildZapInPreview, summarizePositions } from "./planner.js";
import {
  integerInRange,
  numberInRange,
  requireSolanaAddress,
  requireString,
  strategy,
  zapOutOutput,
} from "./validation.js";

const config = readConfig();
const client = new LpAgentClient(config);

const server = http.createServer(async (req, res) => {
  try {
    const result = await route(req, client, config);
    sendJson(res, result.status ?? 200, result.body ?? result);
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.status, response.body);
  }
});

async function route(req, lpAgent = client, appConfig = config) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return {
      ok: true,
      service: "lpagent-sidetrack",
      lpagentApiConfigured: Boolean(appConfig.apiKey),
      txGenerationEnabled: appConfig.allowTxGeneration,
    };
  }

  if (req.method === "GET" && url.pathname === "/api/pools/discover") {
    const params = {
      chain: url.searchParams.get("chain") || "SOL",
      sortBy: url.searchParams.get("sortBy") || "vol_24h",
      sortOrder: url.searchParams.get("sortOrder") || "desc",
      pageSize: integerInRange(url.searchParams.get("pageSize") || 10, "pageSize", 1, 50),
      page: integerInRange(url.searchParams.get("page") || 1, "page", 1, 500),
      min_market_cap: url.searchParams.get("min_market_cap"),
      min_liquidity: url.searchParams.get("min_liquidity"),
    };
    return { ok: true, source: "LPAgent", data: await lpAgent.discoverPools(params) };
  }

  const positionMatch = url.pathname.match(/^\/api\/wallet\/([^/]+)\/positions$/);
  if (req.method === "GET" && positionMatch) {
    const owner = requireSolanaAddress(positionMatch[1]);
    const positions = await lpAgent.openingPositions(owner);
    return {
      ok: true,
      source: "LPAgent",
      summary: summarizePositions(positions.data ?? []),
      rawCount: positions.count ?? positions.data?.length ?? 0,
    };
  }

  const overviewMatch = url.pathname.match(/^\/api\/wallet\/([^/]+)\/overview$/);
  if (req.method === "GET" && overviewMatch) {
    const owner = requireSolanaAddress(overviewMatch[1]);
    return { ok: true, source: "LPAgent", data: await lpAgent.positionOverview(owner) };
  }

  if (req.method === "POST" && url.pathname === "/api/rebalance/plan") {
    const body = await readJson(req);
    const owner = requireSolanaAddress(body.owner);
    const positions = await lpAgent.openingPositions(owner);
    const plan = buildRebalancePlan(positions.data ?? [], {
      minValueUsd: numberInRange(body.minValueUsd, "minValueUsd", 0, 1_000_000, 25),
      maxNegativePnlPercent: numberInRange(
        body.maxNegativePnlPercent,
        "maxNegativePnlPercent",
        -100,
        0,
        -25,
      ),
      binRange: integerInRange(body.binRange, "binRange", 1, 500, appConfig.defaults.binRange),
      slippageBps: integerInRange(
        body.slippageBps,
        "slippageBps",
        0,
        10000,
        appConfig.defaults.slippageBps,
      ),
      strategy: strategy(body.strategy, appConfig.defaults.strategy),
      output: zapOutOutput(body.output, "allBaseToken"),
      reserveSol: numberInRange(body.reserveSol, "reserveSol", 0, 10, 0.05),
      poolAllowlist: Array.isArray(body.poolAllowlist) ? body.poolAllowlist : [],
    });

    return { ok: true, source: "LPAgent", plan };
  }

  if (req.method === "POST" && url.pathname === "/api/zap-in/preview") {
    const body = await readJson(req);
    const request = {
      poolId: requireString(body.poolId, "poolId"),
      owner: requireSolanaAddress(body.owner),
      inputSOL: numberInRange(body.inputSOL, "inputSOL", 0.001, 10_000),
      percentX: numberInRange(body.percentX, "percentX", 0, 1, 0.5),
      binRange: integerInRange(body.binRange, "binRange", 1, 500, appConfig.defaults.binRange),
      slippageBps: integerInRange(
        body.slippageBps,
        "slippageBps",
        0,
        10000,
        appConfig.defaults.slippageBps,
      ),
      strategy: strategy(body.strategy, appConfig.defaults.strategy),
    };

    const poolInfo = await lpAgent.poolInfo(request.poolId);
    const preview = buildZapInPreview(poolInfo, request);
    if (!preview.ok) {
      throw new HttpError(502, preview.error);
    }

    if (!body.generateTx) {
      return { ok: true, source: "LPAgent", preview };
    }
    if (!appConfig.allowTxGeneration) {
      throw new HttpError(403, "Set ALLOW_TX_GENERATION=true to generate unsigned zap-in transactions");
    }

    return {
      ok: true,
      source: "LPAgent",
      preview,
      unsignedTransactions: await lpAgent.generateZapIn(request.poolId, preview.addTxPayload),
    };
  }

  if (req.method === "POST" && url.pathname === "/api/zap-out/quote") {
    const body = await readJson(req);
    const id = requireString(body.positionId, "positionId");
    const bps = integerInRange(body.bps, "bps", 1, 10000, 10000);
    return { ok: true, source: "LPAgent", data: await lpAgent.decreaseQuotes(id, bps) };
  }

  throw new HttpError(404, "Route not found");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  server.listen(config.port, config.host, () => {
    console.log(`lpagent-sidetrack listening on http://${config.host}:${config.port}`);
  });
}

export { route, server };
