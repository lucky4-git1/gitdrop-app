import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DesktopCredentialStore } from './DesktopCredentialStore';

describe('DesktopCredentialStore', () => {
  const mockCredApi = {
    saveToken: vi.fn(),
    getToken: vi.fn(),
    removeToken: vi.fn(),
    hasToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).gitdrop = {
      isDesktop: true,
      credentials: mockCredApi,
    };
  });

  it('saves token via electron credentials IPC', async () => {
    const store = new DesktopCredentialStore();
    await store.saveGitHubCredential({
      id: 'github_primary',
      token: 'ghp_secret1234567890',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mockCredApi.saveToken).toHaveBeenCalledWith('ghp_secret1234567890');
  });

  it('retrieves credential via electron credentials IPC', async () => {
    const store = new DesktopCredentialStore();
    mockCredApi.getToken.mockResolvedValueOnce('ghp_secret1234567890');

    const cred = await store.getGitHubCredential();
    expect(cred).not.toBeNull();
    expect(cred?.token).toBe('ghp_secret1234567890');
    expect(mockCredApi.getToken).toHaveBeenCalled();
  });

  it('removes token via electron credentials IPC', async () => {
    const store = new DesktopCredentialStore();
    await store.removeGitHubCredential();
    expect(mockCredApi.removeToken).toHaveBeenCalled();
  });

  it('checks token existence via electron credentials IPC', async () => {
    const store = new DesktopCredentialStore();
    mockCredApi.hasToken.mockResolvedValueOnce(true);

    const has = await store.hasGitHubCredential();
    expect(has).toBe(true);
    expect(mockCredApi.hasToken).toHaveBeenCalled();
  });
});
