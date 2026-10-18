const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { fetchClaudeUsage } = require("./claude.cjs");
const { fetchCodexUsage } = require("./codex.cjs");

const REFRESH_OPTIONS = [30, 60, 120, 300];
const DEFAULT_SETTINGS = { refreshSeconds: 60, alwaysOnTop: true };

let window;
let tray;
let quitting = false;
let pollTimer;
let polling = null;
let settings = { ...DEFAULT_SETTINGS };
let state = {
  updatedAt: null,
  claude: { status: "loading", plan: null, windows: [], error: null },
  codex: { status: "loading", plan: null, windows: [], error: null }
};

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");

function loadSettings() {
  try {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsFile(), "utf8")) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  if (!REFRESH_OPTIONS.includes(settings.refreshSeconds)) settings.refreshSeconds = DEFAULT_SETTINGS.refreshSeconds;
}

function saveSettings() {
  try {
    writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error("Could not save settings:", error);
  }
}

// A failed fetch keeps the last good figures and reports the error alongside them.
async function settle(previous, fetcher) {
  try {
    return await fetcher();
  } catch (error) {
    return { ...previous, status: previous.windows.length ? "stale" : "error", error: error.message };
  }
}

function poll() {
  if (polling) return polling;
  polling = (async () => {
    const [claude, codex] = await Promise.all([
      settle(state.claude, fetchClaudeUsage),
      settle(state.codex, fetchCodexUsage)
    ]);
    state = { updatedAt: Date.now(), claude, codex };
    window?.webContents.send("usage:update", state);
    updateTrayTooltip();
  })().finally(() => {
    polling = null;
  });
  return polling;
}

function setRefresh(seconds) {
  if (!REFRESH_OPTIONS.includes(seconds)) return;
  settings.refreshSeconds = seconds;
  saveSettings();
  schedulePolling();
  rebuildTrayMenu();
  window?.webContents.send("monitor:refresh-interval", seconds);
}

function schedulePolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(poll, settings.refreshSeconds * 1000);
}

function percentFor(source, id) {
  const value = source.windows.find((entry) => entry.id === id)?.usedPercent;
  return typeof value === "number" ? `${Math.round(value)}%` : "--";
}

function updateTrayTooltip() {
  tray?.setToolTip(
    `Claude ${percentFor(state.claude, "session")} · week ${percentFor(state.claude, "weekly")}\n` +
    `Codex ${percentFor(state.codex, "session")} · week ${percentFor(state.codex, "weekly")}`
  );
}

ipcMain.handle("monitor:get-state", () => state);
ipcMain.handle("monitor:refresh", () => poll().then(() => state));
ipcMain.handle("monitor:get-settings", () => ({ ...settings, refreshOptions: REFRESH_OPTIONS }));
ipcMain.handle("monitor:set-refresh", (_event, seconds) => {
  setRefresh(seconds);
  return settings.refreshSeconds;
});
ipcMain.handle("monitor:set-always-on-top", (_event, enabled) => {
  settings.alwaysOnTop = Boolean(enabled);
  saveSettings();
  window?.setAlwaysOnTop(settings.alwaysOnTop, "floating");
  rebuildTrayMenu();
  return settings.alwaysOnTop;
});

function showWidget() {
  window.show();
  window.focus();
}

function toggleWidget() {
  if (window.isVisible() && window.isFocused()) window.hide();
  else showWidget();
}

const iconPath = path.join(__dirname, "..", "assets", "icon.png");

function rebuildTrayMenu() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Claudex Monitor", click: showWidget },
    { label: "Refresh now", click: () => void poll() },
    {
      label: "Refresh every",
      submenu: REFRESH_OPTIONS.map((seconds) => ({
        label: seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minute${seconds === 60 ? "" : "s"}`,
        type: "radio",
        checked: settings.refreshSeconds === seconds,
        click: () => setRefresh(seconds)
      }))
    },
    {
      label: "Always on top",
      type: "checkbox",
      checked: settings.alwaysOnTop,
      click: (item) => {
        settings.alwaysOnTop = item.checked;
        saveSettings();
        window.setAlwaysOnTop(item.checked, "floating");
        window.webContents.send("monitor:always-on-top", item.checked);
      }
    },
    { type: "separator" },
    { label: "Quit", click: () => { quitting = true; app.quit(); } }
  ]));
}

function createWidget() {
  loadSettings();
  window = new BrowserWindow({
    width: 316,
    height: 300,
    resizable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    title: "Claudex Monitor",
    icon: iconPath,
    alwaysOnTop: settings.alwaysOnTop,
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });
  window.setAlwaysOnTop(settings.alwaysOnTop, "floating");
  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });

  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip("Claudex Monitor");
  tray.on("click", showWidget);
  rebuildTrayMenu();
  globalShortcut.register("CommandOrControl+Alt+M", toggleWidget);

  void poll();
  schedulePolling();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (window) showWidget(); });
  app.whenReady().then(createWidget);
  app.on("activate", () => { if (window) showWidget(); });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("before-quit", () => { quitting = true; });
}
