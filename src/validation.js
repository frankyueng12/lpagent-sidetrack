import { HttpError } from "./errors.js";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const STRATEGIES = new Set(["Spot", "Curve", "BidAsk"]);
const OUTPUTS = new Set(["allToken0", "allToken1", "both", "allBaseToken"]);

export function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${name} is required`);
  }
  return value.trim();
}

export function requireSolanaAddress(value, name = "owner") {
  const address = requireString(value, name);
  if (!SOLANA_ADDRESS_RE.test(address)) {
    throw new HttpError(400, `${name} must look like a Solana wallet address`);
  }
  return address;
}

export function numberInRange(value, name, min, max, fallback = undefined) {
  const raw = value ?? fallback;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new HttpError(400, `${name} must be a number from ${min} to ${max}`);
  }
  return numeric;
}

export function integerInRange(value, name, min, max, fallback = undefined) {
  const numeric = numberInRange(value, name, min, max, fallback);
  if (!Number.isInteger(numeric)) {
    throw new HttpError(400, `${name} must be an integer`);
  }
  return numeric;
}

export function strategy(value, fallback = "Spot") {
  const selected = value ?? fallback;
  if (!STRATEGIES.has(selected)) {
    throw new HttpError(400, "strategy must be Spot, Curve, or BidAsk");
  }
  return selected;
}

export function zapOutOutput(value, fallback = "allBaseToken") {
  const selected = value ?? fallback;
  if (!OUTPUTS.has(selected)) {
    throw new HttpError(400, "output must be allToken0, allToken1, both, or allBaseToken");
  }
  return selected;
}
