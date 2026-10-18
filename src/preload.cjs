const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("claudexMonitor", {
  getState: () => ipcRenderer.invoke("monitor:get-state"),
  refresh: () => ipcRenderer.invoke("monitor:refresh"),
  getSettings: () => ipcRenderer.invoke("monitor:get-settings"),
  setRefresh: (seconds) => ipcRenderer.invoke("monitor:set-refresh", seconds),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("monitor:set-always-on-top", enabled),
  onUpdate: (callback) => ipcRenderer.on("usage:update", (_event, state) => callback(state)),
  onAlwaysOnTop: (callback) => ipcRenderer.on("monitor:always-on-top", (_event, enabled) => callback(enabled))
});
