import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/server.js";

const config = {
  apiKey: "",
  allowTxGeneration: false,
  defaults: {
    binRange: 34,
    slippageBps: 500,
    strategy: "Spot",
  },
};

test("health route reports service state without binding a port", async () => {
  const response = await route(makeRequest("GET", "/health"), {}, config);

  assert.equal(response.ok, true);
  assert.equal(response.service, "lpagent-sidetrack");
  assert.equal(response.txGenerationEnabled, false);
});

test("rebalance plan route validates owner before calling LPAgent", async () => {
  const req = makeRequest("POST", "/api/rebalance/plan", { owner: "not-a-wallet" });

  await assert.rejects(() => route(req, {}, config), /owner must look like a Solana wallet address/);
});

function makeRequest(method, path, body) {
  const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
  return {
    method,
    url: path,
    headers: { host: "localhost" },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}
