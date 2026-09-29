import { ipcMain } from 'electron';
import { spawn } from 'node:child_process';

export function registerGitIpc() {
  ipcMain.handle('git:detect', async () => {
    return new Promise((resolve) => {
      try {
        const proc = spawn('git', ['--version'], {
          windowsHide: true,
          shell: false,
        });

        let stdout = '';
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            const match = stdout.trim().match(/git version ([\d.]+)/);
            resolve({
              installed: true,
              version: match ? match[1] : stdout.trim(),
              path: 'git',
            });
          } else {
            resolve({ installed: false });
          }
        });

        proc.on('error', () => {
          resolve({ installed: false });
        });
      } catch {
        resolve({ installed: false });
      }
    });
  });

  ipcMain.handle(
    'git:exec',
    async (
      _event,
      args: string[],
      cwd: string
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      // Validate inputs
      if (!Array.isArray(args)) {
        throw new Error('git:exec arguments must be an array of strings');
      }
      if (typeof cwd !== 'string' || !cwd) {
        throw new Error('git:exec requires a valid cwd path');
      }

      return new Promise((resolve, reject) => {
        try {
          const proc = spawn('git', args, {
            cwd,
            windowsHide: true,
            shell: false,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0', // Prevent git from hanging waiting for terminal input
            },
          });

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
          });

          proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
          });

          const timeout = setTimeout(() => {
            proc.kill();
            reject(new Error(`Git command timed out after 60s: git ${args.join(' ')}`));
          }, 60000);

          proc.on('close', (exitCode) => {
            clearTimeout(timeout);
            resolve({
              stdout,
              stderr,
              exitCode: exitCode ?? 0,
            });
          });

          proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
      });
    }
  );
}
