const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bankrollDesktop', {
  isDesktop: true,
  selectWinamaxFolder: () => ipcRenderer.invoke('winamax:select-folder'),
  readWinamaxFolder: (directoryPath) => ipcRenderer.invoke('winamax:read-folder', directoryPath),
  findWinamaxFolder: () => ipcRenderer.invoke('winamax:find-folder'),
  getTrialState: () => ipcRenderer.invoke('trial:get-state'),
  startTrial: () => ipcRenderer.invoke('trial:start'),
});
