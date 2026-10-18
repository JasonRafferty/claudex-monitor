const bridge = window.claudexMonitor;
let latest = null;

const els = {
  interval: document.getElementById("interval"),
  pin: document.getElementById("pin"),
  refresh: document.getElementById("refresh-now"),
  updated: document.getElementById("updated")
};

function formatInterval(seconds) {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function resetLabel(resetsAt, now) {
  if (!resetsAt) return "Reset time unavailable";
  const remaining = resetsAt - now;
  return remaining <= 0 ? "Resetting now" : `Resets in ${formatDuration(remaining)}`;
}

// Share of the window already elapsed; used to show whether usage is ahead of pace.
function elapsedPercent(window, now) {
  if (!window.resetsAt || !window.windowMins) return null;
  const start = window.resetsAt - window.windowMins * 60_000;
  return Math.max(0, Math.min(100, ((now - start) / (window.windowMins * 60_000)) * 100));
}

function level(percent) {
  if (percent >= 90) return "critical";
  if (percent >= 70) return "high";
  return "normal";
}

function renderProvider(id, source, now) {
  const section = document.getElementById(id);
  section.querySelector(".plan").textContent = source.plan ? source.plan : "";
  const status = section.querySelector(".status");
  status.textContent = source.status === "loading" ? "Loading…" : source.error ?? "";
  status.title = source.error ?? "";
  status.className = `status ${source.status}`;

  const rows = section.querySelector(".rows");
  rows.replaceChildren(...source.windows.map((window) => renderRow(window, now)));
}

function renderRow(window, now) {
  const percent = Math.max(0, Math.min(100, window.usedPercent));
  const elapsed = elapsedPercent(window, now);
  const row = document.createElement("div");
  row.className = `row ${level(percent)}`;

  const label = document.createElement("span");
  label.className = "row-label";
  label.textContent = window.label;

  const value = document.createElement("strong");
  value.className = "row-value";
  value.innerHTML = `${Math.round(window.usedPercent)}<small>%</small>`;

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", `${window.label} used`);
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(Math.round(percent)));
  const fill = document.createElement("span");
  fill.className = "fill";
  fill.style.width = `${percent}%`;
  bar.append(fill);
  if (elapsed !== null) {
    const marker = document.createElement("span");
    marker.className = "pace";
    marker.style.left = `${elapsed}%`;
    marker.title = `${Math.round(elapsed)}% of the window has passed`;
    bar.append(marker);
  }

  const reset = document.createElement("span");
  reset.className = "row-reset";
  reset.textContent = resetLabel(window.resetsAt, now);

  row.append(label, bar, value, reset);
  return row;
}

function render() {
  if (!latest) return;
  const now = Date.now();
  renderProvider("claude", latest.claude, now);
  renderProvider("codex", latest.codex, now);
  els.updated.textContent = latest.updatedAt
    ? `Updated ${new Date(latest.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Loading…";
}

function update(state) {
  latest = state;
  render();
}

function setPinned(enabled) {
  els.pin.classList.toggle("pinned", enabled);
  els.pin.setAttribute("aria-pressed", String(enabled));
  els.pin.title = enabled ? "Always on top" : "Keep on top";
}

async function init() {
  const settings = await bridge.getSettings();
  els.interval.replaceChildren(...settings.refreshOptions.map((seconds) => {
    const option = document.createElement("option");
    option.value = String(seconds);
    option.textContent = formatInterval(seconds);
    option.selected = seconds === settings.refreshSeconds;
    return option;
  }));
  setPinned(settings.alwaysOnTop);

  els.interval.addEventListener("change", async () => {
    const seconds = await bridge.setRefresh(Number(els.interval.value));
    els.interval.value = String(seconds);
  });
  els.pin.addEventListener("click", async () => {
    setPinned(await bridge.setAlwaysOnTop(!els.pin.classList.contains("pinned")));
  });
  els.refresh.addEventListener("click", async () => {
    els.refresh.classList.add("spinning");
    try {
      update(await bridge.refresh());
    } finally {
      els.refresh.classList.remove("spinning");
    }
  });

  bridge.onUpdate(update);
  bridge.onAlwaysOnTop(setPinned);
  update(await bridge.getState());
  setInterval(render, 30_000);
}

void init();
