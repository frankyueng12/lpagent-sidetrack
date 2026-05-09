import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRebalancePlan, buildZapInPreview, summarizePositions } from "../src/planner.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/opening-positions.json", import.meta.url), "utf8"));

test("summarizePositions totals portfolio state", () => {
  const summary = summarizePositions(fixture.data);

  assert.equal(summary.count, 3);
  assert.equal(summary.inRange, 1);
  assert.equal(summary.outOfRange, 2);
  assert.equal(summary.totalValueUsd, 1628.76);
  assert.equal(summary.totalUncollectedFeesUsd, 9.47);
});

test("buildRebalancePlan skips healthy positions and plans out-of-range actions", () => {
  const plan = buildRebalancePlan(fixture.data, {
    minValueUsd: 25,
    maxNegativePnlPercent: -25,
    binRange: 34,
    slippageBps: 500,
    strategy: "Spot",
  });

  assert.equal(plan.summary.total, 3);
  assert.equal(plan.summary.skipped, 1);
  assert.equal(plan.summary.rebalance, 1);
  assert.equal(plan.summary.exitOnly, 1);

  const rebalance = plan.actions.find((action) => action.type === "rebalance");
  assert.equal(rebalance.zapOut.output, "allBaseToken");
  assert.equal(rebalance.zapInTemplate.stratergy, "Spot");
  assert.equal(rebalance.nextRange.binRange, 34);

  const exitOnly = plan.actions.find((action) => action.type === "exit_only");
  assert.equal(exitOnly.reason, "stop_loss");
});

test("buildZapInPreview derives range around active bin", () => {
  const preview = buildZapInPreview(
    { data: { liquidityViz: { activeBin: { binId: 1234 } } } },
    {
      poolId: "pool",
      owner: "owner",
      inputSOL: 0.1,
      percentX: 0.5,
      binRange: 20,
      strategy: "Curve",
      slippageBps: 300,
    },
  );

  assert.equal(preview.ok, true);
  assert.equal(preview.range.fromBinId, 1214);
  assert.equal(preview.range.toBinId, 1254);
  assert.equal(preview.addTxPayload.stratergy, "Curve");
});
