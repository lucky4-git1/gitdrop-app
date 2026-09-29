import {
  GitStatusSummary,
  Commit,
  Branch,
  Tag,
  Remote,
  DiffFile,
  MergeResult,
  RebaseResult,
  StashItem,
  GitFileStatus,
  FileStatusCode,
} from '@/types/git';
import { GitService } from './IGitService';
import { logger } from '../logger/logger';

export class NativeGitAdapter implements GitService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath.replace(/[/\\]+$/, '');
  }

  public getRepoPath(): string {
    return this.repoPath;
  }

  private async exec(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (typeof window === 'undefined' || !window.gitdrop?.git) {
      throw new Error('Native git operations are only available in GitDrop Desktop');
    }
    const result = await window.gitdrop.git.exec(args, this.repoPath);
    if (result.exitCode !== 0) {
      logger.debug('git', `git ${args.join(' ')} failed (exit ${result.exitCode}): ${result.stderr}`);
    }
    return result;
  }

  public async ensureGitInitialized(defaultBranch = 'main'): Promise<void> {
    const check = await this.exec(['rev-parse', '--is-inside-work-tree']);
    if (check.exitCode !== 0) {
      logger.info('git', `Initializing native git repository on branch ${defaultBranch}`);
      await this.init({ defaultBranch });
    }
  }

  public async init(options?: { defaultBranch?: string; user?: { name: string; email: string } }): Promise<void> {
    const branch = options?.defaultBranch || 'main';
    const initRes = await this.exec(['init', `-b`, branch]);
    if (initRes.exitCode !== 0) {
      // Fallback if git version does not support -b in init
      await this.exec(['init']);
      await this.exec(['checkout', '-b', branch]);
    }

    if (options?.user) {
      await this.exec(['config', 'user.name', options.user.name]);
      await this.exec(['config', 'user.email', options.user.email]);
    }
  }

  public async status(): Promise<GitStatusSummary> {
    // 1. Get branch info and status porcelain v1
    const res = await this.exec(['status', '--porcelain=v1', '-b', '-uall']);
    if (res.exitCode !== 0) {
      // Check if not a git repository
      return {
        branch: 'unknown',
        clean: true,
        staged: [],
        unstaged: [],
        conflicted: [],
        ahead: 0,
        behind: 0,
      };
    }

    const lines = res.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let branch = 'main';
    let ahead = 0;
    let behind = 0;
    let upstream: string | undefined;

    const staged: GitFileStatus[] = [];
    const unstaged: GitFileStatus[] = [];
    const conflicted: GitFileStatus[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const header = line.substring(3).trim();
        // e.g. ## main...origin/main [ahead 1, behind 2]
        // or ## No commits yet on main
        // or ## HEAD (no branch)
        if (header.includes('No commits yet on ')) {
          branch = header.replace('No commits yet on ', '').trim();
        } else if (header.includes('Initial commit on ')) {
          branch = header.replace('Initial commit on ', '').trim();
        } else {
          const parts = header.split('...');
          branch = parts[0].trim();
          if (parts[1]) {
            const upParts = parts[1].split(' ');
            upstream = upParts[0].trim();
            const aheadMatch = header.match(/ahead (\d+)/);
            if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
            const behindMatch = header.match(/behind (\d+)/);
            if (behindMatch) behind = parseInt(behindMatch[1], 10);
          }
        }
        continue;
      }

      if (line.length < 3) continue;

      const x = line[0];
      const y = line[1];
      const filepath = line.substring(3).trim();

      // Check conflict
      if ((x === 'U' || y === 'U') || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
        conflicted.push({
          path: filepath,
          status: 'conflict',
          staged: false,
          unstaged: true,
        });
        continue;
      }

      // Untracked
      if (x === '?' && y === '?') {
        unstaged.push({
          path: filepath,
          status: 'untracked',
          staged: false,
          unstaged: true,
        });
        continue;
      }

      // Staged
      if (x !== ' ' && x !== '?') {
        let code: FileStatusCode = 'modified';
        if (x === 'A') code = 'added';
        else if (x === 'D') code = 'deleted';
        else if (x === 'M') code = 'modified';
        staged.push({
          path: filepath,
          status: code,
          staged: true,
          unstaged: false,
        });
      }

      // Unstaged
      if (y !== ' ' && y !== '?') {
        let code: FileStatusCode = 'modified';
        if (y === 'D') code = 'deleted';
        else if (y === 'M') code = 'modified';
        unstaged.push({
          path: filepath,
          status: code,
          staged: false,
          unstaged: true,
        });
      }
    }

    const clean = staged.length === 0 && unstaged.length === 0 && conflicted.length === 0;

    return {
      branch,
      clean,
      staged: staged.sort((a, b) => a.path.localeCompare(b.path)),
      unstaged: unstaged.sort((a, b) => a.path.localeCompare(b.path)),
      conflicted: conflicted.sort((a, b) => a.path.localeCompare(b.path)),
      ahead,
      behind,
      upstream,
    };
  }

  public async add(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const res = await this.exec(['add', '--', ...paths]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to stage files: ${res.stderr || res.stdout}`);
    }
  }

  public async reset(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const res = await this.exec(['reset', 'HEAD', '--', ...paths]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to unstage files: ${res.stderr || res.stdout}`);
    }
  }

  public async commit(
    message: string,
    options?: { amend?: boolean; author?: { name: string; email: string } }
  ): Promise<Commit> {
    const args = ['commit', '-m', message];
    if (options?.amend) {
      args.push('--amend');
    }
    if (options?.author) {
      args.push(`--author=${options.author.name} <${options.author.email}>`);
    }

    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to create commit: ${res.stderr || res.stdout}`);
    }

    const logs = await this.log({ depth: 1 });
    if (logs.length === 0) {
      throw new Error('Commit succeeded but could not read commit details');
    }
    return logs[0];
  }

  public async log(options?: { depth?: number; ref?: string }): Promise<Commit[]> {
    const depth = options?.depth || 50;
    const ref = options?.ref || 'HEAD';

    // Format: hash%00subject%00tree%00parent%00authorName%00authorEmail%00authorTime%00committerName%00committerEmail%00committerTime%x1e
    const format = '%H%x00%s%x00%T%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ce%x00%ct%x1e';
    const res = await this.exec(['log', `-n`, depth.toString(), `--format=${format}`, ref]);
    if (res.exitCode !== 0) {
      // Empty repository or no commits yet
      return [];
    }

    const entries = res.stdout.split('\x1e').filter((e) => e.trim().length > 0);
    const commits: Commit[] = [];

    for (const entry of entries) {
      const parts = entry.trim().split('\x00');
      if (parts.length < 10) continue;

      const [oid, message, tree, parentStr, an, ae, at, cn, ce, ct] = parts;
      commits.push({
        oid,
        message,
        tree,
        parent: parentStr ? parentStr.split(' ').filter(Boolean) : [],
        author: {
          name: an,
          email: ae,
          timestamp: parseInt(at, 10) * 1000,
        },
        committer: {
          name: cn,
          email: ce,
          timestamp: parseInt(ct, 10) * 1000,
        },
      });
    }

    return commits;
  }

  public async diff(options?: { filepath?: string; staged?: boolean; commitOid?: string }): Promise<DiffFile[]> {
    const args = ['diff'];
    if (options?.commitOid) {
      args.push(`${options.commitOid}~1`, options.commitOid);
    } else if (options?.staged) {
      args.push('--cached');
    }

    if (options?.filepath) {
      args.push('--', options.filepath);
    }

    const res = await this.exec(args);
    if (res.exitCode !== 0 && !res.stdout) {
      return [];
    }

    // Split hunks by file
    const fileDiffs = res.stdout.split(/^diff --git /m).filter(Boolean);
    const result: DiffFile[] = [];

    for (const fileDiff of fileDiffs) {
      const firstLine = fileDiff.split('\n')[0];
      const match = firstLine.match(/a\/(.+?)\s+b\/(.+)/);
      const path = match ? match[2] : (options?.filepath || 'unknown');

      let status: 'modified' | 'added' | 'deleted' = 'modified';
      if (fileDiff.includes('new file mode')) status = 'added';
      else if (fileDiff.includes('deleted file mode')) status = 'deleted';

      result.push({
        path,
        status,
        diffHunks: `diff --git ${fileDiff}`,
      });
    }

    return result;
  }

  public async branch(): Promise<Branch[]> {
    const format = '%(refname:short)%x00%(HEAD)%x00%(upstream:short)%x00%(objectname)';
    const res = await this.exec(['branch', '-a', `--format=${format}`]);
    if (res.exitCode !== 0) return [];

    const lines = res.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const branches: Branch[] = [];

    for (const line of lines) {
      const [name, head, upstream, commitOid] = line.split('\x00');
      if (!name) continue;

      branches.push({
        name,
        current: head === '*',
        upstream: upstream || undefined,
        commitOid: commitOid || undefined,
      });
    }

    return branches;
  }

  public async currentBranch(): Promise<string> {
    const res = await this.exec(['branch', '--show-current']);
    if (res.exitCode === 0 && res.stdout.trim()) {
      return res.stdout.trim();
    }
    const rev = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    return rev.stdout.trim() || 'main';
  }

  public async checkout(branch: string): Promise<void> {
    const res = await this.exec(['checkout', branch]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to checkout branch '${branch}': ${res.stderr || res.stdout}`);
    }
  }

  public async createBranch(name: string, startPoint?: string): Promise<void> {
    const args = ['branch', name];
    if (startPoint) args.push(startPoint);
    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to create branch '${name}': ${res.stderr || res.stdout}`);
    }
  }

  public async deleteBranch(name: string): Promise<void> {
    const res = await this.exec(['branch', '-D', name]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to delete branch '${name}': ${res.stderr || res.stdout}`);
    }
  }

  public async renameBranch(oldName: string, newName: string): Promise<void> {
    const res = await this.exec(['branch', '-m', oldName, newName]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to rename branch '${oldName}' to '${newName}': ${res.stderr || res.stdout}`);
    }
  }

  public async merge(branch: string): Promise<MergeResult> {
    const res = await this.exec(['merge', branch]);
    if (res.exitCode === 0) {
      return {
        success: true,
        fastForward: res.stdout.includes('Fast-forward'),
        alreadyMerged: res.stdout.includes('Already up to date'),
        message: res.stdout,
      };
    }

    // Check for conflicts
    const status = await this.status();
    return {
      success: false,
      conflicts: status.conflicted.map((c) => c.path),
      message: res.stderr || res.stdout,
    };
  }

  public async rebase(branch: string, onto: string): Promise<RebaseResult> {
    const res = await this.exec(['rebase', '--onto', onto, branch]);
    if (res.exitCode === 0) {
      return { success: true };
    }
    const status = await this.status();
    return {
      success: false,
      conflicts: status.conflicted.map((c) => c.path),
      message: res.stderr || res.stdout,
    };
  }

  public async stash(message?: string): Promise<void> {
    const args = ['stash', 'push'];
    if (message) args.push('-m', message);
    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to stash changes: ${res.stderr || res.stdout}`);
    }
  }

  public async stashList(): Promise<StashItem[]> {
    const format = '%gd%x00%H%x00%gs%x00%ci';
    const res = await this.exec(['stash', 'list', `--format=${format}`]);
    if (res.exitCode !== 0) return [];

    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    const items: StashItem[] = [];

    lines.forEach((line, index) => {
      const [ref, oid, message, date] = line.split('\x00');
      items.push({
        index,
        oid: oid || '',
        message: message || ref,
        date: date || '',
        branch: 'stash',
      });
    });

    return items;
  }

  public async stashApply(index: number): Promise<void> {
    const res = await this.exec(['stash', 'apply', `stash@{${index}}`]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to apply stash: ${res.stderr || res.stdout}`);
    }
  }

  public async stashPop(index: number): Promise<void> {
    const res = await this.exec(['stash', 'pop', `stash@{${index}}`]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to pop stash: ${res.stderr || res.stdout}`);
    }
  }

  public async stashDrop(index: number): Promise<void> {
    const res = await this.exec(['stash', 'drop', `stash@{${index}}`]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to drop stash: ${res.stderr || res.stdout}`);
    }
  }

  public async resetBranch(mode: 'soft' | 'mixed' | 'hard', ref = 'HEAD'): Promise<void> {
    const res = await this.exec(['reset', `--${mode}`, ref]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to reset branch: ${res.stderr || res.stdout}`);
    }
  }

  public async revert(commitOid: string): Promise<void> {
    const res = await this.exec(['revert', '--no-edit', commitOid]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to revert commit ${commitOid}: ${res.stderr || res.stdout}`);
    }
  }

  public async remotes(): Promise<Remote[]> {
    const res = await this.exec(['remote', '-v']);
    if (res.exitCode !== 0) return [];

    const map = new Map<string, string>();
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        map.set(parts[0], parts[1]);
      }
    }

    return Array.from(map.entries()).map(([name, url]) => ({ name, url }));
  }

  public async addRemote(name: string, url: string): Promise<void> {
    const res = await this.exec(['remote', 'add', name, url]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to add remote: ${res.stderr || res.stdout}`);
    }
  }

  public async removeRemote(name: string): Promise<void> {
    const res = await this.exec(['remote', 'remove', name]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to remove remote: ${res.stderr || res.stdout}`);
    }
  }

  public async fetch(options?: { remote?: string; token?: string }): Promise<void> {
    const remote = options?.remote || 'origin';
    const args: string[] = [];

    if (options?.token) {
      args.push('-c', `http.extraHeader=AUTHORIZATION: token ${options.token}`);
    }
    args.push('fetch', remote);

    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to fetch from remote: ${res.stderr || res.stdout}`);
    }
  }

  public async pull(options?: { remote?: string; branch?: string; token?: string }): Promise<void> {
    const remote = options?.remote || 'origin';
    const branch = options?.branch || '';
    const args: string[] = [];

    if (options?.token) {
      args.push('-c', `http.extraHeader=AUTHORIZATION: token ${options.token}`);
    }
    args.push('pull', remote);
    if (branch) args.push(branch);

    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to pull from remote: ${res.stderr || res.stdout}`);
    }
  }

  public async push(options?: {
    remote?: string;
    branch?: string;
    force?: boolean;
    token?: string;
    author?: { name: string; email: string };
  }): Promise<void> {
    const remote = options?.remote || 'origin';
    const branch = options?.branch || (await this.currentBranch());
    const args: string[] = [];

    if (options?.token) {
      args.push('-c', `http.extraHeader=AUTHORIZATION: token ${options.token}`);
    }
    args.push('push', '-u', remote, branch);
    if (options?.force) {
      args.push('--force');
    }

    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to push to remote: ${res.stderr || res.stdout}`);
    }
  }

  public async tags(): Promise<Tag[]> {
    const format = '%(refname:short)%x00%(objectname)%x00%(contents:subject)';
    const res = await this.exec(['tag', '-l', `--format=${format}`]);
    if (res.exitCode !== 0) return [];

    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    const tags: Tag[] = [];

    for (const line of lines) {
      const [name, oid, message] = line.split('\x00');
      if (name) {
        tags.push({ name, oid: oid || '', message: message || undefined });
      }
    }

    return tags;
  }

  public async createTag(name: string, ref = 'HEAD', message?: string): Promise<void> {
    const args = message ? ['tag', '-a', name, '-m', message, ref] : ['tag', name, ref];
    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to create tag: ${res.stderr || res.stdout}`);
    }
  }

  public async deleteTag(name: string): Promise<void> {
    const res = await this.exec(['tag', '-d', name]);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to delete tag: ${res.stderr || res.stdout}`);
    }
  }

  public async discard(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.exec(['checkout', '--', ...paths]);
    await this.exec(['clean', '-fd', '--', ...paths]);
  }

  public async clone(options: { url: string; dir?: string; depth?: number }): Promise<void> {
    const args = ['clone', options.url];
    if (options.depth) args.push('--depth', options.depth.toString());
    if (options.dir) args.push(options.dir);

    const res = await this.exec(args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to clone repository: ${res.stderr || res.stdout}`);
    }
  }
}
