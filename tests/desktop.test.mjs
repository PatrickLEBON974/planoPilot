import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { demoProject, generate, newProject } from '../src/domain.ts';
import { pdfPayload } from '../src/exports.ts';
import { salesText } from '../src/format.ts';
import { startVirtualDisplay } from './virtual-display.mjs';
const testDisplay = await startVirtualDisplay();
after(() => testDisplay.close());
const require = createRequire(import.meta.url);
async function launchDesktop(options, initialFile) {
  const directory = options.env.PLANOPILOT_DATA_DIR;
  if (initialFile === undefined) {
    const fixture = path.join(directory, 'initial.plano');
    try { await fs.access(fixture); initialFile = fixture; } catch {}
  }
  const args = [...options.args];
  if (initialFile) args.push(path.isAbsolute(initialFile) ? initialFile : path.join(directory, initialFile));
  const app = await electron.launch({ ...options, args, env: { ...options.env, ...testDisplay.env } });
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    dialog.showSaveDialog = async (_, options) => ({ canceled: false, filePath: `${directory}/${options.defaultPath.split(/[\\/]/).pop()}` });
  }, directory);
  const page = await app.firstWindow();
  await page.locator('.loading-screen').waitFor({ state: 'hidden' });
  if (testDisplay.env.DISPLAY) assert.equal(await app.evaluate(() => process.env.DISPLAY), testDisplay.env.DISPLAY, 'Les tests utilisent leur écran virtuel');
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(testDisplay.visible);
  return app;
}
async function closeApp(app) {
  await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.removeAllListeners('close'); }).catch(() => {});
  await app.close().catch(() => {});
}
async function snapshotPlan(page) {
  if (!await page.locator('.app-save-status').count()) return null;
  const file = await page.locator('.app-save-status').getAttribute('title');
  return file?.endsWith('.plano') ? JSON.parse(await fs.readFile(file, 'utf8')) : null;
}
async function readPlans(directory) {
  const files = (await fs.readdir(directory)).filter(file => file.endsWith('.plano'));
  return Promise.all(files.map(async file => JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))));
}
async function readPlan(directory, id) { return (await readPlans(directory)).find(plan => plan.id === id); }
async function dismissTutorial(page) {
  await page.getByRole('dialog', { name: 'Bien démarrer avec PlanoPilot' }).waitFor();
  await page.getByRole('button', { name: 'Passer le tutoriel' }).click();
}
async function clickNativeMenu(app, id) {
  await expect.poll(() => app.evaluate(({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).enabled, id), { message: `Le menu ${id} doit être disponible` }).toBe(true);
  await app.evaluate(({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).click(), id);
}
test('fichiers .plano : enregistrement, Enregistrer sous, annulations et fermeture protégée', { timeout: 180000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-document-'));
  const original = path.join(directory, 'travail.plano'), copy = path.join(directory, 'copie.plano'), other = path.join(directory, 'autre.plano'), invalid = path.join(directory, 'invalide.plano');
  const previous = demoProject(), legacy = path.join(directory, 'plans', `${previous.id}.plano`);
  await fs.mkdir(path.dirname(legacy));
  await fs.writeFile(legacy, JSON.stringify(previous));
  await fs.writeFile(path.join(directory, 'settings.json'), JSON.stringify({ lastProject: previous.id }));
  await fs.writeFile(other, JSON.stringify({ ...demoProject(), name: 'Autre plan' }));
  await fs.writeFile(invalid, JSON.stringify({ schemaVersion: 1, name: 'Invalide', products: 'incorrect' }));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } }, null);
  try {
    const page = await app.firstWindow(), errors = []; page.on('pageerror', error => errors.push(error.message)); await dismissTutorial(page);
    await page.getByRole('button', { name: 'Explorer un exemple' }).waitFor();
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('library')), null);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('export-project')), null);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('save-as').label), 'Enregistrer sous…');
    assert.equal(await page.evaluate(() => 'listProjects' in window.plano), false);
    assert.deepEqual(JSON.parse(await fs.readFile(legacy, 'utf8')), previous);
    await clickNativeMenu(app, 'new');
    await page.getByRole('button', { name: 'Créer le plan', exact: true }).click();
    await expect(page.locator('.app-save-status')).toHaveText('Modifications non enregistrées');
    await app.evaluate(({ dialog }) => { globalThis.saveDialogs = 0; dialog.showSaveDialog = async () => { globalThis.saveDialogs++; return { canceled: true }; }; });
    await page.keyboard.press('Control+s');
    await expect.poll(() => app.evaluate(() => globalThis.saveDialogs)).toBe(1);
    await expect(page.locator('.app-save-status')).toHaveText('Modifications non enregistrées');
    assert.equal(await snapshotPlan(page), null);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => { globalThis.saveDialogs++; return { canceled: false, filePath: file }; }; }, original);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal((await snapshotPlan(page)).name, 'travail');
    assert.equal(await app.evaluate(() => globalThis.saveDialogs), 2);
    const changeWeighting = async weighted => { await page.getByRole('switch').setChecked(weighted); };
    await changeWeighting(false); await expect(page.locator('.app-save-status')).toHaveText('Modifications non enregistrées');
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toContain('*');
    await page.waitForTimeout(800);
    assert.equal(JSON.parse(await fs.readFile(original, 'utf8')).name, 'travail');
    await clickNativeMenu(app, 'undo'); await page.locator('.save-status.saved').waitFor();
    await clickNativeMenu(app, 'redo'); await page.locator('.save-status.unsaved').waitFor();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal(await app.evaluate(() => globalThis.saveDialogs), 2);
    assert.equal(JSON.parse(await fs.readFile(original, 'utf8')).weightedBySales, false);
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
    await clickNativeMenu(app, 'save-as');
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('save-as').enabled)).toBe(true);
    assert.equal(await page.locator('.app-save-status').getAttribute('title'), original);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, copy);
    await page.keyboard.press('Control+Shift+s'); await expect(page.locator('.app-save-status')).toHaveAttribute('title', copy);
    await changeWeighting(true); await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal(JSON.parse(await fs.readFile(original, 'utf8')).weightedBySales, false);
    assert.equal(JSON.parse(await fs.readFile(copy, 'utf8')).weightedBySales, true);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, invalid);
    await clickNativeMenu(app, 'open'); await page.getByText('Le plan est incomplet.', { exact: true }).waitFor();
    assert.equal(await page.locator('.app-save-status').getAttribute('title'), copy);
    await changeWeighting(false);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, other);
    await clickNativeMenu(app, 'open');
    let guard = page.getByRole('dialog', { name: 'Enregistrer les modifications ?', exact: true }); await guard.waitFor();
    await guard.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await page.locator('.app-save-status').getAttribute('title'), copy);
    await clickNativeMenu(app, 'new'); await page.getByRole('button', { name: 'Créer le plan', exact: true }).click();
    await guard.waitFor(); await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Créer un nouveau plan', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'open'); await guard.waitFor(); await guard.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('.board-toolbar h2')).toHaveAttribute('title', 'autre');
    assert.equal(JSON.parse(await fs.readFile(copy, 'utf8')).weightedBySales, false);
    assert.equal(await page.locator('.app-save-status').getAttribute('title'), other);
    await changeWeighting(false);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await guard.waitFor(); await guard.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    await clickNativeMenu(app, 'import-catalog');
    const importer = page.getByRole('dialog', { name: 'Importer vos produits et ventes', exact: true });
    await importer.locator('.file-drop input').setInputFiles('data/imports/royal-bourbon-produits-2026-10-01.csv');
    await importer.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await guard.waitFor(); await guard.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(importer).toBeVisible();
    assert.equal(await page.locator('.app-save-status').getAttribute('title'), other);
    await importer.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'demo'); await guard.waitFor(); await guard.getByRole('button', { name: 'Ne pas enregistrer', exact: true }).click();
    await page.locator('.mass-block').first().waitFor();
    await expect(page.locator('.board-toolbar')).not.toContainText('Sans titre');
    assert.equal(JSON.parse(await fs.readFile(other, 'utf8')).name, 'Autre plan');
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await guard.waitFor(); await guard.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(guard).toBeHidden();
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, path.join(directory, 'absent', 'erreur.plano'));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await guard.waitFor(); await guard.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('.app-save-status')).toHaveText('Échec de l’enregistrement');
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    assert.deepEqual(errors, []);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await guard.waitFor();
    const closed = page.waitForEvent('close');
    await guard.getByRole('button', { name: 'Ne pas enregistrer', exact: true }).click();
    await closed;
  } finally { await closeApp(app); }
});
test('nouveau plan : réglages sans nom, colonne réductible et tiroir des fichiers récents', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-recent-'));
  const alpha = path.join(directory, 'Rayon boissons.plano'), beta = path.join(directory, 'Rayon légumes.plano');
  await fs.writeFile(beta, JSON.stringify({ ...demoProject(), name: 'Ancien nom interne' }));
  let app;
  const errors = [];
  const launch = async () => {
    app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } }, null);
    const page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
    await page.locator('.loading-screen').waitFor({ state: 'hidden' }); return page;
  };
  try {
    let page = await launch(); await dismissTutorial(page);
    assert.equal(await page.locator('.settings-panel').count(), 0);
    assert.equal(await page.locator('.board-toolbar').count(), 0);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()), 'PlanoPilot');
    await clickNativeMenu(app, 'recent');
    await page.getByText('Aucun fichier récent', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Nouveau plan', exact: true }).click();
    let creator = page.getByRole('dialog', { name: 'Créer un nouveau plan', exact: true });
    assert.equal(await creator.getByRole('textbox').count(), 0);
    await creator.getByLabel('Nombre d’éléments', { exact: true }).fill('0.75');
    await expect(creator.getByRole('button', { name: 'Créer le plan', exact: true })).toBeDisabled();
    await creator.getByLabel('Nombre d’éléments', { exact: true }).fill('2.5');
    await creator.getByLabel('Tablettes', { exact: true }).selectOption('7');
    await creator.getByLabel('Unités / élément', { exact: true }).fill('13');
    await creator.getByLabel('Unités du demi-élément', { exact: true }).fill('7');
    await creator.getByLabel('Type d’implantation', { exact: true }).selectOption('blocks');
    await creator.getByLabel('Niveau de regroupement', { exact: true }).selectOption('brand');
    await creator.getByRole('switch').uncheck();
    await expect(creator.locator('.capacity-note')).toContainText('33');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720));
    await expect(creator.getByRole('button', { name: 'Créer le plan', exact: true })).toBeInViewport();
    await fs.mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/16-nouveau-plan-parametres.png' });
    await creator.getByRole('button', { name: 'Créer le plan', exact: true }).click();
    await page.locator('.settings-panel').waitFor();
    await expect(page.getByLabel('Nombre d’éléments', { exact: true })).toHaveValue('2.5');
    await expect(page.getByLabel('Tablettes', { exact: true })).toHaveValue('7');
    await expect(page.getByLabel('Unités / élément', { exact: true })).toHaveValue('13');
    await expect(page.getByLabel('Niveau de regroupement', { exact: true })).toHaveValue('brand');
    await expect(page.getByRole('switch')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Par blocs Composition libre' })).toHaveClass('chosen');
    await page.getByLabel('Unités / élément', { exact: true }).fill('14');
    const before = await page.locator('.board-card').boundingBox();
    await page.getByRole('button', { name: 'Réduire les paramètres', exact: true }).click();
    await expect(page.locator('.settings-panel')).toBeHidden();
    assert.ok((await page.locator('.board-card').boundingBox()).width > before.width + 200);
    await page.screenshot({ path: 'screenshots/17-parametres-reduits.png' });
    await page.getByRole('button', { name: 'Afficher les paramètres', exact: true }).click();
    await expect(page.getByLabel('Unités / élément', { exact: true })).toHaveValue('14');
    await page.getByRole('button', { name: 'Appliquer les paramètres', exact: true }).click();
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, alpha);
    await clickNativeMenu(app, 'save'); await page.locator('.save-status.saved').waitFor();
    const saved = JSON.parse(await fs.readFile(alpha, 'utf8'));
    assert.equal(saved.name, 'Rayon boissons'); assert.equal(saved.elements, 2.5); assert.equal(saved.shelves, 7); assert.equal(saved.unitsPerElement, 14); assert.equal(saved.viewMode, 'blocks'); assert.equal(saved.groupBy, 'brand'); assert.equal(saved.weightedBySales, false);
    await expect(page.locator('.board-toolbar h2')).toHaveAttribute('title', 'Rayon boissons');
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toBe('Rayon boissons.plano — PlanoPilot');
    await clickNativeMenu(app, 'new');
    creator = page.getByRole('dialog', { name: 'Créer un nouveau plan', exact: true });
    await creator.getByRole('button', { name: 'Créer le plan', exact: true }).click();
    await clickNativeMenu(app, 'recent');
    let drawer = page.getByRole('dialog', { name: 'Plans récents', exact: true });
    await drawer.getByRole('button', { name: /^Rayon boissons\.plano/ }).click();
    let guard = page.getByRole('dialog', { name: 'Enregistrer les modifications ?', exact: true });
    await guard.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(drawer).toBeVisible();
    await expect(page.locator('.board-toolbar')).not.toContainText('Sans titre');
    await drawer.getByRole('button', { name: /^Rayon boissons\.plano/ }).click();
    await guard.getByRole('button', { name: 'Ne pas enregistrer', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('.app-save-status')).toHaveAttribute('title', alpha);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, beta);
    await clickNativeMenu(app, 'open');
    await expect(page.locator('.board-toolbar h2')).toHaveAttribute('title', 'Rayon légumes');
    assert.equal(JSON.parse(await fs.readFile(beta, 'utf8')).name, 'Ancien nom interne');
    await page.getByRole('switch').uncheck();
    await clickNativeMenu(app, 'recent');
    drawer = page.getByRole('dialog', { name: 'Plans récents', exact: true });
    await expect(drawer.locator('.recent-file-info strong').first()).toHaveText('Rayon légumes.plano');
    await drawer.getByRole('button', { name: /^Rayon boissons\.plano/ }).click();
    await guard.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('.app-save-status')).toHaveAttribute('title', alpha);
    assert.equal(JSON.parse(await fs.readFile(beta, 'utf8')).weightedBySales, false);
    await closeApp(app); app = undefined;
    await fs.unlink(beta);
    page = await launch();
    assert.equal(await page.locator('.settings-panel').count(), 0);
    await clickNativeMenu(app, 'recent');
    drawer = page.getByRole('dialog', { name: 'Plans récents', exact: true });
    await drawer.getByText('Fichier introuvable', { exact: true }).waitFor();
    await expect(drawer.getByRole('button', { name: /^Rayon légumes\.plano/ })).toBeDisabled();
    await expect.poll(async () => {
      const box = await drawer.boundingBox(), viewportWidth = await page.evaluate(() => innerWidth);
      return Math.abs(box.x + box.width - viewportWidth);
    }).toBeLessThan(2);
    await page.screenshot({ path: 'screenshots/18-plans-recents.png' });
    await drawer.getByRole('button', { name: 'Retirer Rayon boissons.plano de la liste', exact: true }).click();
    await expect(drawer.locator('.recent-file-info strong')).toHaveText(['Rayon légumes.plano']);
    assert.deepEqual(JSON.parse(await fs.readFile(alpha, 'utf8')), saved);
    assert.deepEqual(errors, []);
  } finally { if (app) await closeApp(app); }
});
test('paramètres par défaut : menu Fichier, annulation, nouveaux plans, stockage et réouverture', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-defaults-'));
  const existingFile = path.join(directory, 'ancienne-implantation.plano'), original = demoProject();
  await fs.writeFile(existingFile, JSON.stringify(original));
  const options = { executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } };
  const first = { elements: 2.5, shelves: 5, unitsPerElement: 13, halfUnits: 7, viewMode: 'articles', groupBy: 'brand' };
  const second = { elements: 1.5, shelves: 9, unitsPerElement: 10, halfUnits: 6, viewMode: 'blocks', groupBy: 'sku' };
  let app;
  const fill = async (dialog, value) => {
    await dialog.getByLabel('Nombre d’éléments', { exact: true }).fill(String(value.elements));
    await dialog.getByLabel('Tablettes', { exact: true }).selectOption(String(value.shelves));
    await dialog.getByLabel('Unités / élément', { exact: true }).fill(String(value.unitsPerElement));
    await dialog.getByLabel('Unités du demi-élément', { exact: true }).fill(String(value.halfUnits));
    await dialog.getByLabel('Type d’implantation', { exact: true }).selectOption(value.viewMode);
    await dialog.getByLabel('Niveau de regroupement', { exact: true }).selectOption(value.groupBy);
  };
  const check = async (dialog, value) => {
    for (const [label, field] of [['Nombre d’éléments', 'elements'], ['Tablettes', 'shelves'], ['Unités / élément', 'unitsPerElement'], ['Unités du demi-élément', 'halfUnits'], ['Type d’implantation', 'viewMode'], ['Niveau de regroupement', 'groupBy']]) await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(String(value[field]));
  };
  try {
    app = await launchDesktop(options, null);
    let page = await app.firstWindow(); await dismissTutorial(page);
    assert.equal(await page.locator('.app-save-status').count(), 0);
    assert.ok(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'Fichier').submenu.items.some(item => item.id === 'preferences')));
    await clickNativeMenu(app, 'preferences');
    let preferences = page.getByRole('dialog', { name: 'Paramètres', exact: true }); await preferences.waitFor();
    await fill(preferences, first);
    await preferences.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'preferences');
    await expect(preferences.getByLabel('Nombre d’éléments', { exact: true })).toHaveValue('4');
    await expect(preferences.getByLabel('Type d’implantation', { exact: true })).toHaveValue('mass');
    await expect(preferences.getByLabel('Niveau de regroupement', { exact: true })).toHaveValue('subsegment');
    await fill(preferences, first);
    await preferences.getByLabel('Unités / élément', { exact: true }).fill('0');
    await expect(preferences.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
    await fill(preferences, first);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720));
    await fs.mkdir('screenshots', { recursive: true }); await page.screenshot({ path: 'screenshots/23-parametres-par-defaut.png' });
    const footer = await preferences.locator('.modal-footer').boundingBox();
    assert.ok(footer.y + footer.height <= await page.evaluate(() => innerHeight));
    await preferences.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await preferences.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.app-save-status').count(), 0);
    await clickNativeMenu(app, 'new');
    let create = page.getByRole('dialog', { name: 'Créer un nouveau plan', exact: true }); await check(create, first);
    await create.getByLabel('Type d’implantation', { exact: true }).selectOption('mass');
    await create.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'new'); await check(create, first);
    await create.getByRole('button', { name: 'Créer le plan', exact: true }).click();
    await page.locator('.save-status.unsaved').waitFor();
    await clickNativeMenu(app, 'save'); await page.locator('.save-status.saved').waitFor();
    const created = await snapshotPlan(page);
    for (const key of Object.keys(first)) assert.equal(created[key], first[key]);
    await clickNativeMenu(app, 'preferences'); await fill(preferences, second);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.restoreDefaultStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(key, value) { if (key === 'planopilot:plan-defaults:v1') throw new DOMException('Storage unavailable', 'QuotaExceededError'); return original.call(this, key, value); };
    });
    await preferences.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(preferences.getByRole('alert')).toHaveText('Les paramètres n’ont pas pu être enregistrés. Réessayez.');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('planopilot:plan-defaults:v1'))), first);
    await page.evaluate(() => window.restoreDefaultStorage());
    await preferences.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await preferences.waitFor({ state: 'hidden' });
    await expect(page.locator('.save-status.saved')).toBeVisible();
    await expect(page.locator('.settings-panel').getByLabel('Niveau de regroupement', { exact: true })).toHaveValue('brand');
    assert.deepEqual(await snapshotPlan(page), created);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, existingFile);
    await clickNativeMenu(app, 'open');
    await expect(page.locator('.board-toolbar h2')).toHaveAttribute('title', 'ancienne-implantation');
    await expect(page.locator('.settings-panel').getByLabel('Niveau de regroupement', { exact: true })).toHaveValue(original.groupBy);
    await expect(page.locator('.save-status.saved')).toBeVisible();
    assert.deepEqual(JSON.parse(await fs.readFile(existingFile, 'utf8')), original);
    await closeApp(app); app = undefined;
    app = await launchDesktop(options, null); page = await app.firstWindow();
    await clickNativeMenu(app, 'preferences'); preferences = page.getByRole('dialog', { name: 'Paramètres', exact: true }); await check(preferences, second);
    await preferences.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'new'); create = page.getByRole('dialog', { name: 'Créer un nouveau plan', exact: true }); await check(create, second);
    await create.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'import-catalog');
    await page.locator('.file-drop input').setInputFiles({ name: 'catalogue.csv', mimeType: 'text/csv', buffer: Buffer.from('Référence;Désignation;Marque;Segment;Sous-segment\nDEF-1;Produit A;Marque A;Épicerie;Conserves\nDEF-2;Produit B;Marque B;Épicerie;Conserves\n') });
    await page.getByText('2 lignes prêtes à être importées').waitFor();
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await page.locator('.catalogue-notice').waitFor();
    await clickNativeMenu(app, 'save'); await page.locator('.save-status.saved').waitFor();
    const imported = await snapshotPlan(page);
    for (const key of Object.keys(second)) assert.equal(imported[key], second[key]);
    assert.equal(imported.salesMetric, 'catalog'); assert.equal(imported.products.length, 2);
  } finally { if (app) await closeApp(app); }
});
test('paramètres : sélecteurs sans recalcul, régénération manuelle, annulation et historique', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-manual-settings-'));
  const products = [
    { id: 'a', sku: 'A', name: 'Jus pomme', brand: 'Marque A', segment: 'Boissons', subsegment: 'Jus', sales: 100, ours: true },
    { id: 'b', sku: 'B', name: 'Jus orange', brand: 'Marque B', segment: 'Boissons', subsegment: 'Jus', sales: 50, ours: false },
    { id: 'c', sku: 'C', name: 'Riz', brand: 'Marque A', segment: 'Épicerie', subsegment: 'Riz', sales: 30, ours: true },
    { id: 'd', sku: 'D', name: 'Pâtes', brand: 'Marque B', segment: 'Épicerie', subsegment: 'Pâtes', sales: 20, ours: null },
  ];
  const original = generate({ ...newProject(), elements: 2, sourceName: 'ventes.csv', products });
  await fs.writeFile(path.join(directory, 'initial.plano'), JSON.stringify(original));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(), errors = []; page.on('pageerror', error => errors.push(error.message)); await dismissTutorial(page);
    const panel = page.locator('.settings-panel');
    assert.equal(await panel.locator('.step-number').count(), 0);
    assert.equal(await page.getByText('Données locales', { exact: true }).count(), 0);
    const units = page.locator('.group-card-footer input').first(), count = Number(await units.inputValue());
    await units.fill(String(count - 1)); await units.press('Tab');
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const manual = await snapshotPlan(page), layout = await page.locator('.shelf-board').innerHTML();
    await panel.getByLabel('Niveau de regroupement', { exact: true }).selectOption('brand');
    await panel.getByLabel('Périmètre à implanter', { exact: true }).selectOption('Boissons');
    await panel.getByLabel('Tablettes', { exact: true }).selectOption('8');
    await panel.getByLabel('Nombre d’éléments', { exact: true }).fill('3.5');
    await panel.getByLabel('Unités / élément', { exact: true }).fill('5');
    await panel.getByLabel('Unités du demi-élément', { exact: true }).fill('2');
    await expect(panel.locator('.pending-settings')).toBeVisible();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator('.shelf-board').innerHTML(), layout);
    await expect(page.locator('.shelf-numbers span')).toHaveCount(6);
    await expect(page.locator('.save-status.saved')).toBeVisible();
    await expect(page.locator('.plan-context')).toContainText('Par sous-segments');
    await page.keyboard.press('Control+s');
    await expect.poll(() => snapshotPlan(page)).toEqual(manual);
    await panel.getByRole('button', { name: 'Régénérer le plan', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Recalculer l’implantation ?', exact: true });
    await confirmation.getByRole('button', { name: 'Conserver mon plan', exact: true }).click();
    assert.equal(await page.locator('.shelf-board').innerHTML(), layout);
    await page.getByRole('button', { name: 'Réduire les paramètres', exact: true }).click();
    await page.getByRole('button', { name: 'Afficher les paramètres', exact: true }).click();
    await expect(panel.getByLabel('Niveau de regroupement', { exact: true })).toHaveValue('brand');
    await expect(panel.getByLabel('Périmètre à implanter', { exact: true })).toHaveValue('Boissons');
    await panel.getByRole('button', { name: 'Régénérer le plan', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Recalculer le plan', exact: true }).click();
    await expect(page.locator('.shelf-numbers span')).toHaveCount(8);
    await expect(page.locator('.plan-context')).toContainText('Par marques');
    await expect(panel.locator('.pending-settings')).toHaveCount(0);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const regenerated = await snapshotPlan(page);
    assert.equal(regenerated.groupBy, 'brand'); assert.equal(regenerated.targetSegment, 'Boissons');
    assert.equal(regenerated.shelves, 8); assert.equal(regenerated.elements, 3.5); assert.equal(regenerated.unitsPerElement, 5); assert.equal(regenerated.halfUnits, 2);
    assert.deepEqual(regenerated.products, manual.products);
    assert.equal(Object.values(regenerated.massUnits).reduce((total, width) => total + width, 0), 17);
    assert.ok(regenerated.articlePlacements.every(article => ['a', 'b'].includes(article.productId)));
    await clickNativeMenu(app, 'undo');
    await expect(panel.getByLabel('Niveau de regroupement', { exact: true })).toHaveValue(manual.groupBy);
    await expect(panel.getByLabel('Tablettes', { exact: true })).toHaveValue(String(manual.shelves));
    assert.equal(await page.locator('.shelf-board').innerHTML(), layout);
    await clickNativeMenu(app, 'redo');
    await expect(panel.getByLabel('Niveau de regroupement', { exact: true })).toHaveValue('brand');
    await expect(panel.getByLabel('Tablettes', { exact: true })).toHaveValue('8');
    await panel.getByLabel('Unités / élément', { exact: true }).fill('0');
    await expect(panel.getByRole('button', { name: 'Régénérer le plan', exact: true })).toBeDisabled();
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('generate').enabled)).toBe(false);
    await panel.getByLabel('Unités / élément', { exact: true }).fill('6');
    await panel.getByLabel('Niveau de regroupement', { exact: true }).selectOption('segment');
    await panel.getByLabel('Périmètre à implanter', { exact: true }).selectOption('');
    await panel.getByLabel('Tablettes', { exact: true }).selectOption('4');
    await clickNativeMenu(app, 'generate');
    await confirmation.getByRole('button', { name: 'Recalculer le plan', exact: true }).click();
    await expect(page.locator('.shelf-numbers span')).toHaveCount(4);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const fromMenu = await snapshotPlan(page);
    assert.equal(fromMenu.groupBy, 'segment'); assert.equal(fromMenu.targetSegment, ''); assert.equal(fromMenu.unitsPerElement, 6); assert.equal(fromMenu.shelves, 4);
    assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
});
test('fermer avec Enregistrer écrit les modifications dans le fichier ouvert', { timeout: 60000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-close-save-')), file = path.join(directory, 'initial.plano');
  await fs.writeFile(file, JSON.stringify(demoProject()));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page);
    await page.getByRole('switch').uncheck();
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => { throw new Error('Le fichier ouvert doit être réécrit directement'); }; });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    const guard = page.getByRole('dialog', { name: 'Enregistrer les modifications ?', exact: true }); await guard.waitFor();
    const closed = page.waitForEvent('close');
    await guard.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await closed;
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).weightedBySales, false);
  } finally { await closeApp(app); }
});
test('bureau : double-clic, édition annulable, collisions et menus natifs', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-edit-menu-'));
  const p = demoProject();
  await fs.writeFile(path.join(directory, 'initial.plano'), JSON.stringify(p));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(), errors = []; page.on('pageerror', error => errors.push(error.message)); await dismissTutorial(page);
    assert.deepEqual(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(item => item.label)), ['Fichier', 'Édition', 'Affichage', 'Outils', 'Aide']);
    assert.equal(await page.locator('.workspace-header, .breadcrumb').count(), 0);
    await expect(page.locator('.board-toolbar h2')).toContainText('initial');
    for (const selector of ['.nav-library', '.workspace-actions', '.history-actions', '.board-tools', '.composer-settings', '.content-heading > button', '.avatar']) assert.equal(await page.locator(selector).count(), 0, `Doublon retiré : ${selector}`);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('imports')), null);
    assert.deepEqual(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'Fichier').submenu.items.filter(item => item.id?.startsWith('import-')).map(item => item.id)), ['import-sales', 'import-catalog']);
    assert.deepEqual(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('exports').submenu.items.map(item => item.id)), ['export-pdf', 'export-image', 'export-csv']);
    assert.equal(await page.locator('.right-panel').count(), 0);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('undo').enabled), false);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('zoom-out').enabled), false);
    await expect(page.locator('.unit-line')).toHaveCount(47);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-grid').checked), true);
    await clickNativeMenu(app, 'toggle-grid'); await expect(page.locator('.unit-line')).toHaveCount(0);
    await clickNativeMenu(app, 'toggle-grid'); await expect(page.locator('.unit-line')).toHaveCount(47);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-grid').checked), true);
    for (let i = 0; i < 8; i++) await clickNativeMenu(app, 'zoom-in');
    await expect(page.locator('.board-view-status')).toHaveText('300 % · Grille affichée');
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('zoom-in').enabled)).toBe(false);
    await clickNativeMenu(app, 'zoom-out'); await expect(page.locator('.board-view-status')).toHaveText('275 % · Grille affichée');
    await clickNativeMenu(app, 'zoom-reset'); await clickNativeMenu(app, 'toggle-grid');
    await expect(page.locator('.board-view-status')).toHaveText('100 %');
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('undo').enabled), false);
    await page.locator('.mass-block').first().click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator('.mass-block.selected').count(), 1);
    await clickNativeMenu(app, 'edit-selection');
    let editor = page.getByRole('dialog', { name: 'Modifier la descente', exact: true }); await editor.waitFor();
    await expect(editor.getByRole('button', { name: 'Appliquer', exact: true })).toBeDisabled();
    await expect(editor.getByLabel('Unités attribuées')).toBeFocused();
    await expect(editor.getByRole('img', { name: 'Aperçu de l’élément sélectionné dans le meuble' })).toBeVisible();
    const initialUnits = Number(await editor.getByLabel('Unités attribuées').inputValue());
    await editor.getByLabel('Unités attribuées').fill(String(initialUnits - 1));
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('delete').enabled), false);
    await editor.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(Number(await page.locator('.group-card-footer input').first().inputValue()), initialUnits);
    await page.locator('.mass-block').first().dblclick(); await editor.waitFor();
    await editor.locator('.edit-reference-details > summary').click();
    await editor.getByRole('button', { name: /Voir \d+ autres références/ }).click();
    assert.equal(await editor.isVisible(), true);
    await editor.getByLabel('Unités attribuées').fill(String(initialUnits - 1));
    await editor.getByRole('button', { name: 'Appliquer', exact: true }).click();
    assert.equal(Number(await page.locator('.group-card-footer input').first().inputValue()), initialUnits - 1);
    await clickNativeMenu(app, 'undo');
    await expect(page.locator('.group-card-footer input').first()).toHaveValue(String(initialUnits));
    await clickNativeMenu(app, 'redo');
    await expect(page.locator('.group-card-footer input').first()).toHaveValue(String(initialUnits - 1));
    await clickNativeMenu(app, 'generate');
    await page.getByRole('dialog', { name: 'Recalculer l’implantation ?' }).waitFor();
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('generate').enabled), false);
    await page.getByRole('button', { name: 'Recalculer le plan', exact: true }).click();
    await expect(page.locator('.group-card-footer input').first()).toHaveValue(String(initialUnits));
    await clickNativeMenu(app, 'undo');
    await expect(page.locator('.group-card-footer input').first()).toHaveValue(String(initialUnits - 1));
    await page.getByRole('button', { name: 'Par blocs Composition libre' }).click();
    await clickNativeMenu(app, 'compose-block');
    await page.getByRole('dialog', { name: 'Composer un bloc', exact: true }).waitFor();
    await expect(page.getByLabel('Largeur en unités', { exact: true })).toHaveValue('4');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.locator('.plan-block').first().dblclick();
    editor = page.getByRole('dialog', { name: 'Modifier le bloc', exact: true }); await editor.waitFor();
    const width = Number(await editor.getByLabel('Largeur du bloc').inputValue());
    const height = await editor.getByLabel('Hauteur du bloc').inputValue();
    await editor.getByLabel('Hauteur du bloc').fill(String(p.shelves));
    assert.equal(await editor.getByRole('button', { name: 'Appliquer', exact: true }).isDisabled(), true);
    assert.match(await editor.getByRole('alert').textContent(), /occupé ou sort du meuble/);
    await editor.getByLabel('Hauteur du bloc').fill(height);
    await editor.getByLabel('Largeur du bloc').fill(String(width - 1));
    await expect(editor.locator('.edit-preview-caption')).toContainText(`${(width - 1) * Number(height)} cases`);
    await editor.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    let saved = await snapshotPlan(page);
    assert.equal(saved.blockPlacements[0].width, width - 1);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    saved = await snapshotPlan(page); assert.equal(saved.blockPlacements[0].width, width);
    await page.locator('.plan-block').first().click();
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('rename')), null);
    await page.keyboard.press('F2'); assert.equal(await page.getByRole('dialog').count(), 0);
    await clickNativeMenu(app, 'new');
    const units = page.getByRole('dialog').getByLabel('Unités / élément'); await units.fill('12'); await units.press('Home'); await units.press('Delete');
    assert.equal(await units.inputValue(), '2');
    assert.equal(await page.locator('.plan-block').count(), p.blockPlacements.length);
    await units.press('Escape');
    await expect(page.locator('.board-toolbar h2')).toContainText('initial');
    await page.locator('.plan-block').first().dblclick(); await editor.waitFor();
    await fs.mkdir('screenshots', { recursive: true }); await page.screenshot({ path: 'screenshots/14-edition-modal.png' });
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'À l’article Référence par référence' }).click();
    await page.locator('.article-block').first().dblclick();
    const articleEditor = page.getByRole('dialog', { name: 'Modifier l’article', exact: true }); await articleEditor.waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720));
    const editFooter = await articleEditor.locator('.edit-footer').boundingBox();
    assert.ok(editFooter.y + editFooter.height <= await page.evaluate(() => innerHeight));
    const reference = await articleEditor.getByLabel('Référence associée').inputValue();
    await articleEditor.getByLabel('Colonne de départ').fill('49');
    assert.equal(await articleEditor.getByRole('button', { name: 'Appliquer', exact: true }).isDisabled(), true);
    await articleEditor.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.ok(p.products.some(product => product.id === reference));
    await clickNativeMenu(app, 'catalog-resources');
    await page.getByRole('dialog', { name: 'Modèles d’import CSV', exact: true }).waitFor();
    await page.getByRole('dialog', { name: 'Modèles d’import CSV', exact: true }).locator('.modal-footer').getByRole('button', { name: 'Fermer', exact: true }).click();
    await clickNativeMenu(app, 'new'); await page.getByRole('dialog', { name: 'Créer un nouveau plan' }).waitFor();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'demo'); await page.getByRole('dialog', { name: 'Enregistrer les modifications ?' }).waitFor();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720));
    await clickNativeMenu(app, 'shortcuts');
    await page.getByRole('dialog', { name: 'À portée de clavier' }).waitFor();
    const footer = await page.locator('.modal-footer').boundingBox();
    assert.ok(footer.y + footer.height <= await page.evaluate(() => innerHeight), 'Les raccourcis gardent leur bouton de fermeture visible');
    await page.getByRole('button', { name: 'Compris' }).click();
    assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
});
test('panneau de droite : masqué par défaut, menu et préférence conservée', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-panel-'));
  let app;
  const launch = async (initialFile) => {
    app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } }, initialFile);
    const page = await app.firstWindow(); await page.locator('.loading-screen').waitFor({ state: 'hidden' }); return page;
  };
  try {
    let page = await launch(); await dismissTutorial(page);
    assert.equal(await page.locator('.right-panel').count(), 0);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('save-as').enabled), false);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('exports').enabled), false);
    for (const id of ['generate', 'compose-block', 'export-pdf', 'export-image', 'export-csv', 'toggle-grid', 'zoom-in']) assert.equal(await app.evaluate(({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).enabled, id), false);
    await clickNativeMenu(app, 'import-sales');
    await expect(page.getByLabel('Mesure des ventes')).toHaveValue('revenue');
    await page.locator('.file-drop input').setInputFiles('data/imports/royal-bourbon-produits-2026-10-01.csv');
    await expect(page.getByLabel('Mesure des ventes')).toHaveValue('revenue');
    await expect(page.getByRole('button', { name: 'Importer les données', exact: true })).toBeDisabled();
    await page.getByLabel('Mesure des ventes').selectOption('catalog');
    await page.getByText('72 lignes prêtes à être importées').waitFor();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'import-catalog');
    await page.getByText('Pour un catalogue, le produit, la marque et le segment suffisent.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clickNativeMenu(app, 'demo');
    await clickNativeMenu(app, 'toggle-panel');
    await page.locator('.right-panel').waitFor();
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-panel').checked), true);
    await page.locator('.mass-block').first().click(); assert.equal(await page.locator('.inspector').count(), 0);
    await page.getByRole('textbox', { name: 'Rechercher une référence' }).fill('REF-1001');
    await page.getByText('1 références · classées par ventes', { exact: true }).waitFor();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    await closeApp(app); app = undefined;
    page = await launch(null); assert.equal(await page.locator('.right-panel').count(), 0);
    assert.equal(await page.locator('.settings-panel').count(), 0);
    await closeApp(app); app = undefined;
    page = await launch('Sans titre.plano'); await page.locator('.right-panel').waitFor();
    await clickNativeMenu(app, 'toggle-panel'); await page.locator('.right-panel').waitFor({ state: 'hidden' });
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-panel').checked), false);

    await page.screenshot({ path: 'screenshots/15-panneau-masque.png' });
    await closeApp(app); app = undefined;
    page = await launch(); assert.equal(await page.locator('.right-panel').count(), 0);
  } finally { if (app) await closeApp(app); }
});
test('cartes de regroupement : contenu, ventes cumulées, références répétées et trois modes', { timeout: 120000 }, async () => {
  for (const metric of ['revenue', 'units', 'catalog']) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-group-contents-'));
    const products = [
      { id: 'a', sku: 'ABR', name: 'Jus abricot', segment: 'Ceres', sales: 100 },
      { id: 'a-repeat', sku: 'ABR', name: 'Jus abricot', segment: 'Ceres', sales: 50 },
      { id: 'b', sku: 'POM', name: 'Jus pomme', segment: 'Ceres', sales: 0 },
      { id: 'c', sku: 'CLE', name: 'Jus clémentine', segment: 'Albius', sales: 250 },
      { id: 'd', sku: 'ORA', name: 'Jus orange', segment: 'Albius', sales: 100 },
    ].map(product => ({ ...product, brand: product.segment, subsegment: 'Jus', ours: null, sales: metric === 'catalog' ? 0 : product.sales }));
    const p = generate({ ...newProject(), name: 'Composition des jus', groupBy: 'segment', salesMetric: metric, weightedBySales: metric !== 'catalog', products });
    await fs.writeFile(path.join(directory, 'initial.plano'), JSON.stringify(p));
    const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
    const errors = [];
    try {
      const page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message)); await dismissTutorial(page);
      const ceres = page.locator('.group-card').filter({ has: page.getByRole('heading', { name: 'Ceres', exact: true }) });
      assert.equal(await ceres.locator('.group-content-list > li').count(), 2);
      const apricot = ceres.locator('.group-content-list > li').filter({ hasText: 'Jus abricot' });
      assert.equal(await apricot.count(), 1);
      if (metric !== 'catalog') {
        assert.equal(await apricot.locator('.group-content-stats > span').first().textContent(), salesText(150, metric));
        assert.match(await apricot.textContent(), /100,0 % des ventes du groupe/);
        assert.match(await ceres.locator('.group-content-list > li').filter({ hasText: 'Jus pomme' }).textContent(), /0,0 % des ventes du groupe/);
      } else {
        assert.match(await ceres.locator('.group-sales').textContent(), /Non renseigné/);
        assert.equal(await ceres.locator('.group-content-stats').count(), 0);
      }
      await clickNativeMenu(app, 'create-group');
      await page.getByRole('textbox', { name: 'Nom du regroupement' }).fill('Tous les jus');
      await page.locator('.member-list input').nth(0).check(); await page.locator('.member-list input').nth(1).check();
      await page.getByRole('button', { name: 'Créer le regroupement', exact: true }).click();
      const card = page.locator('.group-card').filter({ has: page.getByRole('heading', { name: 'Tous les jus', exact: true }) });
      assert.equal(await card.locator('.group-contents-heading').textContent(), 'Regroupement de 2 segments');
      assert.match(await card.locator('.group-sales').textContent(), /4 références/);
      const memberList = card.locator('.group-contents > .group-content-list');
      assert.equal(await memberList.locator('li').count(), 2);
      for (const [label, sales, share] of [['Ceres', 150, '30,0'], ['Albius', 350, '70,0']]) {
        const member = memberList.locator('li').filter({ hasText: label });
        assert.match(await member.textContent(), /2 références/);
        if (metric !== 'catalog') {
          assert.equal(await member.locator('.group-content-stats > span').first().textContent(), salesText(sales, metric));
          assert.ok((await member.textContent()).includes(`${share} % des ventes du groupe`));
        }
      }
      await card.locator('.group-reference-details > summary').click();
      assert.equal(await card.locator('.group-reference-details li').count(), 3);
      const more = card.getByRole('button', { name: 'Voir 1 autre référence', exact: true });
      await more.click(); assert.equal(await card.locator('.group-reference-details li').count(), 4);
      assert.equal(await card.getByRole('button', { name: 'Réduire la liste' }).getAttribute('aria-expanded'), 'true');
      for (const mode of ['Par blocs Composition libre', 'À l’article Référence par référence', 'En descente Toute la hauteur']) {
        await page.getByRole('button', { name: mode, exact: true }).click();
        assert.equal(await memberList.locator('li').count(), 2);
        assert.ok((await card.locator('.group-sales').textContent()).includes(salesText(metric === 'catalog' ? 0 : 500, metric)));
        if (metric === 'catalog') assert.equal(await card.locator('.group-content-stats').count(), 0);
      }
      await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
      const saved = await snapshotPlan(page);
      assert.deepEqual(saved.products, p.products);
      assert.equal(saved.customGroups.length, 1);
      if (metric === 'revenue') {
        await card.scrollIntoViewIfNeeded();
        await fs.mkdir('screenshots', { recursive: true });
        await page.screenshot({ path: 'screenshots/12-contenu-regroupement.png' });
      }
      assert.deepEqual(errors, []);
    } finally { await closeApp(app); }
  }
});
test('export PNG : trois modes, plan complet hors écran, annulation et plan inchangé', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-image-'));
  const p = demoProject();
  p.blockPlacements[0] = { ...p.blockPlacements[0], groupId: null, label: 'Promotion', color: '#d2387c' };
  await fs.writeFile(path.join(directory, 'initial.plano'), JSON.stringify(p));
  const errors = [];
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message)); await dismissTutorial(page);
    await page.locator('.mass-block').first().waitFor();
    const projectBefore = await snapshotPlan(page);
    async function savePNG(name) {
      const file = path.join(directory, name);
      if (await page.locator('.toast').count()) await page.locator('.toast .icon-button').click();
      await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async (_, options) => { globalThis.imageDialog = options; return { canceled: false, filePath: file }; }; }, file);
      await clickNativeMenu(app, 'export-image');
      await page.getByText('L’image PNG a été enregistrée.', { exact: true }).waitFor();
      const bytes = await fs.readFile(file);
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      const decoded = await app.evaluate(({ nativeImage }, file) => { const image = nativeImage.createFromPath(file); return { empty: image.isEmpty(), ...image.getSize(), dialog: globalThis.imageDialog }; }, file);
      assert.equal(decoded.empty, false); assert.ok(decoded.width >= 2880); assert.ok(decoded.height > 1000);
      assert.ok(decoded.dialog.defaultPath.endsWith('.png')); assert.deepEqual(decoded.dialog.filters[0].extensions, ['png']);
      return { file, bytes };
    }
    const mass = await savePNG('descente.png');
    await page.locator('.mass-block').first().click();
    await clickNativeMenu(app, 'zoom-in');
    await clickNativeMenu(app, 'zoom-in');
    await clickNativeMenu(app, 'toggle-grid');
    await page.locator('.board-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const zoomed = await savePNG('descente-zoom.png');
    assert.deepEqual(zoomed.bytes, mass.bytes);
    assert.deepEqual(await snapshotPlan(page), projectBefore);
    await fs.copyFile(mass.file, 'screenshots/planogramme-export.png');

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await page.getByRole('button', { name: 'Par blocs Composition libre' }).click();
    const blocks = await savePNG('blocs.png');
    assert.notDeepEqual(blocks.bytes, mass.bytes);
    await clickNativeMenu(app, 'zoom-reset');
    await page.screenshot({ path: 'screenshots/11-bouton-export-image.png' });
    assert.equal(await page.locator('.board-image-button').count(), 0);
    await page.getByRole('button', { name: 'À l’article Référence par référence' }).click();
    const articles = await savePNG('articles.png');
    assert.notDeepEqual(articles.bytes, mass.bytes);
    assert.notDeepEqual(articles.bytes, blocks.bytes);

    await page.locator('.toast .icon-button').click();
    const cancelled = path.join(directory, 'annule.png');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: file }); }, cancelled);
    await clickNativeMenu(app, 'export-image');
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('export-image').enabled)).toBe(true);
    await assert.rejects(fs.access(cancelled));
    assert.equal(await page.locator('.toast').count(), 0);
    await assert.rejects(page.evaluate(() => window.plano.exportImage({ name: 'invalid', data: new Uint8Array(40) })), /Image PNG invalide/);
    assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
});
test('modèles CSV : téléchargement, import d’un catalogue externe dans un nouveau plan et réouverture', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-catalogue-'));
  let app;
  const errors = [], network = [];
  const launch = async (initialFile) => {
    app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } }, initialFile);
    const page = await app.firstWindow();
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.locator('.loading-screen').waitFor({ state: 'hidden' });
    return page;
  };
  try {
    let page = await launch(); await dismissTutorial(page);
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await clickNativeMenu(app, 'save'); await page.locator('.save-status.saved').waitFor();
    const original = await snapshotPlan(page);
    await clickNativeMenu(app, 'catalog-resources');
    const settings = page.getByRole('dialog', { name: 'Modèles d’import CSV', exact: true }); await settings.waitFor();
    await fs.mkdir('screenshots', { recursive: true }); await page.screenshot({ path: 'screenshots/08-parametres-import.png' });
    const downloadTemplate = async (label, filename) => {
      const csvPath = path.join(directory, filename);
      await app.evaluate(({ BrowserWindow }, file) => {
        globalThis.catalogueDownload = new Promise(resolve => {
          BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_, item) => {
            item.setSavePath(file);
            item.once('done', (_, state) => resolve({ state, name: item.getFilename() }));
          });
        });
      }, csvPath);
      await settings.getByRole('button', { name: label, exact: true }).click();
      const downloaded = await app.evaluate(() => globalThis.catalogueDownload);
      assert.equal(downloaded.state, 'completed'); assert.equal(downloaded.name, filename);
      return fs.readFile(csvPath, 'utf8');
    };
    const template = await downloadTemplate('Télécharger le modèle catalogue', 'modele-catalogue.csv');
    assert.equal(template.replace(/^\ufeff/, ''), 'Référence;Désignation;Marque;Segment;Sous-segment;Conditionnement;Fournisseur;Source;Notes;Référence interne\r\n');
    const salesTemplate = await downloadTemplate('Télécharger le modèle ventes', 'modele-ventes.csv');
    assert.match(salesTemplate, /Chiffre d’affaires;Quantité;Référence interne/);
    await settings.locator('.modal-footer').getByRole('button', { name: 'Fermer', exact: true }).click();
    const externalFile = { name: 'catalogue-fournisseur.csv', mimeType: 'text/csv', buffer: Buffer.from(template + 'CAT-1;Jus de pomme;Marque A;Boissons;Jus;1 L;Fournisseur A;https://example.org/pomme;;Oui\r\nCAT-2;Jus d’orange;Marque B;Boissons;Jus;1 L;Fournisseur B;https://example.org/orange;;Non\r\nCAT-3;Riz;Marque C;Épicerie;Céréales;1 kg;Fournisseur C;https://example.org/riz;;\r\n') };
    await clickNativeMenu(app, 'import-catalog');
    await page.locator('.file-drop input').setInputFiles(externalFile);
    await page.getByText('3 lignes prêtes à être importées').waitFor();
    assert.equal(await page.getByLabel('Mesure des ventes').inputValue(), 'catalog');
    assert.equal(await page.getByLabel('Destination de l’import').inputValue(), 'new');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.deepEqual(await readPlan(directory, original.id), original);
    await clickNativeMenu(app, 'import-catalog');
    await page.locator('.file-drop input').setInputFiles(externalFile);
    await page.getByText('3 lignes prêtes à être importées').waitFor();
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await page.locator('.catalogue-notice').waitFor();
    const drinks = page.locator('.group-card').filter({ has: page.getByRole('heading', { name: 'Jus', exact: true }) });
    assert.equal(await drinks.locator('.group-content-list > li').count(), 2);
    assert.ok((await drinks.locator('.group-contents').textContent()).includes('Jus de pomme'));
    assert.ok((await drinks.locator('.group-contents').textContent()).includes('Jus d’orange'));
    assert.equal(await drinks.locator('.group-content-stats').count(), 0);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, path.join(directory, 'catalogue-fournisseur.plano'));
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal(await page.getByRole('switch').isDisabled(), true);
    const plans = await readPlans(directory);
    assert.equal(plans.length, 2);
    const catalogue = await readPlan(directory, plans.find(p => p.id !== original.id).id);
    assert.equal(catalogue.name, 'catalogue-fournisseur');
    assert.equal(catalogue.products.length, 3); assert.equal(catalogue.salesMetric, 'catalog'); assert.equal(catalogue.weightedBySales, false);
    assert.ok(catalogue.products.every(p => p.sales === 0 && p.sourceUrl && p.supplier));
    assert.deepEqual(catalogue.products.map(p => p.ours), [true, false, null]);
    assert.deepEqual(await readPlan(directory, original.id), original);
    await page.screenshot({ path: 'screenshots/09-catalogue-externe.png' });
    await closeApp(app); app = undefined;
    page = await launch('catalogue-fournisseur.plano'); await page.locator('.catalogue-notice').waitFor();
    const reopened = await snapshotPlan(page);
    assert.deepEqual(reopened.products, catalogue.products); assert.equal(reopened.salesMetric, 'catalog');
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
  } finally { if (app) await closeApp(app); }
});
test('Open Food Facts : recherche, consultation, ajout sans ventes inventées, doublons et annulation', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-off-'));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await dismissTutorial(page);
    const fixture = { code: '3017620422003', product_name: 'Produit de test', brands: ['Marque A'], quantity: '400 g', categories: 'Épicerie, Conserves', nutriscore_grade: 'a' };
    await app.evaluate(({ session, shell }, fixture) => {
      globalThis.offRequests = []; globalThis.offLinks = []; globalThis.offUnavailable = true;
      shell.openExternal = async url => { globalThis.offLinks.push(url); };
      globalThis.fetch = async () => { throw new Error('La recherche ne doit pas utiliser le transport Node.'); };
      session.fromPartition('open-food-facts-api', { cache: false }).fetch = async (value, options) => {
        const url = new URL(value), body = options.body ? JSON.parse(options.body) : null;
        globalThis.offRequests.push({ url: value, method: options.method, body, userAgent: options.headers['User-Agent'] });
        const query = body?.q;
        if (query === 'panne') throw new TypeError('offline');
        if (query === 'service' && globalThis.offUnavailable) { globalThis.offUnavailable = false; return new Response('', { status: 503 }); }
        const data = query === 'inconnu' ? { count: 0, hits: [] } : url.pathname.includes('/product/') ? { status: 'success', product: fixture } : { count: query === 'service' ? 10000 : 21, is_count_exact: query !== 'service', hits: [body.page === 2 ? { ...fixture, code: '3017620422004', product_name: 'Autre produit' } : fixture] };
        return new Response(JSON.stringify(data));
      };
    }, fixture);
    await clickNativeMenu(app, 'off-search');
    let tool = page.getByRole('dialog', { name: 'Rechercher sur Open Food Facts', exact: true }); await tool.waitFor();
    await expect(tool.getByRole('button', { name: 'Rechercher', exact: true })).toBeDisabled();
    await tool.getByLabel('Nom, marque ou code-barres').fill('tomates');
    assert.equal(await app.evaluate(() => globalThis.offRequests.length), 0);
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await tool.getByText('21 résultats', { exact: true }).waitFor();
    await tool.getByRole('button', { name: /Produit de test/ }).click();
    await tool.getByRole('button', { name: 'Voir la fiche sur Open Food Facts' }).click();
    await expect.poll(() => app.evaluate(() => globalThis.offLinks)).toEqual(['https://world.openfoodfacts.org/product/3017620422003']);
    await tool.getByRole('button', { name: 'Ajouter à l’assortiment…', exact: true }).click();
    assert.equal(await tool.getByLabel('Chiffre d’affaires en euros').count(), 0);
    await tool.getByRole('button', { name: 'Ajouter la référence', exact: true }).click();
    await page.locator('.catalogue-notice').waitFor();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const catalog = await snapshotPlan(page);
    assert.equal(catalog.salesMetric, 'catalog'); assert.equal(catalog.products.length, 1);
    assert.equal(catalog.products[0].ours, null); assert.equal(catalog.products[0].sales, 0);
    assert.equal(catalog.products[0].packaging, '400 g'); assert.match(catalog.products[0].notes, /Open Food Facts.*ODbL/);
    await clickNativeMenu(app, 'off-search');
    await tool.getByLabel('Nom, marque ou code-barres').fill('3017620422003');
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await tool.getByRole('button', { name: /Produit de test/ }).click();
    await tool.getByText('Cette référence est déjà dans l’assortiment.', { exact: true }).waitFor();
    assert.equal(await tool.getByRole('button', { name: 'Ajouter à l’assortiment…', exact: true }).count(), 0);
    await tool.locator('.modal-footer').getByRole('button', { name: 'Fermer', exact: true }).click();
    await clickNativeMenu(app, 'demo');
    await page.locator('.save-status.unsaved').waitFor();
    await clickNativeMenu(app, 'save'); await page.locator('.save-status.saved').waitFor();
    const original = await snapshotPlan(page);
    await clickNativeMenu(app, 'off-search');
    await tool.getByLabel('Nom, marque ou code-barres').fill('tomates');
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await tool.getByRole('button', { name: /Produit de test/ }).click();
    await tool.getByRole('button', { name: 'Ajouter à l’assortiment…', exact: true }).click();
    await expect(tool.getByRole('button', { name: 'Ajouter la référence', exact: true })).toBeDisabled();
    await tool.getByLabel('Chiffre d’affaires en euros').fill('123,45');
    await tool.getByRole('button', { name: 'Ajouter la référence', exact: true }).click();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const updated = await snapshotPlan(page);
    assert.equal(updated.products.length, original.products.length + 1); assert.equal(updated.products.at(-1).sales, 123.45);
    assert.deepEqual(updated.blockPlacements, original.blockPlacements); assert.deepEqual(updated.massUnits, original.massUnits);
    await clickNativeMenu(app, 'undo');
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.deepEqual((await snapshotPlan(page)).products, original.products);
    await clickNativeMenu(app, 'off-search');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720));
    await tool.getByLabel('Nom, marque ou code-barres').fill('tomates');
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await tool.getByRole('button', { name: 'Page suivante', exact: true }).click();
    await tool.getByText('Page 2 sur 2', { exact: true }).waitFor();
    await tool.getByRole('button', { name: /Autre produit/ }).click();
    await expect(tool.getByRole('button', { name: 'Ajouter à l’assortiment…', exact: true })).toBeInViewport();
    await fs.mkdir('screenshots', { recursive: true }); await page.screenshot({ path: 'screenshots/22-open-food-facts.png' });
    const footer = await tool.locator('.modal-footer').boundingBox();
    assert.ok(footer.y + footer.height <= await page.evaluate(() => innerHeight));
    await tool.getByLabel('Nom, marque ou code-barres').fill('inconnu');
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await tool.getByText('Aucun produit trouvé', { exact: true }).waitFor();
    await tool.getByLabel('Nom, marque ou code-barres').fill('panne');
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(tool.getByRole('alert')).toContainText('Vérifiez votre connexion Internet');
    await expect(tool.getByRole('alert')).not.toContainText('Error invoking');
    await tool.getByLabel('Nom, marque ou code-barres').fill('service');
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(tool.getByRole('alert')).toHaveText('Open Food Facts est temporairement indisponible. Réessayez plus tard.');
    assert.equal(await app.evaluate(() => globalThis.offRequests.length), 6);
    await tool.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(tool.locator('.off-result-heading strong')).toHaveText(/10\s*000\+ résultats/);
    await expect(tool.getByRole('alert')).toHaveCount(0);
    const calls = await app.evaluate(() => globalThis.offRequests);
    assert.equal(calls.length, 7); assert.ok(calls.every(call => call.userAgent.startsWith('PlanoPilot/1.2.0')));
    assert.ok(calls.filter(call => call.body).every(call => new URL(call.url).origin === 'https://search.openfoodfacts.org' && call.method === 'POST'));
    await assert.rejects(page.evaluate(() => window.plano.openOpenFoodFactsProduct('https://example.org')), /invalide/);
    assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
});
test('tutoriel de première utilisation : reprise, fin, aide et conservation du plan', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-tutorial-'));
  const errors = [], network = [];
  let app;
  const launch = async (initialFile) => {
    app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } }, initialFile);
    const page = await app.firstWindow();
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.locator('.loading-screen').waitFor({ state: 'hidden' });
    return page;
  };
  try {
    let page = await launch();
    const guide = page.getByRole('dialog', { name: 'Bien démarrer avec PlanoPilot' });
    await guide.waitFor();
    assert.equal(await page.locator('.tutorial-next').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await guide.getByRole('button', { name: 'Fermer', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('.tutorial-next').evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.getByRole('button', { name: 'Précédent' }).click();
    await page.keyboard.press('Tab');
    assert.equal(await guide.evaluate(el => el.contains(document.activeElement)), true);
    await fs.mkdir('screenshots', { recursive: true });
    await page.getByRole('heading', { name: 'Votre premier plan, en quelques étapes' }).waitFor();
    await page.screenshot({ path: 'screenshots/06-tutoriel-bienvenue.png' });
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.getByRole('heading', { name: 'Commencez avec vos données' }).waitFor();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.getByRole('heading', { name: 'Donnez au plan les bonnes dimensions' }).waitFor();
    await page.getByRole('button', { name: 'Précédent' }).click();
    await page.getByRole('heading', { name: 'Commencez avec vos données' }).waitFor();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await closeApp(app); app = undefined;

    page = await launch();
    await page.getByRole('heading', { name: 'Donnez au plan les bonnes dimensions' }).waitFor();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '3');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await page.screenshot({ path: 'screenshots/07-tutoriel-configuration.png' });
    const body = await page.locator('.tutorial-body').boundingBox();
    const footer = await page.locator('.tutorial-footer').boundingBox();
    assert.ok(body.y + body.height <= footer.y + 1);
    assert.ok(footer.y + footer.height <= 800);
    const before = await snapshotPlan(page);
    for (const title of ['Choisissez votre implantation', 'Gardez la main sur chaque bloc', 'Retrouvez et partagez votre travail']) {
      await page.getByRole('button', { name: 'Suivant', exact: true }).click();
      await page.getByRole('heading', { name: title }).waitFor();
    }
    await page.getByRole('button', { name: 'Commencer', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(await snapshotPlan(page), before);
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await clickNativeMenu(app, 'save'); await page.locator('.save-status.saved').waitFor();
    await closeApp(app); app = undefined;

    page = await launch('Sans titre.plano');
    await page.getByRole('heading', { name: 'Sans titre', exact: false }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    const project = await snapshotPlan(page);
    await clickNativeMenu(app, 'help');
    await page.getByRole('button', { name: 'Revoir le tutoriel' }).click();
    await page.getByRole('heading', { name: 'Votre premier plan, en quelques étapes' }).waitFor();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(await snapshotPlan(page), project);
    await clickNativeMenu(app, 'help');
    await page.getByRole('button', { name: 'Raccourcis clavier', exact: true }).click();
    await page.getByRole('dialog', { name: 'À portée de clavier' }).waitFor();
    await page.getByRole('button', { name: 'Compris' }).click();
    await closeApp(app); app = undefined;

    page = await launch('Sans titre.plano');
    await page.getByRole('heading', { name: 'Sans titre', exact: false }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
  } finally { if (app) await closeApp(app); }
});
test('parcours Windows hors ligne : édition, sauvegarde, plan, CSV et PDF', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-desktop-'));
  const errors = [];
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory, PLANOPILOT_TEST: '0' } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page); page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('button', { name: 'Explorer un exemple' }).waitFor();
    await fs.mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/01-accueil.png' });
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await page.locator('.mass-block').first().waitFor();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    await page.screenshot({ path: 'screenshots/02-descente.png' });
    const firstInput = page.locator('.group-card-footer input').first();
    await firstInput.fill('25'); await firstInput.press('Enter');
    assert.equal(await page.locator('.group-card-footer input').first().inputValue(), '25');
    await page.keyboard.press('Control+z');
    assert.notEqual(await page.locator('.group-card-footer input').first().inputValue(), '25');
    await page.keyboard.press('Control+y');
    assert.equal(await page.locator('.group-card-footer input').first().inputValue(), '25');
    await page.getByRole('button', { name: 'Par blocs Composition libre' }).click();
    const initialBlocks = await page.locator('.plan-block').count();
    await page.locator('.plan-block').first().dblclick();
    await page.getByRole('dialog', { name: 'Modifier le bloc', exact: true }).getByRole('button', { name: 'Supprimer', exact: true }).click();
    assert.equal(await page.locator('.plan-block').count(), initialBlocks - 1);
    await page.keyboard.press('Control+z');
    assert.equal(await page.locator('.plan-block').count(), initialBlocks);
    await clickNativeMenu(app, 'create-group');
    await page.getByRole('textbox', { name: 'Nom du regroupement' }).fill('Autres légumes');
    await page.locator('.member-list input').nth(0).check(); await page.locator('.member-list input').nth(1).check();
    await page.getByRole('button', { name: 'Créer le regroupement', exact: true }).click();
    assert.equal(await page.locator('.plan-block').count(), initialBlocks);
    assert.ok((await page.locator('.plan-block').allTextContents()).some(text => text.includes('Autres légumes')));
    await page.screenshot({ path: 'screenshots/03-blocs.png' });
    await page.getByRole('button', { name: 'À l’article Référence par référence' }).click();
    await page.locator('.plan-block').first().click(); await page.keyboard.press('Delete');
    assert.equal(await page.locator('.article-block').count(), 287);
    await page.getByRole('button', { name: 'En descente Toute la hauteur' }).click();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const plans = await readPlans(directory);
    assert.equal(plans.length, 1);
    const project = await readPlan(directory, plans[0].id);
    assert.equal(project.customGroups[0].label, 'Autres légumes');
    const exportedPath = path.join(directory, 'export.plano'), pdfPath = path.join(directory, 'rapport.pdf');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exportedPath);
    await clickNativeMenu(app, 'save-as');
    await new Promise(resolve => setTimeout(resolve, 400));
    const exported = JSON.parse(await fs.readFile(exportedPath, 'utf8'));
    assert.deepEqual(exported.blockPlacements, project.blockPlacements);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, pdfPath);
    await clickNativeMenu(app, 'export-pdf');
    await page.getByText('Le PDF a été enregistré.', { exact: true }).waitFor();
    const pdf = await fs.readFile(pdfPath); assert.ok(pdf.length > 10000); assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
    await fs.copyFile(pdfPath, 'screenshots/exemple-planopilot.pdf');
    const csvPath = path.join(directory, 'export.csv');
    await app.evaluate(({ BrowserWindow }, file) => { BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_, item) => item.setSavePath(file)); }, csvPath);
    await clickNativeMenu(app, 'export-csv');
    for (let i = 0; i < 30; i++) { try { await fs.stat(csvPath); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
    assert.ok((await fs.readFile(csvPath, 'utf8')).includes('Autres légumes'));
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, exportedPath);
    await clickNativeMenu(app, 'open');
    assert.ok((await page.locator('.group-card h3').allTextContents()).includes('Autres légumes'));
    assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
});

