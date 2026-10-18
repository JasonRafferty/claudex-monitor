const { spawn } = require("node:child_process");
const readline = require("node:readline");

const TIMEOUT_MS = 20_000;

function codexCommand(env = process.env) {
  return env.TANDEM_CODEX_PATH || env.CODEX_BIN || "codex";
}

function parseCodexUsage(result) {
  const limit = result?.rateLimitsByLimitId?.codex ?? result?.rateLimits;
  const windows = [limit?.primary, limit?.secondary]
    .filter((entry) => entry && typeof entry.usedPercent === "number")
    .map((entry) => {
      const weekly = entry.windowDurationMins === 10080;
      return {
        id: weekly ? "weekly" : "session",
        label: weekly ? "Weekly" : windowLabel(entry.windowDurationMins),
        usedPercent: entry.usedPercent,
        resetsAt: typeof entry.resetsAt === "number" ? entry.resetsAt * 1000 : null,
        windowMins: entry.windowDurationMins ?? null
      };
    })
    .sort((a, b) => (a.windowMins ?? 0) - (b.windowMins ?? 0));
  if (windows.length === 0) {
    return { status: "error", plan: null, windows, error: "Codex did not return rate limit data." };
  }
  return { status: "ok", plan: limit?.planType ?? null, windows, error: null };
}

function windowLabel(mins) {
  if (!mins) return "Session";
  return mins % 1440 === 0 ? `${mins / 1440}-day` : `${Math.round(mins / 60)}-hour`;
}

// Starts a short-lived `codex app-server`, asks for rate limits over JSON-RPC, then exits.
function fetchCodexUsage(command = codexCommand()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["app-server"], {
      stdio: ["pipe", "pipe", "ignore"],
      shell: process.platform === "win32"
    });
    const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lines.close();
      child.kill();
      if (error) reject(error);
      else resolve(value);
    };
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const timer = setTimeout(() => finish(new Error("Codex did not respond in time.")), TIMEOUT_MS);

    child.on("error", (error) => {
      finish(new Error(error.code === "ENOENT" ? "Codex CLI not found on PATH." : error.message));
    });
    child.on("close", () => finish(new Error("Codex app-server exited before replying.")));
    child.stdin.on("error", () => {});

    lines.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.error) {
        finish(new Error(message.error.message || "Codex returned an error."));
      } else if (message.id === 1) {
        send({ method: "initialized" });
        send({ id: 2, method: "account/rateLimits/read" });
      } else if (message.id === 2) {
        finish(null, parseCodexUsage(message.result));
      }
    });

    send({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: { name: "tandem", title: "Tandem", version: "0.1.0" },
        capabilities: { experimentalApi: true }
      }
    });
  });
}

module.exports = { fetchCodexUsage, parseCodexUsage };
