const test = require("node:test");
const assert = require("node:assert/strict");
const { parseClaudeUsage } = require("../src/claude.cjs");
const { parseCodexUsage } = require("../src/codex.cjs");

test("parses Claude five-hour and weekly windows", () => {
  const usage = parseClaudeUsage({
    five_hour: { utilization: 24, resets_at: "2026-10-19T02:09:59.522938+00:00" },
    seven_day: { utilization: 7, resets_at: "2026-10-19T12:59:59.522961+00:00" }
  }, "max");
  assert.equal(usage.status, "ok");
  assert.equal(usage.plan, "max");
  assert.deepEqual(usage.windows.map((w) => [w.id, w.usedPercent, w.windowMins]), [
    ["session", 24, 300],
    ["weekly", 7, 10080]
  ]);
  assert.equal(usage.windows[0].resetsAt, Date.parse("2026-10-19T02:09:59.522Z"));
});

test("reports an error when Claude returns no windows", () => {
  const usage = parseClaudeUsage({ five_hour: null, seven_day: null });
  assert.equal(usage.status, "error");
  assert.equal(usage.windows.length, 0);
});

test("parses Codex primary and secondary windows", () => {
  const usage = parseCodexUsage({
    rateLimitsByLimitId: {
      codex: {
        planType: "plus",
        primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 1792371782 },
        secondary: { usedPercent: 5, windowDurationMins: 10080, resetsAt: 1792874918 }
      }
    }
  });
  assert.equal(usage.status, "ok");
  assert.equal(usage.plan, "plus");
  assert.deepEqual(usage.windows.map((w) => [w.id, w.label, w.usedPercent]), [
    ["session", "5-hour", 20],
    ["weekly", "Weekly", 5]
  ]);
  assert.equal(usage.windows[1].resetsAt, 1792874918000);
});

test("falls back to top-level Codex rateLimits", () => {
  const usage = parseCodexUsage({
    rateLimits: { primary: { usedPercent: 50, windowDurationMins: 300, resetsAt: 1 } }
  });
  assert.equal(usage.windows.length, 1);
  assert.equal(usage.windows[0].id, "session");
});

test("reports an error when Codex returns nothing", () => {
  assert.equal(parseCodexUsage({}).status, "error");
});
