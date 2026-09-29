# GitDrop Desktop — Production Visual Git Client

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/lucky4-git1/gitdrop-app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-44.4-47848F.svg)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**GitDrop Desktop** is a production-quality, local-first visual Git client for Windows, macOS, and Linux. Built with React 19, TypeScript, Vite, and Electron, it combines a fast, modern GUI with the raw power and compatibility of your system's native `git` binary.

GitDrop is **deterministic developer software**. It contains **no AI agents, no LLMs, and no fake simulations**. Every status badge, commit graph node, merge, diff, and remote operation is executed directly against your local filesystem and Git repositories.

---

## Web vs Desktop Editions

| Capability | Web Edition (`gitdrop-source`) | Desktop Edition (`gitdropapp-source`) |
| :--- | :--- | :--- |
| **Filesystem Access** | Chromium File System Access API | Native OS Filesystem (`fs/promises`) |
| **Git Engine** | In-browser `isomorphic-git` | Native system `git.exe` / `git` CLI |
| **Performance** | WebAssembly / JS in-memory | Native process execution |
| **Offline Operations** | 100% Offline (Local repos) | 100% Offline (Local repos) |
| **Repository Size** | Limited by browser tab memory | Unlimited (Full system scale) |
| **Credentials Storage** | IndexedDB / Session Storage | OS Keychain encryption (`safeStorage`) |
| **Folder Selection** | Browser picker dialog | Native OS Directory Picker (`dialog.showOpenDialog`) |
| **Drag & Drop** | Browser FileSystemEntry | Native OS folder drag & drop |
| **OS Integration** | Browser Window | Native Application Menu, Window controls, Shortcuts |
| **Auto-Updates** | Web refresh | GitHub Releases (`electron-updater`) |

---

## Core Desktop Architecture

```
d:/gitdropapp-source/
├── electron/
│   ├── main/
│   │   ├── index.ts        # Main process entry (sandbox, isolation, lifecycle)
│   │   └── menu.ts         # Native OS application menu & shortcuts
│   ├── preload/
│   │   └── index.ts        # Secure contextBridge gateway (window.gitdrop)
│   ├── ipc/
│   │   ├── git.ts          # Native git.exe execution gateway (vector args)
│   │   ├── filesystem.ts   # Canonical filesystem operations & native picker
│   │   ├── credentials.ts  # Electron safeStorage encryption gateway
│   │   ├── settings.ts     # Local userData JSON store
│   │   ├── updater.ts      # GitHub Releases auto-updater orchestration
│   │   └── index.ts        # Central IPC registration
│   └── types/
│       └── index.ts        # Strictly-typed GitDropElectronAPI interface
├── src/
│   ├── services/
│   │   ├── filesystem/
│   │   │   └── NativeFileSystemAdapter.ts   # Implements IFileSystem via IPC
│   │   ├── git/
│   │   │   └── NativeGitAdapter.ts          # Implements GitService via git.exe
│   │   └── security/
│   │       └── DesktopCredentialStore.ts    # Implements CredentialStore via safeStorage
│   └── state/
│       └── RepositoryContext.tsx            # Seamless dual-mode desktop/web provider
├── electron-builder.yml    # Windows (NSIS, portable), macOS (DMG), Linux (AppImage, deb)
└── package.json
```

---

## Security Model

1. **Context Isolation**: `contextIsolation: true` is strictly enforced.
2. **Node Integration**: `nodeIntegration: false` is permanently disabled in renderer.
3. **Chromium Sandboxing**: `sandbox: true` is enforced for all renderer processes.
4. **No Shell Injections**: Git commands execute through `child_process.spawn` passing strict argument array vectors (`args: string[]`). Shell evaluation (`shell: false`) is strictly disabled.
5. **Encrypted Credentials**: GitHub Personal Access Tokens are encrypted using Electron's `safeStorage` API (Windows DPAPI, macOS Keychain, Linux Secret Service).
6. **Navigation Restrictions**: Page navigation outside application origin is denied, and external web links (`http:`, `https:`) open in the user's default OS browser via `shell.openExternal`.

---

## Development & Building

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Git**: Installed and available in your system `PATH` (`git --version`)

### Quick Start

```powershell
# Clone and enter workspace
cd d:\gitdropapp-source

# Install dependencies
npm install

# Start Vite web dev server
npm run dev

# Compile Electron main and preload scripts
npm run electron:compile

# Launch Electron desktop application in dev mode
npm run electron:dev
```

### Quality Assurance & Testing

```powershell
# TypeScript Typecheck (Renderer & Electron)
npm run typecheck
npm run electron:compile

# ESLint validation
npm run lint

# Vitest Unit and Integration Tests
npm run test

# Production Web Bundle
npm run build

# Package Native Desktop Executables (Windows NSIS & portable, macOS, Linux)
npm run electron:build
```

---

## Distribution & Releases

Automatic packaging is configured via `electron-builder.yml` and `.github/workflows/release.yml`. When a release tag is pushed (e.g. `v1.0.0`), GitHub Actions will build:
- **Windows**: `GitDrop-Setup-1.0.0.exe` (NSIS installer) & `GitDrop-1.0.0.exe` (Portable)
- **macOS**: `GitDrop-1.0.0.dmg` & `GitDrop-1.0.0-mac.zip`
- **Linux**: `GitDrop-1.0.0.AppImage` & `GitDrop-1.0.0.deb`

Updates are fetched automatically from GitHub Releases (`lucky4-git1/gitdrop-app`) through `electron-updater`.
