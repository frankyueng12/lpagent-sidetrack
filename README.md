# LPAgent Sidetrack: Safe Backend Integration

This is a backend-first LPAgent.io integration for the Superteam Earn API integration sidetrack. It gives wallets and agent runtimes a safe server-side way to inspect Meteora LP positions, discover pools, and generate dry-run rebalance plans without exposing an LPAgent API key or a wallet private key in frontend code.

## What It Does

- Proxies LPAgent Open API calls from a backend, keeping `x-api-key` server-side.
- Summarizes open LP positions by value, range status, PnL, and uncollected fees.
- Builds dry-run rebalance plans for out-of-range positions.
- Previews zap-in payloads by reading a pool's active bin and deriving the target bin range.
- Keeps unsigned transaction generation behind `ALLOW_TX_GENERATION=true`.

## Why This Is Useful

LPAgent already exposes powerful primitives for pool discovery, zap-in, zap-out, and position analytics. The missing integration layer for many agents is a guarded backend that can:

1. Decide what should happen.
2. Show a human-readable plan.
3. Avoid leaking API keys or signing material.
4. Only generate unsigned transactions when an operator explicitly enables it.

This repo focuses on that layer.

## Quick Start

```bash
cp .env.example .env
# edit .env and add LPAGENT_API_KEY
npm test
npm start
```

The server listens on `http://127.0.0.1:8080` by default.

## Demo Without an API Key

```bash
npm run demo
```

This prints a portfolio summary and dry-run rebalance plan from fixture data.

## API

### `GET /health`

Returns service status and whether the LPAgent API key is configured.

### `GET /api/pools/discover`

Discovers candidate pools through LPAgent.

Example:

```bash
curl "http://127.0.0.1:8080/api/pools/discover?pageSize=5&sortBy=vol_24h&sortOrder=desc"
```

### `GET /api/wallet/:owner/positions`

Fetches LPAgent open positions and returns a normalized portfolio summary.

### `GET /api/wallet/:owner/overview`

Pass-through endpoint for LPAgent overview metrics.

### `POST /api/rebalance/plan`

Creates a dry-run rebalance plan from current open positions.

```bash
curl -X POST "http://127.0.0.1:8080/api/rebalance/plan" \
  -H "content-type: application/json" \
  -d '{
    "owner": "7KHx2Uc5qsqz652eXbu8Qtabi5KLxWJLgxFzcaBzP32i",
    "minValueUsd": 25,
    "binRange": 34,
    "strategy": "Spot",
    "slippageBps": 500
  }'
```

### `POST /api/zap-in/preview`

Reads pool info from LPAgent, derives an active-bin-centered range, and returns the exact `add-tx` payload.

```bash
curl -X POST "http://127.0.0.1:8080/api/zap-in/preview" \
  -H "content-type: application/json" \
  -d '{
    "poolId": "POOL_ADDRESS",
    "owner": "OWNER_WALLET",
    "inputSOL": 0.1,
    "binRange": 34,
    "strategy": "Spot"
  }'
```

Set `"generateTx": true` only after setting `ALLOW_TX_GENERATION=true`.

### `POST /api/zap-out/quote`

Returns LPAgent decrease quotes for a position and withdrawal bps.

## Safety Model

- API key is read from `LPAGENT_API_KEY`; it is never accepted from user input.
- No private key handling is implemented in this server.
- Transaction generation is disabled unless `ALLOW_TX_GENERATION=true`.
- Landing signed transactions is intentionally not implemented here; a wallet or operator should review and sign separately.

## LPAgent Endpoints Used

- `GET /pools/discover`
- `GET /pools/{poolId}/info`
- `GET /lp-positions/opening`
- `GET /lp-positions/overview`
- `POST /position/decrease-quotes`
- Optional, gated: `POST /pools/{poolId}/add-tx`

## Submission Notes

This implementation is meant to be easy to evaluate:

- `npm test` verifies the planning logic.
- `npm run demo` shows the full dry-run output without secrets.
- With an LPAgent API key, the same routes call the production LPAgent Open API.
