import fs from "node:fs";
import path from "node:path";

export function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const split = line.indexOf("=");
    if (split < 1) continue;
    values[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return values;
}

export function loadConfig(root = process.env.CASHCLAW_CONFIG_ROOT || process.cwd()) {
  const file = path.join(root, ".env");
  const env = { ...parseEnv(fs.readFileSync(file, "utf8")), ...process.env };
  const required = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "TELEGRAM_BOT_TOKEN"];
  const missing = required.filter((key) => !env[key] || env[key].startsWith("PASTE_"));
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);
  return {
    app: {
      host: env.APP_HOST || "127.0.0.1",
      port: Number(env.APP_PORT || 3777),
    },
    llm: {
      baseUrl: env.LLM_BASE_URL.replace(/\/$/, ""),
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      maxTokens: Number(env.LLM_MAX_OUTPUT_TOKENS || 1200),
      dailyLimit: Number(env.LLM_DAILY_REQUEST_LIMIT || 30),
    },
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN,
      allowedUsers: new Set((env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").filter(Boolean)),
      allowedChats: new Set((env.TELEGRAM_ALLOWED_CHAT_IDS || "").split(",").filter(Boolean)),
    },
    github: { token: env.GITHUB_TOKEN || "" },
    acquisition: {
      allowPaidProposals: env.ALLOW_PAID_PROPOSALS === "true",
      maxPaidProposalCost: Math.max(0, Number(env.MAX_PAID_PROPOSAL_COST || 0)),
      autoClaimBounty: false,
      minimumExpectedNetProfit: Math.max(0, Number(env.MINIMUM_EXPECTED_NET_PROFIT || 5)),
      minimumExpectedProfitPerAgentHour: Math.max(0, Number(env.MINIMUM_EXPECTED_PROFIT_PER_AGENT_HOUR || 3)),
      minimumRewardTrustScore: Math.max(0, Math.min(100, Number(env.MINIMUM_REWARD_TRUST_SCORE || 55))),
      maximumTechnicalRisk: Math.max(0, Math.min(100, Number(env.MAXIMUM_TECHNICAL_RISK || 65))),
      maximumPaymentRisk: Math.max(0, Math.min(100, Number(env.MAXIMUM_PAYMENT_RISK || 65))),
    },
    pollMinutes: Math.max(15, Number(env.SOURCE_POLL_MINUTES || 30)),
    schedule: {
      start: env.ACTIVE_HOURS_START || "09:00",
      end: env.ACTIVE_HOURS_END || "23:00",
      timeZone: env.ACTIVE_TIMEZONE || "Asia/Yekaterinburg",
    },
    source: {
      maxLlmPerCycle: Math.max(1, Number(env.SOURCE_MAX_LLM_PER_CYCLE || 5)),
      maxCheapPerCycle: Math.max(1, Number(env.SOURCE_MAX_CHEAP_LLM_PER_CYCLE || 40)),
      maxDeepPerCycle: Math.max(1, Number(env.SOURCE_MAX_DEEP_LLM_PER_CYCLE || env.SOURCE_MAX_LLM_PER_CYCLE || 12)),
      minKeywordMatches: Math.max(1, Number(env.SOURCE_MIN_KEYWORD_MATCHES || 2)),
      minBudgetRub: Math.max(0, Number(env.SOURCE_MIN_BUDGET_RUB || 0)),
      skillKeywords: (env.SKILL_KEYWORDS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
      excludeKeywords: (env.SOURCE_EXCLUDE_KEYWORDS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
      playwrightCorePath: env.PLAYWRIGHT_CORE_PATH,
      playwrightExecutablePath: env.PLAYWRIGHT_EXECUTABLE_PATH,
    },
    notifications: {
      hot: Math.max(0, Math.min(100, Number(env.NOTIFICATION_HOT_SCORE || 70))),
      good: Math.max(0, Math.min(100, Number(env.NOTIFICATION_GOOD_SCORE || 55))),
      maybe: Math.max(0, Math.min(100, Number(env.NOTIFICATION_MAYBE_SCORE || 45))),
      outboxMaxAttempts: Math.max(1, Number(env.NOTIFICATION_MAX_ATTEMPTS || 5)),
    },
  };
}
