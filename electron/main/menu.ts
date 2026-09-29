import { Menu, MenuItemConstructorOptions, app, shell, BrowserWindow, dialog } from 'electron';

export function setupApplicationMenu(getMainWindow: () => BrowserWindow | null) {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Repository...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = getMainWindow();
            if (!win) return;
            const res = await dialog.showOpenDialog(win, {
              title: 'Open Git Repository',
              properties: ['openDirectory'],
            });
            if (!res.canceled && res.filePaths.length > 0) {
              win.webContents.send('menu:open-directory', res.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitDrop Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/lucky4-git1/Gitdrop');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/lucky4-git1/Gitdrop/issues');
          },
        },
        { type: 'separator' },
        {
          label: `About GitDrop v${app.getVersion()}`,
          click: () => {
            const win = getMainWindow();
            dialog.showMessageBox(win || undefined as any, {
              title: 'About GitDrop',
              message: `GitDrop Desktop v${app.getVersion()}`,
              detail: 'A modern, local-first visual Git client for developers.\nZero terminal complexity.',
              type: 'info',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
