import React, { useState, useEffect } from 'react';
import { useRepository } from '@/state/RepositoryContext';
import { useUI } from '@/state/UIContext';
import { FolderDown, HardDrive, Check, X } from 'lucide-react';

export const GlobalDropOverlay: React.FC = () => {
  const { openDirectoryHandle, openNativePath } = useRepository();
  const { setActiveView } = useUI();

  const [isDragOver, setIsDragOver] = useState(false);
  const [detectedProject, setDetectedProject] = useState<{
    name: string;
    path: string;
    handle?: FileSystemDirectoryHandle;
  } | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounter++;
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragOver(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragOver(false);

      // 1. Desktop native files
      if (typeof window !== 'undefined' && window.gitdrop?.isDesktop && e.dataTransfer?.files?.length) {
        const file = e.dataTransfer.files[0];
        const rawPath = window.gitdrop.getPathForFile
          ? window.gitdrop.getPathForFile(file)
          : (file as any).path;

        if (rawPath && window.gitdrop.fs) {
          try {
            const stat = await window.gitdrop.fs.stat(rawPath);
            let dirPath = rawPath;
            if (stat && !stat.isDirectory) {
              dirPath = rawPath.replace(/[/\\][^/\\]+$/, '');
            }
            const folderName = dirPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
            setDetectedProject({
              name: folderName,
              path: dirPath,
            });
            setIsPromptOpen(true);
            return;
          } catch (err: any) {
            console.error('Failed reading dropped native folder', err);
          }
        }
      }

      // 2. Web File System Access API
      const items = e.dataTransfer?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if ('getAsFileSystemHandle' in item) {
          try {
            const handle = await (item as any).getAsFileSystemHandle();
            if (handle && handle.kind === 'directory') {
              setDetectedProject({
                name: handle.name,
                path: handle.name,
                handle: handle as FileSystemDirectoryHandle,
              });
              setIsPromptOpen(true);
              return;
            }
          } catch {
            // ignore
          }
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleOpenProject = async () => {
    if (!detectedProject) return;
    try {
      if (detectedProject.handle) {
        await openDirectoryHandle(detectedProject.handle, true);
      } else if (openNativePath && detectedProject.path) {
        await openNativePath(detectedProject.path, true);
      }
      setActiveView('workspace');
    } finally {
      setIsPromptOpen(false);
      setDetectedProject(null);
    }
  };

  const handleAddToProjects = async () => {
    if (!detectedProject) return;
    try {
      if (detectedProject.handle) {
        await openDirectoryHandle(detectedProject.handle, false);
      } else if (openNativePath && detectedProject.path) {
        await openNativePath(detectedProject.path, false);
      }
    } finally {
      setIsPromptOpen(false);
      setDetectedProject(null);
    }
  };

  const handleCancel = () => {
    setIsPromptOpen(false);
    setDetectedProject(null);
  };

  return (
    <>
      {/* Full-screen Drag Overlay */}
      {isDragOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              border: '3px dashed var(--accent)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-elevated)',
              padding: '60px 80px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <FolderDown size={64} color="var(--accent-text)" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              DROP PROJECT HERE
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Add to GitDrop workspace
            </p>
          </div>
        </div>
      )}

      {/* New Project Detected Modal Dialog */}
      {isPromptOpen && detectedProject && (
        <div className="modal-gitdrop-backdrop" onClick={handleCancel} role="dialog" aria-modal="true" style={{ zIndex: 10000 }}>
          <div className="modal-gitdrop" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-gitdrop-header">
              <h3 className="modal-gitdrop-title">
                <HardDrive size={16} />
                New Project Detected
              </h3>
              <button className="btn-gitdrop btn-gitdrop-subtle btn-gitdrop-sm" onClick={handleCancel} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="modal-gitdrop-body">
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Folder Name:</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  {detectedProject.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Location: <code style={{ color: 'var(--accent-text)' }}>{detectedProject.path}</code>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                Would you like to open this project immediately, or add it to your project registry to open later?
              </p>
            </div>

            <div className="modal-gitdrop-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn-gitdrop" onClick={handleCancel}>
                Cancel
              </button>
              <button className="btn-gitdrop" onClick={handleAddToProjects}>
                <Check size={14} />
                <span>Add to Projects</span>
              </button>
              <button className="btn-gitdrop btn-gitdrop-primary" onClick={handleOpenProject}>
                <HardDrive size={14} />
                <span>Open Project</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
