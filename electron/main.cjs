const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#0b0f17',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ── Session persistence ───────────────────────────────────────────────────────
const SESSION_FILE = path.join(app.getPath('userData'), 'ymi-session.json')

ipcMain.handle('save-session', (_event, jsonString) => {
  try { fs.writeFileSync(SESSION_FILE, jsonString, 'utf8'); return true; }
  catch (e) { console.error('save-session error', e); return false; }
})

ipcMain.handle('load-session', () => {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    return fs.readFileSync(SESSION_FILE, 'utf8');
  } catch (e) { console.error('load-session error', e); return null; }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
