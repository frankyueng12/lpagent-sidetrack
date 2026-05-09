# Demo Walkthrough

This project can be reviewed without an LPAgent API key by running the fixture-backed demo.

```bash
npm test
npm run demo
```

`npm run demo` prints:

- A normalized LP portfolio summary.
- In-range and out-of-range position counts.
- Total value and uncollected fees.
- A dry-run rebalance plan.
- A full zap-out payload for positions that should be rebalanced or exited.
- A zap-in template that uses LPAgent's `stratergy`, owner, slippage, and `zap-in` mode.

For live LPAgent calls:

```bash
cp .env.example .env
# add LPAGENT_API_KEY
npm start
```

Then review:

```bash
curl http://127.0.0.1:8080/health
curl "http://127.0.0.1:8080/api/pools/discover?pageSize=5&sortBy=vol_24h&sortOrder=desc"
curl -X POST "http://127.0.0.1:8080/api/rebalance/plan" \
  -H "content-type: application/json" \
  -d '{"owner":"7KHx2Uc5qsqz652eXbu8Qtabi5KLxWJLgxFzcaBzP32i","minValueUsd":25,"binRange":34,"strategy":"Spot"}'
```

The safety model is intentionally conservative: the server keeps the LPAgent API key on the backend, never accepts private keys, never signs transactions, and only generates unsigned zap-in transactions when `ALLOW_TX_GENERATION=true`.
