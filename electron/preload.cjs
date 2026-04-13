const { contextBridge, clipboard, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('templateEditorDesktop', {
  copyText(text) {
    clipboard.writeText(String(text || ''))
    return true
  },
  saveSession(jsonString) {
    return ipcRenderer.invoke('save-session', jsonString)
  },
  loadSession() {
    return ipcRenderer.invoke('load-session')
  },
})
