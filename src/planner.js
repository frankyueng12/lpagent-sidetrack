export function summarizePositions(positions) {
  const rows = positions.map(normalizePosition);
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalValueUsd += row.valueUsd;
      acc.totalUncollectedFeesUsd += row.uncollectedFeesUsd;
      if (row.inRange) acc.inRange += 1;
      else acc.outOfRange += 1;
      return acc;
    },
    { totalValueUsd: 0, totalUncollectedFeesUsd: 0, inRange: 0, outOfRange: 0 },
  );

  return {
    count: rows.length,
    ...roundTotals(totals),
    positions: rows,
  };
}

export function buildRebalancePlan(positions, options = {}) {
  const {
    minValueUsd = 25,
    maxNegativePnlPercent = -25,
    binRange = 34,
    slippageBps = 500,
    strategy = "Spot",
    output = "allBaseToken",
    reserveSol = 0.05,
    poolAllowlist = [],
  } = options;

  const allowlist = new Set(poolAllowlist.filter(Boolean));
  const candidates = positions.map(normalizePosition);

  const actions = candidates.map((position) => {
    if (allowlist.size > 0 && !allowlist.has(position.pool)) {
      return skipped(position, "pool_not_allowlisted");
    }
    if (position.inRange) {
      return skipped(position, "position_in_range");
    }
    if (position.valueUsd < minValueUsd) {
      return skipped(position, "below_min_value");
    }
    if (position.pnlPercent <= maxNegativePnlPercent) {
      return {
        type: "exit_only",
        position,
        reason: "stop_loss",
        zapOut: {
          position_id: position.id,
          bps: 10000,
          owner: position.owner,
          slippage_bps: slippageBps,
          output,
          provider: "JUPITER_ULTRA",
        },
      };
    }

    return {
      type: "rebalance",
      position,
      reason: "out_of_range",
      reserveSol,
      nextRange: {
        source: "pool active bin",
        binRange,
      },
      zapOut: {
        position_id: position.id,
        bps: 10000,
        owner: position.owner,
        slippage_bps: slippageBps,
        output,
        provider: "JUPITER_ULTRA",
      },
      zapInTemplate: {
        poolId: position.pool,
        stratergy: strategy,
        percentX: 0.5,
        owner: position.owner,
        slippage_bps: slippageBps,
        mode: "zap-in",
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    settings: {
      minValueUsd,
      maxNegativePnlPercent,
      binRange,
      slippageBps,
      strategy,
      output,
      reserveSol,
      poolAllowlist,
    },
    summary: {
      total: actions.length,
      rebalance: actions.filter((a) => a.type === "rebalance").length,
      exitOnly: actions.filter((a) => a.type === "exit_only").length,
      skipped: actions.filter((a) => a.type === "skip").length,
    },
    actions,
  };
}

export function buildZapInPreview(poolInfo, request) {
  const activeBin = poolInfo?.data?.liquidityViz?.activeBin;
  if (!activeBin || !Number.isFinite(Number(activeBin.binId))) {
    return {
      ok: false,
      error: "Pool info did not include liquidityViz.activeBin.binId",
    };
  }

  const binId = Number(activeBin.binId);
  const fromBinId = binId - request.binRange;
  const toBinId = binId + request.binRange;

  return {
    ok: true,
    poolId: request.poolId,
    activeBin: binId,
    range: {
      fromBinId,
      toBinId,
      width: request.binRange * 2 + 1,
    },
    addTxPayload: {
      stratergy: request.strategy,
      inputSOL: request.inputSOL,
      percentX: request.percentX,
      fromBinId,
      toBinId,
      owner: request.owner,
      slippage_bps: request.slippageBps,
      mode: "zap-in",
      provider: "JUPITER_ULTRA",
    },
  };
}

function normalizePosition(position) {
  const valueUsd = numeric(position.currentValue ?? position.value);
  const pnlPercent = numeric(position.pnl?.percent ?? position.pnlPercent);
  const uncollectedFeesUsd = numeric(position.unCollectedFee ?? position.uncollectedFee);

  return {
    id: position.id,
    tokenId: position.tokenId ?? position.position,
    owner: position.owner,
    pool: position.pool,
    pairName: position.pairName ?? tokenPair(position),
    protocol: position.protocol,
    inRange: Boolean(position.inRange),
    valueUsd,
    pnlPercent,
    uncollectedFeesUsd,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    range: position.range,
    ageHours: numeric(position.ageHour ?? position.age),
  };
}

function skipped(position, reason) {
  return {
    type: "skip",
    position,
    reason,
  };
}

function tokenPair(position) {
  const token0 = position.tokenName0 ?? position.token0Info?.token_symbol ?? "token0";
  const token1 = position.tokenName1 ?? position.token1Info?.token_symbol ?? "token1";
  return `${token0}/${token1}`;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTotals(totals) {
  return {
    ...totals,
    totalValueUsd: round(totals.totalValueUsd),
    totalUncollectedFeesUsd: round(totals.totalUncollectedFeesUsd),
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
