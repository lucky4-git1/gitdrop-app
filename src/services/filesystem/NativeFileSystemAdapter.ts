import { FileStat, IFileSystem } from '@/types/filesystem';
import { normalizePath } from './pathUtils';

export class NativeFileSystemAdapter implements IFileSystem {
  private basePath: string;

  constructor(basePath: string) {
    // Store canonical base path without trailing slash
    this.basePath = basePath.replace(/[/\\]+$/, '');
  }

  public getBasePath(): string {
    return this.basePath;
  }

  private resolvePath(filepath: string): string {
    const norm = normalizePath(filepath);
    if (!norm) return this.basePath;
    // Handle Windows drive or POSIX path separator
    const separator = this.basePath.includes('\\') ? '\\' : '/';
    const subPath = norm.split('/').join(separator);
    return `${this.basePath}${separator}${subPath}`;
  }

  private getApi() {
    if (typeof window === 'undefined' || !window.gitdrop?.fs) {
      throw new Error('Native file system operations are only supported in GitDrop Desktop');
    }
    return window.gitdrop.fs;
  }

  public async readFile(filepath: string, options?: { encoding?: string }): Promise<Uint8Array | string> {
    const api = this.getApi();
    const fullPath = this.resolvePath(filepath);
    try {
      return await api.readFile(fullPath, options?.encoding);
    } catch (_err: any) {
      const e: any = new Error(`ENOENT: no such file or directory, open '${filepath}'`);
      e.code = 'ENOENT';
      throw e;
    }
  }

  public async writeFile(filepath: string, data: Uint8Array | string): Promise<void> {
    const api = this.getApi();
    const fullPath = this.resolvePath(filepath);
    await api.writeFile(fullPath, data);
  }

  public async unlink(filepath: string): Promise<void> {
    const api = this.getApi();
    const fullPath = this.resolvePath(filepath);
    try {
      await api.unlink(fullPath);
    } catch (_err: any) {
      const e: any = new Error(`ENOENT: no such file or directory, unlink '${filepath}'`);
      e.code = 'ENOENT';
      throw e;
    }
  }

  public async readdir(dirpath: string): Promise<string[]> {
    const api = this.getApi();
    const fullPath = this.resolvePath(dirpath);
    try {
      const entries = await api.readdir(fullPath);
      return entries.sort();
    } catch (_err: any) {
      const e: any = new Error(`ENOENT: no such file or directory, scandir '${dirpath}'`);
      e.code = 'ENOENT';
      throw e;
    }
  }

  public async mkdir(dirpath: string): Promise<void> {
    const api = this.getApi();
    const fullPath = this.resolvePath(dirpath);
    await api.mkdir(fullPath);
  }

  public async rmdir(dirpath: string, options?: { recursive?: boolean }): Promise<void> {
    const api = this.getApi();
    const fullPath = this.resolvePath(dirpath);
    try {
      await api.rmdir(fullPath, options?.recursive);
    } catch (_err: any) {
      const e: any = new Error(`ENOENT: no such file or directory, rmdir '${dirpath}'`);
      e.code = 'ENOENT';
      throw e;
    }
  }

  public async stat(filepath: string): Promise<FileStat> {
    const api = this.getApi();
    const fullPath = this.resolvePath(filepath);
    try {
      const raw = await api.stat(fullPath);
      return {
        isFile: () => raw.isFile,
        isDirectory: () => raw.isDirectory,
        isSymbolicLink: () => false,
        size: raw.size,
        mtimeMs: raw.mtimeMs,
        ctimeMs: raw.mtimeMs,
        mode: raw.isDirectory ? 0o040755 : 0o100644,
      };
    } catch (_err: any) {
      const e: any = new Error(`ENOENT: no such file or directory, stat '${filepath}'`);
      e.code = 'ENOENT';
      throw e;
    }
  }

  public async lstat(filepath: string): Promise<FileStat> {
    return this.stat(filepath);
  }

  public async exists(filepath: string): Promise<boolean> {
    const api = this.getApi();
    const fullPath = this.resolvePath(filepath);
    return await api.exists(fullPath);
  }
}
