import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectManager } from './ProjectManager';
import { ProjectRegistry } from './ProjectRegistry';
import { NativeFileSystemAdapter } from '../filesystem/NativeFileSystemAdapter';
import { NativeGitAdapter } from '../git/NativeGitAdapter';

describe('Desktop Native Project Integration', () => {
  let registry: ProjectRegistry;
  let manager: ProjectManager;

  const mockFsApi = {
    selectDirectory: vi.fn(),
    readFile: vi.fn().mockImplementation(async (filepath: string) => {
      if (filepath.endsWith('package.json')) {
        return JSON.stringify({ name: 'my-desktop-app', dependencies: { react: '^19.0.0' } });
      }
      throw new Error('Not found');
    }),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn().mockResolvedValue(['package.json', 'src']),
    mkdir: vi.fn(),
    rmdir: vi.fn(),
    stat: vi.fn().mockImplementation(async (filepath: string) => ({
      isFile: filepath.endsWith('package.json'),
      isDirectory: !filepath.endsWith('package.json'),
      size: 100,
      mtimeMs: Date.now(),
    })),
    exists: vi.fn().mockImplementation(async (filepath: string) => filepath.endsWith('package.json')),
  };

  const mockGitApi = {
    detect: vi.fn().mockResolvedValue({ installed: true, version: '2.40.0' }),
    exec: vi.fn().mockResolvedValue({ stdout: '## main\n', stderr: '', exitCode: 0 }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).gitdrop = {
      isDesktop: true,
      fs: mockFsApi,
      git: mockGitApi,
    };
    registry = new ProjectRegistry();
    manager = new ProjectManager(registry);
  });

  it('opens a desktop project without requiring browser permission prompts', async () => {
    const entry = await manager.addProject({
      name: 'DesktopRepo',
      displayName: 'DesktopRepo',
      path: 'D:/repos/DesktopRepo',
      provider: 'local',
      isVirtual: false,
      isDefault: false,
    });

    await manager.openProject(entry.id);

    const activeState = manager.getActiveState();
    expect(activeState.project?.id).toBe(entry.id);
    expect(activeState.needsPermission).toBe(false);
    expect(activeState.fileSystem).toBeInstanceOf(NativeFileSystemAdapter);
    expect(activeState.gitService).toBeInstanceOf(NativeGitAdapter);
    expect(activeState.projectInfo?.framework).toBe('Node.js');
  });
});
