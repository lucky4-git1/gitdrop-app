import { BrowserWindow } from 'electron';
import { registerGitIpc } from './git';
import { registerFilesystemIpc } from './filesystem';
import { registerCredentialsIpc } from './credentials';
import { registerSettingsIpc } from './settings';
import { registerUpdaterIpc } from './updater';

export function registerAllIpc(getMainWindow: () => BrowserWindow | null) {
  registerGitIpc();
  registerFilesystemIpc(getMainWindow);
  registerCredentialsIpc();
  registerSettingsIpc();
  registerUpdaterIpc();
}
