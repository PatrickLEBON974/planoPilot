const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const { createAppMenu } = require('./menu.cjs');
const { createPlanFiles } = require('./plan-files.cjs');
const path = require('node:path');
const fs = require('node:fs/promises');
const testHeadless = process.env.PLANOPILOT_TEST_HEADLESS === '1';
if (process.env.PLANOPILOT_DATA_DIR) app.setPath('userData', process.env.PLANOPILOT_DATA_DIR);
let mainWindow, allowClose = false, rendererReady = false, pendingOpen = process.argv.find(x => x.toLowerCase().endsWith('.plano'));
let updateMenuState = () => {};
const fileName = name => String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'PlanoPilot';
const planFiles = createPlanFiles({ recentPath: path.join(app.getPath('userData'), 'recent-plans.json'), chooseSavePath: async defaultPath => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Enregistrer le plan sous', defaultPath, filters: [{ name: 'Plan PlanoPilot', extensions: ['plano'] }] });
  return result.canceled ? null : result.filePath;
} });
async function atomicWrite(file, content) { await fs.mkdir(path.dirname(file), { recursive: true }); const temp = `${file}.tmp`; await fs.writeFile(temp, content, 'utf8'); await fs.rename(temp, file); }
function register(channel, fn) { ipcMain.handle(channel, (event, ...args) => { if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Accès refusé.'); return fn(...args); }); }
register('menu:update', state => updateMenuState(state));
let openFoodFactsClient;
register('open-food-facts:search', async request => {
  openFoodFactsClient ||= import('./open-food-facts.mjs').then(({ createOpenFoodFactsClient }) => {
    const network = session.fromPartition('open-food-facts-api', { cache: false });
    return createOpenFoodFactsClient({ fetcher: (...args) => network.fetch(...args), userAgent: `PlanoPilot/${app.getVersion()} (desktop product lookup)` });
  });
  return (await openFoodFactsClient)(request);
});
register('open-food-facts:open', async code => {
  const { productURL } = await import('./open-food-facts.mjs');
  await shell.openExternal(productURL(code));
});
register('project:save', (project, saveAs) => planFiles.save(project, Boolean(saveAs)));
register('project:activate', filePath => planFiles.activate(filePath));
register('project:recent-list', () => planFiles.listRecent());
register('project:recent-open', filePath => planFiles.openRecent(filePath));
register('project:recent-remove', filePath => planFiles.removeRecent(filePath));
register('project:state', state => {
  if (!state || typeof state.name !== 'string' || typeof state.dirty !== 'boolean' || typeof state.hasDocument !== 'boolean') throw new Error('État de fichier invalide.');
  mainWindow.setTitle(state.hasDocument ? `${planFiles.currentPath ? path.basename(planFiles.currentPath) : 'Sans titre'}${state.dirty ? ' *' : ''} — PlanoPilot` : 'PlanoPilot');
  mainWindow.setDocumentEdited(state.dirty);
});
register('project:initial', async () => {
  rendererReady = true;
  if (!pendingOpen) return null;
  const file = pendingOpen; pendingOpen = null;
  return planFiles.read(file);
});
register('project:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Ouvrir un plan (.plano)', filters: [{ name: 'Plan PlanoPilot', extensions: ['plano'] }], properties: ['openFile'], ...(planFiles.currentPath ? { defaultPath: planFiles.currentPath } : {}) });
  return result.canceled ? null : planFiles.read(result.filePaths[0]);
});
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
  mainWindow = new BrowserWindow({ show: false, skipTaskbar: testHeadless, width: 1600, height: 1000, minWidth: 1100, minHeight: 720, title: 'PlanoPilot', backgroundColor: '#f4f6fa', icon: path.join(__dirname, 'icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !testHeadless } });
  mainWindow.once('ready-to-show', () => { if (!testHeadless) mainWindow.show(); });
  mainWindow.setMenuBarVisibility(true);
  mainWindow.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(false));
  if (!process.env.PLANOPILOT_DEV_URL) mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const productImage = details.resourceType === 'image' && details.url.startsWith('https://images.openfoodfacts.org/images/products/');
    callback({ cancel: /^https?:/.test(details.url) && !productImage });
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  if (process.env.PLANOPILOT_DEV_URL) mainWindow.loadURL(process.env.PLANOPILOT_DEV_URL); else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.on('close', event => { if (!allowClose && !mainWindow.webContents.isDestroyed()) { event.preventDefault(); mainWindow.webContents.send('app:closing'); } });
  mainWindow.on('closed', () => { mainWindow = null; });
}
const single = app.requestSingleInstanceLock();
if (!single) app.quit(); else {
  app.on('second-instance', (_, argv) => { const file = argv.find(x => x.toLowerCase().endsWith('.plano')); if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } if (file && rendererReady && mainWindow) { planFiles.read(file).then(opened => mainWindow?.webContents.send('project:requested', opened)).catch(error => dialog.showMessageBox(mainWindow, { type: 'error', message: 'Ce plan n’a pas pu être ouvert.', detail: error.message })); } else if (file) pendingOpen = file; });
  app.whenReady().then(() => { updateMenuState = createAppMenu(() => mainWindow); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
