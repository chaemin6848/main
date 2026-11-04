// 페이지에 window.steamBridge를 열어 준다. 웹판에는 없으므로 게임 코드는 있을 때만 쓴다.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('steamBridge', {
  desktop: true,
  status: () => ipcRenderer.invoke('steam:status'),
  achieve: id => ipcRenderer.invoke('steam:achieve', String(id)),
});
