const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("claudexMonitor", {
  getState: () => ipcRenderer.invoke("monitor:get-state"),
  refresh: () => ipcRenderer.invoke("monitor:refresh"),
  getSettings: () => ipcRenderer.invoke("monitor:get-settings"),
  setRefresh: (seconds) => ipcRenderer.invoke("monitor:set-refresh", seconds),
  setCompact: (enabled) => ipcRenderer.invoke("monitor:set-compact", enabled),
  setHeight: (height) => ipcRenderer.invoke("monitor:set-height", height),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("monitor:set-always-on-top", enabled),
  onUpdate: (callback) => ipcRenderer.on("usage:update", (_event, state) => callback(state)),
  onRefreshInterval: (callback) => ipcRenderer.on("monitor:refresh-interval", (_event, seconds) => callback(seconds)),
  onAlwaysOnTop: (callback) => ipcRenderer.on("monitor:always-on-top", (_event, enabled) => callback(enabled))
});
