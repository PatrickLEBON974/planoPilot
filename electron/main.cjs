const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { createAppMenu } = require('./menu.cjs');
const path = require('node:path');
const fs = require('node:fs/promises');
if (process.env.PLANOPILOT_DATA_DIR) app.setPath('userData', process.env.PLANOPILOT_DATA_DIR);
let mainWindow, allowClose = false, rendererReady = false, pendingOpen = process.argv.find(x => x.toLowerCase().endsWith('.plano'));
let updateMenuState = () => {};
const writes = new Map();
let writeQueue = Promise.resolve();
const plansDirectory = () => path.join(app.getPath('userData'), 'plans');
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const idCheck = id => { if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Identifiant de projet invalide.'); return id; };
const fileName = name => String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'PlanoPilot';
function projectJSON(project) {
  if (!project || project.schemaVersion !== 1 || typeof project.name !== 'string' || !Array.isArray(project.products)) throw new Error('Projet invalide.');
  idCheck(project.id);
  const json = JSON.stringify(project, null, 2);
  if (json.length > 100 * 1024 * 1024) throw new Error('Le projet dépasse la taille maximale.');
  return json;
}
async function atomicWrite(file, content) { await fs.mkdir(path.dirname(file), { recursive: true }); const temp = `${file}.tmp`; await fs.writeFile(temp, content, 'utf8'); await fs.rename(temp, file); }
async function readProject(file) { const stat = await fs.stat(file); if (stat.size > 100 * 1024 * 1024) throw new Error('Fichier trop volumineux.'); return JSON.parse(await fs.readFile(file, 'utf8')); }
function register(channel, fn) { ipcMain.handle(channel, (event, ...args) => { if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Accès refusé.'); return fn(...args); }); }
register('menu:update', state => updateMenuState(state));
register('project:save', project => {
  const json = projectJSON(project), file = path.join(plansDirectory(), `${project.id}.plano`);
  const next = writeQueue.catch(() => {}).then(async () => { await atomicWrite(file, json); await atomicWrite(settingsPath(), JSON.stringify({ lastProject: project.id })); });
  writeQueue = next;
  writes.set(project.id, next); return next.finally(() => { if (writes.get(project.id) === next) writes.delete(project.id); });
});
register('project:list', async () => {
  await fs.mkdir(plansDirectory(), { recursive: true });
  const files = (await fs.readdir(plansDirectory())).filter(x => x.endsWith('.plano'));
  const results = await Promise.allSettled(files.map(async file => { const p = await readProject(path.join(plansDirectory(), file)); return { id: p.id, name: p.name, updatedAt: p.updatedAt }; }));
  return results.filter(r => r.status === 'fulfilled').map(r => r.value).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
});
register('project:load', id => readProject(path.join(plansDirectory(), `${idCheck(id)}.plano`)));
register('project:delete', async id => { await (writes.get(id) || Promise.resolve()).catch(() => {}); await fs.unlink(path.join(plansDirectory(), `${idCheck(id)}.plano`)); });
register('project:initial', async () => {
  rendererReady = true;
  if (pendingOpen) { const file = pendingOpen; pendingOpen = null; return readProject(file); }
  try { const settings = JSON.parse(await fs.readFile(settingsPath(), 'utf8')); return await readProject(path.join(plansDirectory(), `${idCheck(settings.lastProject)}.plano`)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
});
register('project:open', async () => { const result = await dialog.showOpenDialog(mainWindow, { title: 'Ouvrir un plan', filters: [{ name: 'Projet PlanoPilot', extensions: ['plano'] }], properties: ['openFile'] }); return result.canceled ? null : readProject(result.filePaths[0]); });
register('project:export', async project => { const json = projectJSON(project); const result = await dialog.showSaveDialog(mainWindow, { title: 'Exporter le projet modifiable', defaultPath: `${fileName(project.name)}.plano`, filters: [{ name: 'Projet PlanoPilot', extensions: ['plano'] }] }); if (result.canceled) return false; await atomicWrite(result.filePath, json); return true; });
register('export:pdf', async payload => {
  if (!payload || typeof payload.html !== 'string' || payload.html.length > 10 * 1024 * 1024 || !Number.isFinite(payload.width) || !Number.isFinite(payload.height) || payload.width < 500 || payload.width > 12000 || payload.height < 300 || payload.height > 10000) throw new Error('Document PDF invalide.');
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Télécharger le PDF', defaultPath: `${fileName(payload.name)}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (result.canceled) return false;
  const printWindow = new BrowserWindow({ show: false, width: Math.ceil(payload.width), height: Math.ceil(payload.height), webPreferences: { partition: `print-${Date.now()}`, javascript: false, nodeIntegration: false, contextIsolation: true, sandbox: true } });
  printWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:/.test(details.url) }));
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);
    const buffer = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: { width: payload.width / 96, height: payload.height / 96 }, margins: { top: 0, bottom: 0, left: 0, right: 0 }, preferCSSPageSize: true });
    await fs.writeFile(result.filePath, buffer); return true;
  } finally { printWindow.destroy(); }
});
register('export:image', async payload => {
  if (!payload || typeof payload.name !== 'string' || !(payload.data instanceof Uint8Array) || payload.data.length < 33 || payload.data.length > 40 * 1024 * 1024) throw new Error('Image PNG invalide.');
  const buffer = Buffer.from(payload.data);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.toString('ascii', 12, 16) !== 'IHDR' || buffer.readUInt32BE(16) > 16000 || buffer.readUInt32BE(20) > 10000 || !buffer.readUInt32BE(16) || !buffer.readUInt32BE(20)) throw new Error('Image PNG invalide.');
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Télécharger l’image du planogramme', defaultPath: `${fileName(payload.name)}.png`, filters: [{ name: 'Image PNG', extensions: ['png'] }] });
  if (result.canceled) return false;
  await atomicWrite(result.filePath, buffer); return true;
});
ipcMain.on('app:close-ready', event => { if (mainWindow && event.sender === mainWindow.webContents) { allowClose = true; mainWindow.close(); } });
function createWindow() {
  mainWindow = new BrowserWindow({ show: false, width: 1600, height: 1000, minWidth: 1100, minHeight: 720, title: 'PlanoPilot', backgroundColor: '#f4f6fa', icon: path.join(__dirname, 'icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.setMenuBarVisibility(true);
  mainWindow.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(false));
  if (!process.env.PLANOPILOT_DEV_URL) mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:/.test(details.url) }));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  if (process.env.PLANOPILOT_DEV_URL) mainWindow.loadURL(process.env.PLANOPILOT_DEV_URL); else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.on('close', event => { if (!allowClose && !mainWindow.webContents.isDestroyed()) { event.preventDefault(); mainWindow.webContents.send('app:closing'); } });
  mainWindow.on('closed', () => { mainWindow = null; });
}
const single = app.requestSingleInstanceLock();
if (!single) app.quit(); else {
  app.on('second-instance', (_, argv) => { const file = argv.find(x => x.toLowerCase().endsWith('.plano')); if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } if (file && rendererReady && mainWindow) { readProject(file).then(project => mainWindow?.webContents.send('project:requested', project)).catch(error => dialog.showMessageBox(mainWindow, { type: 'error', message: 'Ce projet n’a pas pu être ouvert.', detail: error.message })); } else if (file) pendingOpen = file; });
  app.whenReady().then(() => { updateMenuState = createAppMenu(() => mainWindow); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
