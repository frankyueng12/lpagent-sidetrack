import { HttpError } from "./errors.js";

export class LpAgentClient {
  constructor({ apiBase, apiKey, fetchImpl = fetch }) {
    this.apiBase = apiBase.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async request(method, path, body = undefined, query = undefined) {
    if (!this.apiKey) {
      throw new HttpError(503, "LPAGENT_API_KEY is not configured");
    }

    const url = new URL(`${this.apiBase}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await this.fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? safeJson(text) : null;

    if (!response.ok) {
      throw new HttpError(response.status, `LPAgent ${method} ${path} failed`, data ?? text);
    }

    return data;
  }

  discoverPools(params) {
    return this.request("GET", "/pools/discover", undefined, params);
  }

  poolInfo(poolId) {
    return this.request("GET", `/pools/${encodeURIComponent(poolId)}/info`);
  }

  openingPositions(owner) {
    return this.request("GET", "/lp-positions/opening", undefined, { owner });
  }

  positionOverview(owner) {
    return this.request("GET", "/lp-positions/overview", undefined, { owner });
  }

  tokenBalances(owner) {
    return this.request("GET", "/token/balance", undefined, { owner });
  }

  decreaseQuotes(id, bps) {
    return this.request("POST", "/position/decrease-quotes", { id, bps });
  }

  generateZapIn(poolId, payload) {
    return this.request("POST", `/pools/${encodeURIComponent(poolId)}/add-tx`, payload);
  }

  generateZapOut(payload) {
    return this.request("POST", "/position/decrease-tx", payload);
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
