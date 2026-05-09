import { buildRebalancePlan, summarizePositions } from "../src/planner.js";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("../test/fixtures/opening-positions.json", import.meta.url), "utf8"));

const positions = fixture.data;
console.log("Portfolio summary");
console.log(JSON.stringify(summarizePositions(positions), null, 2));

console.log("\nDry-run rebalance plan");
console.log(
  JSON.stringify(
    buildRebalancePlan(positions, {
      minValueUsd: 25,
      binRange: 34,
      strategy: "Spot",
      slippageBps: 500,
    }),
    null,
    2,
  ),
);
