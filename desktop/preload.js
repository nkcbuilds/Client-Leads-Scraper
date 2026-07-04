import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopApp', {
  getUpdateState: () => ipcRenderer.invoke('desktop:get-update-state'),
  getAppMeta: () => ipcRenderer.invoke('desktop:get-app-meta'),
  getRuntimeState: () => ipcRenderer.invoke('desktop:get-runtime-state'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('desktop:quit-and-install-update'),
  onUpdateState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:update-state', listener);
    return () => ipcRenderer.removeListener('desktop:update-state', listener);
  },
  onRuntimeState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop:runtime-state', listener);
    return () => ipcRenderer.removeListener('desktop:runtime-state', listener);
  },
});
