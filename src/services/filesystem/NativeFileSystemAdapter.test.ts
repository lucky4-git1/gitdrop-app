import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NativeFileSystemAdapter } from './NativeFileSystemAdapter';

describe('NativeFileSystemAdapter', () => {
  const mockFsApi = {
    selectDirectory: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    rmdir: vi.fn(),
    stat: vi.fn(),
    exists: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).gitdrop = {
      isDesktop: true,
      fs: mockFsApi,
    };
  });

  it('resolves paths correctly relative to basePath', async () => {
    const adapter = new NativeFileSystemAdapter('D:/repo');
    mockFsApi.readFile.mockResolvedValue('file content');

    const result = await adapter.readFile('src/index.ts', { encoding: 'utf8' });
    expect(result).toBe('file content');
    expect(mockFsApi.readFile).toHaveBeenCalledWith('D:/repo/src/index.ts', 'utf8');
  });

  it('handles write, unlink, and readdir correctly', async () => {
    const adapter = new NativeFileSystemAdapter('C:\\Users\\dev\\project');
    mockFsApi.readdir.mockResolvedValue(['b.txt', 'a.txt']);

    const files = await adapter.readdir('docs');
    expect(files).toEqual(['a.txt', 'b.txt']);
    expect(mockFsApi.readdir).toHaveBeenCalledWith('C:\\Users\\dev\\project\\docs');

    await adapter.writeFile('docs/readme.md', 'hello');
    expect(mockFsApi.writeFile).toHaveBeenCalledWith('C:\\Users\\dev\\project\\docs\\readme.md', 'hello');

    await adapter.unlink('docs/old.md');
    expect(mockFsApi.unlink).toHaveBeenCalledWith('C:\\Users\\dev\\project\\docs\\old.md');
  });

  it('maps stat results to FileStat interface', async () => {
    const adapter = new NativeFileSystemAdapter('/home/user/repo');
    mockFsApi.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: 1024,
      mtimeMs: 1600000000000,
    });

    const stat = await adapter.stat('package.json');
    expect(stat.isFile()).toBe(true);
    expect(stat.isDirectory()).toBe(false);
    expect(stat.size).toBe(1024);
    expect(stat.mtimeMs).toBe(1600000000000);
  });

  it('throws ENOENT error code when file is not found', async () => {
    const adapter = new NativeFileSystemAdapter('D:/repo');
    mockFsApi.readFile.mockRejectedValue(new Error('File not found'));

    await expect(adapter.readFile('missing.txt')).rejects.toThrow();
    try {
      await adapter.readFile('missing.txt');
    } catch (err: any) {
      expect(err.code).toBe('ENOENT');
    }
  });
});
