# Superteam Earn Submission: LPAgent API Integration Sidetrack

## Project

LPAgent Safe Backend Integration

## Summary

I built a backend integration layer for LPAgent.io that lets agent apps and dashboards safely discover Meteora pools, inspect open LP positions, generate dry-run rebalance plans, and preview zap-in payloads without exposing LPAgent API keys or wallet private keys in frontend code.

## What To Review

- `src/lpagent-client.js`: minimal LPAgent Open API client using server-side `x-api-key` auth.
- `src/planner.js`: portfolio summary, out-of-range detection, stop-loss handling, and dry-run rebalance planning.
- `src/server.js`: HTTP API exposing health, pool discovery, wallet positions, rebalance plans, zap-in previews, and zap-out quotes.
- `test/planner.test.js`: unit tests for the core decision logic.

## Why It Matters

LPAgent already provides strong zap-in, zap-out, position, and pool APIs. This project adds the safe application layer that external agents need before using those primitives in production:

- Backend-only API key handling.
- Human-readable plans before transaction generation.
- Explicit transaction-generation guard.
- No private key or signing logic in the server.

## How To Run

```bash
cp .env.example .env
npm test
npm run demo
npm start
```

For live LPAgent calls, add `LPAGENT_API_KEY` to `.env`.

## Demo Commands

```bash
curl http://127.0.0.1:8080/health
curl "http://127.0.0.1:8080/api/pools/discover?pageSize=5&sortBy=vol_24h&sortOrder=desc"
curl -X POST "http://127.0.0.1:8080/api/rebalance/plan" \
  -H "content-type: application/json" \
  -d '{"owner":"7KHx2Uc5qsqz652eXbu8Qtabi5KLxWJLgxFzcaBzP32i","minValueUsd":25,"binRange":34,"strategy":"Spot"}'
```

## Live API Coverage

- Pool discovery
- Pool info / active bin lookup
- Open position analytics
- Overview metrics
- Rebalance plan generation
- Zap-in payload preview
- Zap-out quote retrieval

## Safety

The server does not accept API keys or private keys from clients, does not sign transactions, and does not land transactions. Unsigned transaction generation is behind `ALLOW_TX_GENERATION=true` so reviewers can inspect the exact payload before enabling it.
