// 제1당 데스크톱판(스팀용) 메인 프로세스.
// - public/의 웹 게임 파일을 app://game/ 주소로 그대로 띄운다(인터넷 없이도 혼자 하기 가능).
// - 스팀이 켜져 있으면 steamworks.js로 연결해 도전과제를 연다. 스팀이 없어도 게임은 그대로 돈다.
const { app, BrowserWindow, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// 개발 중에는 저장소의 public/, 패키지에서는 앱 안의 game/ 폴더
const GAME_ROOT = app.isPackaged ? path.join(__dirname, 'game') : path.join(__dirname, '..', 'public');
const SITE = 'https://nihongodic.com';
const SMOKE = process.argv.includes('--smoke'); // 자동 점검: 창을 띄워 게임이 뜨는지만 보고 끝낸다

// 스팀 앱 ID: 환경 변수 STEAM_APP_ID > steam_appid.txt > 480(개발용 Spacewar)
function appId() {
  if (process.env.STEAM_APP_ID) return Number(process.env.STEAM_APP_ID);
  for (const p of [path.join(path.dirname(process.execPath), 'steam_appid.txt'), path.join(__dirname, 'steam_appid.txt')]) {
    try { const n = Number(fs.readFileSync(p, 'utf8').trim()); if (n) return n; } catch (e) {}
  }
  return 480;
}

let steam = null;
function initSteam() {
  try {
    const sw = require('steamworks.js');
    steam = sw.init(appId());
    sw.electronEnableSteamOverlay();
    console.log('[steam] 연결됨:', steam.localplayer.getName());
  } catch (e) {
    steam = null;
    console.log('[steam] 연결 안 됨(스팀 없이 실행):', e && e.message);
  }
}

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function serveGame() {
  protocol.handle('app', req => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(GAME_ROOT, rel));
    if (!file.startsWith(GAME_ROOT)) return new Response('forbidden', { status: 403 });
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 640,
    backgroundColor: '#11151c', autoHideMenuBar: true, show: !SMOKE,
    title: 'First Party',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  // 게임 밖 주소(사이트의 다른 도구, 개인정보처리방침 등)는 기본 브라우저로 연다.
  const outside = url => {
    if (url.startsWith('app://game/jeildang/')) return false;
    const u = new URL(url);
    shell.openExternal(u.protocol === 'app:' ? SITE + u.pathname + u.search : url);
    return true;
  };
  win.webContents.setWindowOpenHandler(({ url }) => { outside(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (outside(url)) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL('app://game/jeildang/');
  if (SMOKE) {
    win.webContents.on('console-message', e => { if (e.level === 'error') console.log('[page error]', e.message); });
    win.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2500));
      const res = await win.webContents.executeJavaScript(`({title: document.title, engine: typeof E === 'object' && typeof E.resolveRound, bridge: !!window.steamBridge, buttons: document.querySelectorAll('[data-a]').length})`);
      console.log('[smoke]', JSON.stringify(res));
      if (process.env.SMOKE_SHOT) fs.writeFileSync(process.env.SMOKE_SHOT, (await win.webContents.capturePage()).toPNG());
      app.exit(res.engine === 'function' && res.bridge ? 0 : 1);
    });
  }
}

// 페이지 → 메인: 도전과제, 상태
ipcMain.handle('steam:status', () => ({ on: !!steam, name: steam ? steam.localplayer.getName() : null }));
ipcMain.handle('steam:achieve', (_e, id) => {
  if (!steam || typeof id !== 'string' || !/^ACH_[A-Z0-9_]+$/.test(id)) return false;
  try { return steam.achievement.activate(id); } catch (e) { return false; }
});

app.whenReady().then(() => {
  initSteam();
  serveGame();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
