import { CredentialStore, GitHubCredential } from '@/types/remote';
import { logger } from '../logger/logger';

export class DesktopCredentialStore implements CredentialStore {
  public async saveGitHubCredential(credential: GitHubCredential): Promise<void> {
    if (typeof window !== 'undefined' && window.gitdrop?.credentials) {
      await window.gitdrop.credentials.saveToken(credential.token);
      logger.info('remote', 'GitHub credential safely encrypted via OS safeStorage');
    }
  }

  public async getGitHubCredential(): Promise<GitHubCredential | null> {
    if (typeof window !== 'undefined' && window.gitdrop?.credentials) {
      const token = await window.gitdrop.credentials.getToken();
      if (!token) return null;
      return {
        id: 'github_primary',
        token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  public async removeGitHubCredential(): Promise<void> {
    if (typeof window !== 'undefined' && window.gitdrop?.credentials) {
      await window.gitdrop.credentials.removeToken();
      logger.info('remote', 'GitHub credential safely removed from OS safeStorage');
    }
  }

  public async hasGitHubCredential(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.gitdrop?.credentials) {
      return await window.gitdrop.credentials.hasToken();
    }
    return false;
  }
}
