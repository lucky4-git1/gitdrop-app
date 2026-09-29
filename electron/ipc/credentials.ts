import { ipcMain, safeStorage, app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

function getCredentialsFilePath(): string {
  return path.join(app.getPath('userData'), 'credentials.dat');
}

export function registerCredentialsIpc() {
  ipcMain.handle('cred:saveToken', async (_event, token: string) => {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided');
    }

    const filePath = getCredentialsFilePath();
    let dataToSave: Buffer;

    if (safeStorage.isEncryptionAvailable()) {
      dataToSave = safeStorage.encryptString(token);
    } else {
      // Fallback if OS keychain/DPAPI is unavailable
      dataToSave = Buffer.from(token, 'utf8');
    }

    await fs.writeFile(filePath, dataToSave);
  });

  ipcMain.handle('cred:getToken', async (): Promise<string | null> => {
    const filePath = getCredentialsFilePath();
    try {
      const buffer = await fs.readFile(filePath);
      if (safeStorage.isEncryptionAvailable()) {
        try {
          return safeStorage.decryptString(buffer);
        } catch {
          // If decryption fails, try utf8 fallback
          return buffer.toString('utf8');
        }
      }
      return buffer.toString('utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('cred:removeToken', async () => {
    const filePath = getCredentialsFilePath();
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  ipcMain.handle('cred:hasToken', async (): Promise<boolean> => {
    const filePath = getCredentialsFilePath();
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
}