test('imports XLSX multi-onglets, CSV invalides et assortiment de 5 000 références', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-import-'));
  const errors = [], network = [];
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page); page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.getByRole('button', { name: 'Importer mes données' }).click();
    await page.locator('.file-drop input').setInputFiles('tests/fixtures/ventes-multi-onglets.xlsx');
    await page.getByLabel('Onglet à analyser').waitFor();
    await page.getByLabel('Onglet à analyser').selectOption('1');
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Haricots', exact: true })).toBeVisible();
    assert.ok((await page.locator('.group-card h3').allTextContents()).includes('Haricots'));
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const plans = await readPlans(directory);
    const excel = await readPlan(directory, plans[0].id);
    assert.equal(excel.sourceSheet, 'Grains'); assert.equal(excel.products.reduce((sum, x) => sum + x.sales, 0), 3751);
    assert.equal(excel.products[0].ours, true); assert.equal(excel.products[1].ours, false);
    await clickNativeMenu(app, 'import-sales');
    await page.locator('.file-drop input').setInputFiles('tests/fixtures/ventes-invalides.csv');
    await page.locator('.validation.warning').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Importer les données', exact: true }).isDisabled());
    await page.getByLabel('Ignorer explicitement ces lignes et importer les autres').check();
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const csv = await readPlan(directory, plans[0].id);
    assert.equal(csv.products.length, 2); assert.equal(csv.products.reduce((sum, x) => sum + x.sales, 0), 1734.81);
    const large = path.join(directory, '5000-references.csv');
    await fs.writeFile(large, 'Référence;Produit;Marque;Segment;Sous-segment;CA\n' + Array.from({ length: 5000 }, (_, i) => `REF-${i};Produit ${i};Marque ${i % 20};Légumes;Groupe ${i % 5};${100 + i}`).join('\n'));
    await clickNativeMenu(app, 'import-sales'); await page.locator('.file-drop input').setInputFiles(large);
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await clickNativeMenu(app, 'toggle-panel');
    assert.ok(await page.locator('.product-row').count() < 35);
    await page.getByRole('textbox', { name: 'Rechercher une référence' }).fill('REF-4999');
    await page.getByText('1 références · classées par ventes', { exact: true }).waitFor();
    assert.equal(await page.locator('.product-row').count(), 1);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await page.screenshot({ path: 'screenshots/04-fenetre-1280.png' });
    assert.equal(await page.locator('.workspace-actions').count(), 0);
    assert.deepEqual(network, []); assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
});

