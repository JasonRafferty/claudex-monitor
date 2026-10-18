const { readFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

function credentialsPath(env = process.env) {
  const configDir = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(configDir, ".credentials.json");
}

// Claude Code refreshes its own OAuth token, so the file is re-read on every poll.
async function readAccessToken(file = credentialsPath()) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error("Claude Code login not found. Run claude and sign in.");
  }
  const oauth = JSON.parse(raw).claudeAiOauth;
  if (!oauth?.accessToken) throw new Error("Claude Code login has no access token.");
  return { token: oauth.accessToken, plan: oauth.subscriptionType ?? null };
}

function parseClaudeUsage(body, plan = null) {
  const windows = [
    toWindow("session", "5-hour", body?.five_hour, 300),
    toWindow("weekly", "Weekly", body?.seven_day, 10080)
  ].filter(Boolean);
  if (windows.length === 0) {
    return { status: "error", plan, windows, error: "Claude did not return usage data." };
  }
  return { status: "ok", plan, windows, error: null };
}

function toWindow(id, label, entry, windowMins) {
  if (!entry || typeof entry.utilization !== "number") return null;
  const resetsAt = Date.parse(entry.resets_at ?? "");
  return {
    id,
    label,
    usedPercent: entry.utilization,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
    windowMins
  };
}

async function fetchClaudeUsage() {
  const { token, plan } = await readAccessToken();
  const response = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20"
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 401) {
    throw new Error("Claude login expired. Open Claude Code to refresh it.");
  }
  if (!response.ok) throw new Error(`Claude usage request failed (${response.status}).`);
  return parseClaudeUsage(await response.json(), plan);
}

module.exports = { fetchClaudeUsage, parseClaudeUsage, credentialsPath };
