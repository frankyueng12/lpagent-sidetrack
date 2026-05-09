import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotEnv(path = ".env", env = process.env) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) return;

  const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && env[key] === undefined) {
      env[key] = value;
    }
  }
}

export function readConfig(env = process.env) {
  loadDotEnv(".env", env);

  return {
    apiBase: env.LPAGENT_API_BASE || "https://api.lpagent.io/open-api/v1",
    apiKey: env.LPAGENT_API_KEY || "",
    allowTxGeneration: env.ALLOW_TX_GENERATION === "true",
    port: Number(env.PORT || 8080),
    host: env.HOST || "127.0.0.1",
    defaults: {
      binRange: Number(env.DEFAULT_BIN_RANGE || 34),
      slippageBps: Number(env.DEFAULT_SLIPPAGE_BPS || 500),
      strategy: env.DEFAULT_STRATEGY || "Spot",
    },
  };
}
