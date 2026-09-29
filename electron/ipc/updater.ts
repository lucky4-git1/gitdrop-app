import { ipcMain, app } from 'electron';
import { autoUpdater } from 'electron-updater';

export function registerUpdaterIpc() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  ipcMain.handle('updater:check', async () => {
    // In development mode, autoUpdater might not have a dev-app-update.yml configured
    if (!app.isPackaged) {
      return {
        available: false,
        version: app.getVersion(),
        releaseNotes: 'Development build: auto-updates are disabled in unpackaged mode.',
      };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      if (result && result.updateInfo) {
        return {
          available: result.updateInfo.version !== app.getVersion(),
          version: result.updateInfo.version,
          releaseNotes: typeof result.updateInfo.releaseNotes === 'string'
            ? result.updateInfo.releaseNotes
            : undefined,
        };
      }
      return { available: false, version: app.getVersion() };
    } catch (err: any) {
      return {
        available: false,
        version: app.getVersion(),
        releaseNotes: err?.message || 'Failed to check for updates',
      };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) return;
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    if (!app.isPackaged) return;
    autoUpdater.quitAndInstall();
  });
}
