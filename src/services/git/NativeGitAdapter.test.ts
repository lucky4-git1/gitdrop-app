import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NativeGitAdapter } from './NativeGitAdapter';

describe('NativeGitAdapter', () => {
  const mockExec = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).gitdrop = {
      isDesktop: true,
      git: {
        detect: vi.fn().mockResolvedValue({ installed: true, version: '2.40.0' }),
        exec: mockExec,
      },
    };
  });

  it('parses porcelain v1 git status accurately', async () => {
    const adapter = new NativeGitAdapter('/test/repo');
    const mockStatusOutput = [
      '## feature/auth...origin/feature/auth [ahead 2, behind 1]',
      ' M src/App.tsx',
      'M  package.json',
      '?? new-file.txt',
      'UU conflicted.txt',
    ].join('\n');

    mockExec.mockResolvedValueOnce({
      stdout: mockStatusOutput,
      stderr: '',
      exitCode: 0,
    });

    const status = await adapter.status();

    expect(status.branch).toBe('feature/auth');
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(1);
    expect(status.clean).toBe(false);

    // Staged files
    expect(status.staged).toHaveLength(1);
    expect(status.staged[0].path).toBe('package.json');
    expect(status.staged[0].status).toBe('modified');

    // Unstaged files (including untracked and modified)
    expect(status.unstaged).toHaveLength(2);
    expect(status.unstaged.find((u) => u.path === 'new-file.txt')?.status).toBe('untracked');
    expect(status.unstaged.find((u) => u.path === 'src/App.tsx')?.status).toBe('modified');

    // Conflicted files
    expect(status.conflicted).toHaveLength(1);
    expect(status.conflicted[0].path).toBe('conflicted.txt');
    expect(status.conflicted[0].status).toBe('conflict');
  });

  it('correctly stages files via git add', async () => {
    const adapter = new NativeGitAdapter('/test/repo');
    mockExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    await adapter.add(['src/App.tsx', 'package.json']);

    expect(mockExec).toHaveBeenCalledWith(['add', '--', 'src/App.tsx', 'package.json'], '/test/repo');
  });

  it('executes commit and retrieves created commit details', async () => {
    const adapter = new NativeGitAdapter('/test/repo');
    // Commit call
    mockExec.mockResolvedValueOnce({ stdout: '[main 1234567] Initial commit', stderr: '', exitCode: 0 });
    // Log call following commit
    const logOutput = '1234567890abcdef\x00Initial commit\x00tree123\x00\x00Author Name\x00author@test.com\x001700000000\x00Committer Name\x00committer@test.com\x001700000000\x1e';
    mockExec.mockResolvedValueOnce({ stdout: logOutput, stderr: '', exitCode: 0 });

    const commit = await adapter.commit('Initial commit');

    expect(commit.oid).toBe('1234567890abcdef');
    expect(commit.message).toBe('Initial commit');
    expect(commit.author.name).toBe('Author Name');
  });

  it('handles branch creation, checkout, and deletion', async () => {
    const adapter = new NativeGitAdapter('/test/repo');
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await adapter.createBranch('feature/desktop');
    expect(mockExec).toHaveBeenCalledWith(['branch', 'feature/desktop'], '/test/repo');

    await adapter.checkout('feature/desktop');
    expect(mockExec).toHaveBeenCalledWith(['checkout', 'feature/desktop'], '/test/repo');

    await adapter.deleteBranch('feature/desktop');
    expect(mockExec).toHaveBeenCalledWith(['branch', '-D', 'feature/desktop'], '/test/repo');
  });
});
