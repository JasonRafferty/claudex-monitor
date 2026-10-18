const bridge = window.claudexMonitor;
let latest = null;

const els = {
  led: document.getElementById("led"),
  pin: document.getElementById("pin"),
  compact: document.getElementById("compact"),
  deck: document.getElementById("deck"),
  refresh: document.getElementById("refresh-now"),
  interval: document.getElementById("interval"),
  intervalValue: document.getElementById("interval-value"),
  intervalList: document.getElementById("interval-list")
};

function formatInterval(seconds) {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;
}

function intervalName(seconds) {
  return seconds < 60 ? `Every ${seconds} seconds` : seconds === 60 ? "Every minute" : `Every ${seconds / 60} minutes`;
}

// ---------- Refresh interval dropdown ----------

function showInterval(seconds) {
  els.intervalValue.textContent = formatInterval(seconds);
  for (const option of els.intervalList.children) {
    option.setAttribute("aria-selected", String(Number(option.dataset.seconds) === seconds));
  }
}

function setDropdownOpen(open) {
  els.intervalList.hidden = !open;
  fitWindow();
  els.interval.setAttribute("aria-expanded", String(open));
  if (open) (els.intervalList.querySelector('[aria-selected="true"]') ?? els.intervalList.firstElementChild).focus();
}

function buildIntervalList(options) {
  els.intervalList.replaceChildren(...options.map((seconds) => {
    const option = document.createElement("li");
    option.role = "option";
    option.tabIndex = -1;
    option.dataset.seconds = String(seconds);
    option.textContent = intervalName(seconds);
    return option;
  }));

  els.interval.addEventListener("click", () => setDropdownOpen(els.intervalList.hidden));
  els.intervalList.addEventListener("click", async (event) => {
    const option = event.target.closest("li");
    if (!option) return;
    setDropdownOpen(false);
    showInterval(await bridge.setRefresh(Number(option.dataset.seconds)));
    els.interval.focus();
  });
  els.intervalList.addEventListener("keydown", (event) => {
    const items = [...els.intervalList.children];
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.activeElement.click();
    } else if (event.key === "Escape") {
      setDropdownOpen(false);
      els.interval.focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".picker")) setDropdownOpen(false);
  });
  window.addEventListener("blur", () => setDropdownOpen(false));
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
  if (!resetsAt) return "";
  const remaining = resetsAt - now;
  return remaining <= 0 ? "resetting now" : `resets in ${formatDuration(remaining)}`;
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
  status.textContent = source.error ?? "";
  status.title = source.error ?? "";

  const rows = section.querySelector(".rows");
  rows.replaceChildren(...source.windows.map((window) => renderRow(window, now)));
}

function renderRow(window, now) {
  const percent = Math.max(0, Math.min(100, window.usedPercent));
  const elapsed = elapsedPercent(window, now);
  const row = document.createElement("div");
  row.className = `row ${level(percent)}`;
  row.dataset.window = window.id;

  const label = document.createElement("span");
  label.className = "row-label";
  label.textContent = window.label;

  const reset = document.createElement("span");
  reset.className = "row-reset";
  reset.textContent = resetLabel(window.resetsAt, now);

  const value = document.createElement("span");
  value.className = "row-value";
  value.innerHTML = `${Math.round(window.usedPercent)}<small>%</small>`;

  const meter = document.createElement("div");
  meter.className = "meter";
  meter.setAttribute("role", "progressbar");
  meter.setAttribute("aria-label", `${window.label} used`);
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.setAttribute("aria-valuenow", String(Math.round(percent)));
  const fill = document.createElement("span");
  fill.className = "fill";
  fill.style.width = `${percent}%`;
  meter.append(fill);
  if (elapsed !== null) {
    const marker = document.createElement("span");
    marker.className = "pace";
    marker.style.left = `${elapsed}%`;
    marker.title = `${Math.round(elapsed)}% of the window has passed`;
    meter.append(marker);
  }

  row.append(label, reset, value, meter);
  return row;
}

// The LED sums up both providers: green when fresh, amber when showing old figures, red when empty.
function renderLed() {
  const statuses = [latest.claude.status, latest.codex.status];
  const state = statuses.includes("error") ? "error"
    : statuses.includes("stale") ? "stale"
    : statuses.every((status) => status === "ok") ? "ok" : "";
  els.led.className = `led ${state}`;
  els.led.title = latest.updatedAt
    ? `Updated ${new Date(latest.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Loading…";
  els.led.setAttribute("aria-label", els.led.title);
}

function render() {
  if (!latest) return;
  const now = Date.now();
  renderProvider("claude", latest.claude, now);
  renderProvider("codex", latest.codex, now);
  renderLed();
  fitWindow();
}

function update(state) {
  latest = state;
  render();
}

// Sizes the window to its content; an open dropdown may need more room than compact mode has.
function fitWindow() {
  const last = els.deck.querySelector(".provider:last-of-type");
  let height = last.getBoundingClientRect().bottom + parseFloat(getComputedStyle(els.deck).paddingBottom);
  if (!els.intervalList.hidden) height = Math.max(height, els.intervalList.getBoundingClientRect().bottom + 12);
  void bridge.setHeight(Math.ceil(height));
}

function setCompact(enabled) {
  els.deck.classList.toggle("compact", enabled);
  els.compact.setAttribute("aria-pressed", String(enabled));
  els.compact.title = enabled ? "Full view" : "Compact mode";
  els.compact.setAttribute("aria-label", els.compact.title);
  fitWindow();
}

function setPinned(enabled) {
  els.pin.setAttribute("aria-pressed", String(enabled));
  els.pin.title = enabled ? "Always on top" : "Keep on top";
}

async function init() {
  const settings = await bridge.getSettings();
  setPinned(settings.alwaysOnTop);
  setCompact(settings.compact);
  buildIntervalList(settings.refreshOptions);
  showInterval(settings.refreshSeconds);

  els.compact.addEventListener("click", async () => {
    setCompact(await bridge.setCompact(els.compact.getAttribute("aria-pressed") !== "true"));
  });
  els.pin.addEventListener("click", async () => {
    setPinned(await bridge.setAlwaysOnTop(els.pin.getAttribute("aria-pressed") !== "true"));
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
  bridge.onRefreshInterval(showInterval);
  update(await bridge.getState());
  setInterval(render, 30_000);
}

void init();
