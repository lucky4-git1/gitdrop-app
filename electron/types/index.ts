export interface GitDropElectronAPI {
  isDesktop: boolean;
  platform: string;
  appVersion: string;
  git: {
    detect: () => Promise<{ installed: boolean; version?: string; path?: string }>;
    exec: (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };
  fs: {
    selectDirectory: () => Promise<string | null>;
    readFile: (filepath: string, encoding?: string) => Promise<string | Uint8Array>;
    writeFile: (filepath: string, data: string | Uint8Array) => Promise<void>;
    unlink: (filepath: string) => Promise<void>;
    readdir: (dirpath: string) => Promise<string[]>;
    mkdir: (dirpath: string) => Promise<void>;
    rmdir: (dirpath: string, recursive?: boolean) => Promise<void>;
    stat: (filepath: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number; mtimeMs: number }>;
    exists: (filepath: string) => Promise<boolean>;
  };
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  credentials: {
    saveToken: (token: string) => Promise<void>;
    getToken: () => Promise<string | null>;
    removeToken: () => Promise<void>;
    hasToken: () => Promise<boolean>;
  };
  updater: {
    checkForUpdates: () => Promise<{ available: boolean; version?: string; releaseNotes?: string }>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
  };
  onMenuOpenDirectory?: (callback: (dirpath: string) => void) => () => void;
}

declare global {
  interface Window {
    gitdrop?: GitDropElectronAPI;
  }
}