test('gestes à la souris, quatre bords, collisions et géométrie des demi-éléments', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-gestures-'));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page); await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    const board = await page.locator('.shelf-board').boundingBox();
    const unit = board.width / 48, shelfHeight = board.height / 6;
    async function drag(locator, dx, dy) { const box = await locator.boundingBox(); const x = box.x + box.width / 2, y = box.y + box.height / 2; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up(); }
    const firstName = await page.locator('.mass-block .block-label strong').first().textContent();
    const initialUnits = Number(await page.locator('.group-card-footer input').first().inputValue());
    await drag(page.locator('.mass-block .resize-handle.right').first(), unit * 3, 0);
    assert.equal(Number(await page.locator('.group-card-footer input').first().inputValue()), initialUnits + 3);
    await drag(page.locator('.mass-block').first(), board.width * .7, 0);
    assert.equal(await page.locator('.mass-block .block-label strong').last().textContent(), firstName);
    await page.getByRole('button', { name: 'Par blocs Composition libre' }).click();
    await page.locator('.plan-block').first().click(); await page.keyboard.press('Delete');
    await page.getByRole('button', { name: 'Nouveau bloc', exact: true }).click();
    await page.getByRole('button', { name: 'Indépendant', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nom du bloc', exact: true }).fill('Promotion');
    await page.getByLabel('Hauteur en tablettes').fill('1');
    await page.getByRole('button', { name: 'Ajouter le bloc' }).click();
    const promotion = page.locator('.plan-block').filter({ has: page.locator('.block-label strong', { hasText: 'Promotion' }) });
    await drag(promotion, unit * 3, 0);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const id = (await readPlans(directory))[0].id;
    const snapshot = async () => (await readPlan(directory, id)).blockPlacements.find(b => b.label === 'Promotion');
    assert.equal((await snapshot()).column, 3);
    await drag(promotion, 0, shelfHeight); await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal((await snapshot()).shelf, 0);
    await drag(promotion.locator('.resize-handle.right'), unit * 2, 0); await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal((await snapshot()).width, 6);
    await drag(promotion.locator('.resize-handle.left'), unit, 0); await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal((await snapshot()).width, 5); assert.equal((await snapshot()).column, 4);
    await page.locator('.plan-block').first().click(); await page.keyboard.press('Delete');
    await drag(promotion.locator('.resize-handle.bottom'), 0, shelfHeight); await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal((await snapshot()).height, 2);
    await drag(promotion.locator('.resize-handle.top'), 0, shelfHeight); await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal((await snapshot()).height, 1); assert.equal((await snapshot()).shelf, 1);
    await page.getByRole('spinbutton', { name: 'Nombre d’éléments' }).fill('2.5');
    await page.getByLabel('Unités / élément', { exact: true }).fill('13');
    await page.getByRole('button', { name: 'Régénérer le plan', exact: true }).click(); await page.getByRole('button', { name: 'Recalculer le plan', exact: true }).click();
    assert.equal(await page.locator('.shelf-numbers span').count(), 6);
    const half = await page.locator('.element-labels>span').last().evaluate(el => parseFloat(el.style.width));
    assert.ok(Math.abs(half - 20) < 1e-8);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const final = await readPlan(directory, id); assert.equal(final.halfUnits, 7); assert.equal(final.elements, 2.5);
    await page.screenshot({ path: 'screenshots/05-demi-element.png' });
  } finally { await closeApp(app); }
});

test('les annexes PDF conservent leur pagination sans page vide', { timeout: 60000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-pdf-'));
  const app = await launchDesktop({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page); await page.getByRole('button', { name: 'Explorer un exemple' }).waitFor();
    const p = demoProject(), product = p.products[0];
    const report = pdfPayload(generate({ ...p, products: Array.from({ length: 61 }, (_, i) => ({ ...product, id: `p-${i}`, sku: `R-${i}`, brand: `Marque ${i}`, sales: i + 1 })), groupBy: 'brand' }));
    const file = path.join(directory, 'annexes.pdf');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
    assert.ok(await page.evaluate(report => window.plano.exportPDF(report), report));
    const pdf = await fs.readFile(file);
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, (report.html.match(/<section class="page/g) || []).length);
    await fs.copyFile(file, 'screenshots/exemple-annexes.pdf');
  } finally { await closeApp(app); }
});
