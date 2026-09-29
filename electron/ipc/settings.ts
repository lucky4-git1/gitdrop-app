import { ipcMain, app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function readSettings(): Promise<Record<string, any>> {
  const filePath = getSettingsFilePath();
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeSettings(settings: Record<string, any>): Promise<void> {
  const filePath = getSettingsFilePath();
  await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

export function registerSettingsIpc() {
  ipcMain.handle('storage:get', async (_event, key: string) => {
    const settings = await readSettings();
    return settings[key] ?? null;
  });

  ipcMain.handle('storage:set', async (_event, key: string, value: any) => {
    const settings = await readSettings();
    settings[key] = value;
    await writeSettings(settings);
  });

  ipcMain.handle('storage:delete', async (_event, key: string) => {
    const settings = await readSettings();
    delete settings[key];
    await writeSettings(settings);
  });
}
