// Fetches both providers once and prints the result, without starting Electron.
const { fetchClaudeUsage } = require("../src/claude.cjs");
const { fetchCodexUsage } = require("../src/codex.cjs");

async function show(name, fetcher) {
  try {
    const usage = await fetcher();
    console.log(`${name}${usage.plan ? ` (${usage.plan})` : ""}`);
    for (const w of usage.windows) {
      const reset = w.resetsAt ? new Date(w.resetsAt).toLocaleString() : "unknown";
      console.log(`  ${w.label.padEnd(7)} ${String(Math.round(w.usedPercent)).padStart(3)}%  resets ${reset}`);
    }
  } catch (error) {
    console.log(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  await show("Claude", fetchClaudeUsage);
  await show("Codex", fetchCodexUsage);
})();
