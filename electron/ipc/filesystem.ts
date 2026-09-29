import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export function registerFilesystemIpc(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('fs:selectDirectory', async () => {
    const win = getMainWindow();
    const res = await dialog.showOpenDialog(win || undefined as any, {
      title: 'Select Repository Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (res.canceled || res.filePaths.length === 0) {
      return null;
    }
    return res.filePaths[0];
  });

  ipcMain.handle('fs:readFile', async (_event, filepath: string, encoding?: string) => {
    const resolvedPath = path.resolve(filepath);
    if (encoding === 'utf8') {
      return await fs.readFile(resolvedPath, 'utf8');
    }
    const buf = await fs.readFile(resolvedPath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });

  ipcMain.handle('fs:writeFile', async (_event, filepath: string, data: string | Uint8Array) => {
    const resolvedPath = path.resolve(filepath);
    const parentDir = path.dirname(resolvedPath);
    await fs.mkdir(parentDir, { recursive: true });

    if (typeof data === 'string') {
      await fs.writeFile(resolvedPath, data, 'utf8');
    } else {
      await fs.writeFile(resolvedPath, Buffer.from(data));
    }
  });

  ipcMain.handle('fs:unlink', async (_event, filepath: string) => {
    const resolvedPath = path.resolve(filepath);
    await fs.unlink(resolvedPath);
  });

  ipcMain.handle('fs:readdir', async (_event, dirpath: string) => {
    const resolvedPath = path.resolve(dirpath);
    return await fs.readdir(resolvedPath);
  });

  ipcMain.handle('fs:mkdir', async (_event, dirpath: string) => {
    const resolvedPath = path.resolve(dirpath);
    await fs.mkdir(resolvedPath, { recursive: true });
  });

  ipcMain.handle('fs:rmdir', async (_event, dirpath: string, recursive = false) => {
    const resolvedPath = path.resolve(dirpath);
    if (recursive) {
      await fs.rm(resolvedPath, { recursive: true, force: true });
    } else {
      await fs.rmdir(resolvedPath);
    }
  });

  ipcMain.handle('fs:stat', async (_event, filepath: string) => {
    const resolvedPath = path.resolve(filepath);
    const stats = await fs.stat(resolvedPath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    };
  });

  ipcMain.handle('fs:exists', async (_event, filepath: string) => {
    const resolvedPath = path.resolve(filepath);
    try {
      await fs.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  });
}
