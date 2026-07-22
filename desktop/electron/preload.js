// Bridge for the local setup/offline screens only — the PMS web app itself
// never touches Node APIs.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("motel", {
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  testServer: (url) => ipcRenderer.invoke("test-server", url),
  saveServer: (url) => ipcRenderer.invoke("save-server", url),
  retryServer: () => ipcRenderer.invoke("retry-server"),
  openSetup: () => ipcRenderer.invoke("open-setup"),
});
