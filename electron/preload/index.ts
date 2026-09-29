import { contextBridge, ipcRenderer } from 'electron';
import type { GitDropElectronAPI } from '../types';

const api: GitDropElectronAPI = {
  isDesktop: true,
  platform: process.platform,
  appVersion: process.env.npm_package_version || '1.0.0',
  git: {
    detect: () => ipcRenderer.invoke('git:detect'),
    exec: (args: string[], cwd: string) => ipcRenderer.invoke('git:exec', args, cwd),
  },
  fs: {
    selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
    readFile: (filepath: string, encoding?: string) => ipcRenderer.invoke('fs:readFile', filepath, encoding),
    writeFile: (filepath: string, data: string | Uint8Array) => ipcRenderer.invoke('fs:writeFile', filepath, data),
    unlink: (filepath: string) => ipcRenderer.invoke('fs:unlink', filepath),
    readdir: (dirpath: string) => ipcRenderer.invoke('fs:readdir', dirpath),
    mkdir: (dirpath: string) => ipcRenderer.invoke('fs:mkdir', dirpath),
    rmdir: (dirpath: string, recursive?: boolean) => ipcRenderer.invoke('fs:rmdir', dirpath, recursive),
    stat: (filepath: string) => ipcRenderer.invoke('fs:stat', filepath),
    exists: (filepath: string) => ipcRenderer.invoke('fs:exists', filepath),
  },
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('storage:delete', key),
  },
  credentials: {
    saveToken: (token: string) => ipcRenderer.invoke('cred:saveToken', token),
    getToken: () => ipcRenderer.invoke('cred:getToken'),
    removeToken: () => ipcRenderer.invoke('cred:removeToken'),
    hasToken: () => ipcRenderer.invoke('cred:hasToken'),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:install'),
  },
  onMenuOpenDirectory: (callback: (dirpath: string) => void) => {
    const handler = (_event: any, dirpath: string) => callback(dirpath);
    ipcRenderer.on('menu:open-directory', handler);
    return () => {
      ipcRenderer.removeListener('menu:open-directory', handler);
    };
  },
};

contextBridge.exposeInMainWorld('gitdrop', api);
