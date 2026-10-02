import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { demoProject, generate, newProject } from '../src/domain.ts';
import { pdfPayload } from '../src/exports.ts';
import { salesText } from '../src/format.ts';
const require = createRequire(import.meta.url);
async function dismissTutorial(page) {
  await page.getByRole('dialog', { name: 'Bien démarrer avec PlanoPilot' }).waitFor();
  await page.getByRole('button', { name: 'Passer le tutoriel' }).click();
}
async function clickNativeMenu(app, id) {
  const enabled = await app.evaluate(({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).enabled, id);
  assert.equal(enabled, true, `Le menu ${id} doit être disponible`);
  await app.evaluate(({ Menu }, id) => Menu.getApplicationMenu().getMenuItemById(id).click(), id);
}
test('bureau : double-clic, édition annulable, collisions et menus natifs', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-edit-menu-'));
  const p = demoProject();
  await fs.mkdir(path.join(directory, 'plans'));
  await fs.writeFile(path.join(directory, 'plans', `${p.id}.plano`), JSON.stringify(p));
  await fs.writeFile(path.join(directory, 'settings.json'), JSON.stringify({ lastProject: p.id }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(), errors = []; page.on('pageerror', error => errors.push(error.message)); await dismissTutorial(page);
    assert.deepEqual(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(item => item.label)), ['Fichier', 'Édition', 'Affichage', 'Outils', 'Aide']);
    assert.equal(await page.locator('.right-panel').count(), 0);
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('undo').enabled), false);
    await page.locator('.mass-block').first().click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator('.mass-block.selected').count(), 1);
    await clickNativeMenu(app, 'edit-selection');
    let editor = page.getByRole('dialog', { name: 'Modifier la descente', exact: true }); await editor.waitFor();
    const initialUnits = Number(await editor.getByLabel('Unités attribuées').inputValue());
    await editor.getByLabel('Unités attribuées').fill(String(initialUnits - 1));
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('delete').enabled), false);
    await editor.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(Number(await page.locator('.group-card-footer input').first().inputValue()), initialUnits);
    await page.locator('.mass-block').first().dblclick(); await editor.waitFor();
    await editor.getByRole('button', { name: /Voir \d+ autres références/ }).click();
    assert.equal(await editor.isVisible(), true);
    await editor.getByLabel('Unités attribuées').fill(String(initialUnits - 1));
    await editor.getByRole('button', { name: 'Appliquer', exact: true }).click();
    assert.equal(Number(await page.locator('.group-card-footer input').first().inputValue()), initialUnits - 1);
    await clickNativeMenu(app, 'undo');
    await expect(page.locator('.group-card-footer input').first()).toHaveValue(String(initialUnits));
    await clickNativeMenu(app, 'redo');
    await expect(page.locator('.group-card-footer input').first()).toHaveValue(String(initialUnits - 1));
    await page.getByRole('button', { name: 'Par blocs Composition libre' }).click();
    await page.locator('.plan-block').first().dblclick();
    editor = page.getByRole('dialog', { name: 'Modifier le bloc', exact: true }); await editor.waitFor();
    const width = Number(await editor.getByLabel('Largeur du bloc').inputValue());
    const height = await editor.getByLabel('Hauteur du bloc').inputValue();
    await editor.getByLabel('Hauteur du bloc').fill(String(p.shelves));
    assert.equal(await editor.getByRole('button', { name: 'Appliquer', exact: true }).isDisabled(), true);
    assert.match(await editor.getByRole('alert').textContent(), /occupé ou sort du meuble/);
    await editor.getByLabel('Hauteur du bloc').fill(height);
    await editor.getByLabel('Largeur du bloc').fill(String(width - 1));
    await editor.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    let saved = await page.evaluate(() => window.plano.initialProject());
    assert.equal(saved.blockPlacements[0].width, width - 1);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    saved = await page.evaluate(() => window.plano.initialProject()); assert.equal(saved.blockPlacements[0].width, width);
    await page.locator('.plan-block').first().click();
    await page.getByTitle('Renommer le plan', { exact: true }).click();
    const name = page.locator('.name-input'); await name.fill('Projet à renommer'); await name.press('Home'); await name.press('Delete');
    assert.equal(await name.inputValue(), 'rojet à renommer');
    assert.equal(await page.locator('.plan-block').count(), p.blockPlacements.length);
    await name.press('Escape');
    await page.locator('.plan-block').first().dblclick(); await editor.waitFor();
    await fs.mkdir('screenshots', { recursive: true }); await page.screenshot({ path: 'screenshots/14-edition-modal.png' });
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'À l’article Référence par référence' }).click();
    await page.locator('.article-block').first().dblclick();
    const articleEditor = page.getByRole('dialog', { name: 'Modifier l’article', exact: true }); await articleEditor.waitFor();
    const reference = await articleEditor.getByLabel('Référence associée').inputValue();
    await articleEditor.getByLabel('Colonne de départ').fill('49');
    assert.equal(await articleEditor.getByRole('button', { name: 'Appliquer', exact: true }).isDisabled(), true);
    await articleEditor.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.ok(p.products.some(product => product.id === reference));
    await clickNativeMenu(app, 'settings');
    await page.getByRole('dialog', { name: 'Paramètres', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
    await clickNativeMenu(app, 'new'); await page.getByRole('dialog', { name: 'Créer un nouveau plan' }).waitFor();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
test('panneau de droite : masqué par défaut, paramètres, menu et préférence conservée', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-panel-'));
  let app;
  const launch = async () => {
    app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
    const page = await app.firstWindow(); await page.locator('.loading-screen').waitFor({ state: 'hidden' }); return page;
  };
  try {
    let page = await launch(); await dismissTutorial(page);
    assert.equal(await page.locator('.right-panel').count(), 0);
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    const toggle = page.getByRole('switch', { name: 'Afficher le panneau de droite' }); assert.equal(await toggle.isChecked(), false);
    await toggle.check(); await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
    await page.locator('.right-panel').waitFor();
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-panel').checked), true);
    await page.locator('.mass-block').first().click(); assert.equal(await page.locator('.inspector').count(), 0);
    await page.getByRole('textbox', { name: 'Rechercher une référence' }).fill('REF-1001');
    await page.getByText('1 références · classées par ventes', { exact: true }).waitFor();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    await app.close(); app = undefined;
    page = await launch(); await page.locator('.right-panel').waitFor();
    await clickNativeMenu(app, 'toggle-panel'); await page.locator('.right-panel').waitFor({ state: 'hidden' });
    assert.equal(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-panel').checked), false);
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    assert.equal(await page.getByRole('switch', { name: 'Afficher le panneau de droite' }).isChecked(), false);
    await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
    await page.screenshot({ path: 'screenshots/15-panneau-masque.png' });
    await app.close(); app = undefined;
    page = await launch(); assert.equal(await page.locator('.right-panel').count(), 0);
  } finally { if (app) await app.close(); }
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
    await fs.mkdir(path.join(directory, 'plans'));
    await fs.writeFile(path.join(directory, 'plans', `${p.id}.plano`), JSON.stringify(p));
    await fs.writeFile(path.join(directory, 'settings.json'), JSON.stringify({ lastProject: p.id }));
    const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
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
      await page.getByRole('button', { name: 'Créer un regroupement', exact: true }).click();
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
      const saved = await page.evaluate(() => window.plano.initialProject());
      assert.deepEqual(saved.products, p.products);
      assert.equal(saved.customGroups.length, 1);
      if (metric === 'revenue') {
        await card.scrollIntoViewIfNeeded();
        await fs.mkdir('screenshots', { recursive: true });
        await page.screenshot({ path: 'screenshots/12-contenu-regroupement.png' });
      }
      assert.deepEqual(errors, []);
    } finally { await app.close(); }
  }
});
test('export PNG : trois modes, plan complet hors écran, annulation et projet inchangé', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-image-'));
  const p = demoProject();
  p.blockPlacements[0] = { ...p.blockPlacements[0], groupId: null, label: 'Promotion', color: '#d2387c' };
  await fs.mkdir(path.join(directory, 'plans'));
  await fs.writeFile(path.join(directory, 'plans', `${p.id}.plano`), JSON.stringify(p));
  await fs.writeFile(path.join(directory, 'settings.json'), JSON.stringify({ lastProject: p.id }));
  const errors = [];
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message)); await dismissTutorial(page);
    await page.locator('.mass-block').first().waitFor();
    const projectBefore = await page.evaluate(() => window.plano.initialProject());
    async function savePNG(name) {
      const file = path.join(directory, name);
      if (await page.locator('.toast').count()) await page.locator('.toast .icon-button').click();
      await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async (_, options) => { globalThis.imageDialog = options; return { canceled: false, filePath: file }; }; }, file);
      await page.getByRole('button', { name: 'Télécharger l’image', exact: true }).click();
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
    await page.getByRole('button', { name: 'Agrandir', exact: true }).click();
    await page.getByRole('button', { name: 'Agrandir', exact: true }).click();
    await page.getByRole('button', { name: 'Afficher la grille des unités' }).click();
    await page.locator('.board-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const zoomed = await savePNG('descente-zoom.png');
    assert.deepEqual(zoomed.bytes, mass.bytes);
    assert.deepEqual(await page.evaluate(() => window.plano.initialProject()), projectBefore);
    await fs.copyFile(mass.file, 'screenshots/planogramme-export.png');

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await page.getByRole('button', { name: 'Par blocs Composition libre' }).click();
    const blocks = await savePNG('blocs.png');
    assert.notDeepEqual(blocks.bytes, mass.bytes);
    await page.getByRole('button', { name: 'Ajuster à l’écran' }).click();
    await page.screenshot({ path: 'screenshots/11-bouton-export-image.png' });
    const button = await page.locator('.board-image-button').boundingBox(), toolbar = await page.locator('.board-toolbar').boundingBox();
    assert.ok(button.x >= toolbar.x && button.x + button.width <= toolbar.x + toolbar.width);
    await page.getByRole('button', { name: 'À l’article Référence par référence' }).click();
    const articles = await savePNG('articles.png');
    assert.notDeepEqual(articles.bytes, mass.bytes);
    assert.notDeepEqual(articles.bytes, blocks.bytes);

    await page.locator('.toast .icon-button').click();
    const cancelled = path.join(directory, 'annule.png');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: file }); }, cancelled);
    await page.getByRole('button', { name: 'Télécharger l’image', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.board-image-button')?.disabled);
    await assert.rejects(fs.access(cancelled));
    assert.equal(await page.locator('.toast').count(), 0);
    await assert.rejects(page.evaluate(() => window.plano.exportImage({ name: 'invalid', data: new Uint8Array(40) })), /Image PNG invalide/);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
test('Paramètres : téléchargement, import Royal Bourbon dans un nouveau plan et réouverture', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-catalogue-'));
  let app;
  const errors = [], network = [];
  const launch = async () => {
    app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
    const page = await app.firstWindow();
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.locator('.loading-screen').waitFor({ state: 'hidden' });
    return page;
  };
  try {
    let page = await launch(); await dismissTutorial(page);
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const original = await page.evaluate(() => window.plano.initialProject());
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Paramètres', exact: true }); await settings.waitFor();
    await fs.mkdir('screenshots', { recursive: true }); await page.screenshot({ path: 'screenshots/08-parametres-import.png' });
    const csvPath = path.join(directory, 'royal-bourbon-produits-2026-10-01.csv');
    await app.evaluate(({ BrowserWindow }, file) => {
      globalThis.catalogueDownload = new Promise(resolve => {
        BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_, item) => {
          item.setSavePath(file);
          item.once('done', (_, state) => resolve({ state, name: item.getFilename() }));
        });
      });
    }, csvPath);
    await settings.getByRole('button', { name: 'Télécharger le CSV', exact: true }).click();
    const downloaded = await app.evaluate(() => globalThis.catalogueDownload);
    assert.equal(downloaded.state, 'completed'); assert.equal(downloaded.name, 'royal-bourbon-produits-2026-10-01.csv');
    assert.equal(await fs.readFile(csvPath, 'utf8'), await fs.readFile('data/imports/royal-bourbon-produits-2026-10-01.csv', 'utf8'));
    await settings.getByRole('button', { name: 'Importer Royal Bourbon' }).click();
    await page.getByText('72 lignes prêtes à être importées').waitFor();
    assert.equal(await page.getByLabel('Mesure des ventes').inputValue(), 'catalog');
    assert.equal(await page.getByLabel('Destination de l’import').inputValue(), 'new');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.deepEqual(await page.evaluate(id => window.plano.loadProject(id), original.id), original);
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await page.getByRole('button', { name: 'Importer Royal Bourbon' }).click();
    await page.getByText('72 lignes prêtes à être importées').waitFor();
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await page.locator('.catalogue-notice').waitFor();
    const ceres = page.locator('.group-card').filter({ has: page.getByRole('heading', { name: 'Ceres 100 % et nectars', exact: true }) });
    assert.equal(await ceres.locator('.group-content-list > li').count(), 2);
    assert.ok((await ceres.locator('.group-contents').textContent()).includes('Jus 100 % abricot'));
    assert.ok((await ceres.locator('.group-contents').textContent()).includes('Jus et nectars Ceres — autres parfums à détailler'));
    assert.equal(await ceres.locator('.group-content-stats').count(), 0);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    assert.equal(await page.getByRole('switch').isDisabled(), true);
    const plans = await page.evaluate(() => window.plano.listProjects());
    assert.equal(plans.length, 2);
    const catalogue = await page.evaluate(id => window.plano.loadProject(id), plans.find(p => p.id !== original.id).id);
    assert.equal(catalogue.products.length, 72); assert.equal(catalogue.salesMetric, 'catalog'); assert.equal(catalogue.weightedBySales, false);
    assert.ok(catalogue.products.every(p => p.sales === 0 && p.sourceUrl && p.supplier));
    assert.deepEqual(await page.evaluate(id => window.plano.loadProject(id), original.id), original);
    await page.screenshot({ path: 'screenshots/09-royal-bourbon-catalogue.png' });
    await app.close(); app = undefined;
    page = await launch(); await page.locator('.catalogue-notice').waitFor();
    const reopened = await page.evaluate(() => window.plano.initialProject());
    assert.deepEqual(reopened.products, catalogue.products); assert.equal(reopened.salesMetric, 'catalog');
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
  } finally { if (app) await app.close(); }
});
test('tutoriel de première utilisation : reprise, fin, aide et conservation du projet', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-tutorial-'));
  const errors = [], network = [];
  let app;
  const launch = async () => {
    app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
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
    await app.close(); app = undefined;

    page = await launch();
    await page.getByRole('heading', { name: 'Donnez au plan les bonnes dimensions' }).waitFor();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '3');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await page.screenshot({ path: 'screenshots/07-tutoriel-configuration.png' });
    const body = await page.locator('.tutorial-body').boundingBox();
    const footer = await page.locator('.tutorial-footer').boundingBox();
    assert.ok(body.y + body.height <= footer.y + 1);
    assert.ok(footer.y + footer.height <= 800);
    const before = await page.evaluate(() => window.plano.initialProject());
    for (const title of ['Choisissez votre implantation', 'Gardez la main sur chaque bloc', 'Retrouvez et partagez votre travail']) {
      await page.getByRole('button', { name: 'Suivant', exact: true }).click();
      await page.getByRole('heading', { name: title }).waitFor();
    }
    await page.getByRole('button', { name: 'Commencer', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.plano.initialProject()), before);
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await page.locator('.save-status.saved').waitFor();
    await app.close(); app = undefined;

    page = await launch();
    await page.getByRole('heading', { name: 'Conserves de légumes · Enseigne A' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    const project = await page.evaluate(() => window.plano.initialProject());
    await page.getByRole('button', { name: 'Aide et tutoriel' }).click();
    await page.getByRole('button', { name: 'Revoir le tutoriel' }).click();
    await page.getByRole('heading', { name: 'Votre premier plan, en quelques étapes' }).waitFor();
    await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.plano.initialProject()), project);
    await page.getByRole('button', { name: 'Aide et tutoriel' }).click();
    await page.getByRole('button', { name: 'Raccourcis clavier', exact: true }).click();
    await page.getByRole('dialog', { name: 'À portée de clavier' }).waitFor();
    await page.getByRole('button', { name: 'Compris' }).click();
    await app.close(); app = undefined;

    page = await launch();
    await page.getByRole('heading', { name: 'Conserves de légumes · Enseigne A' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
  } finally { if (app) await app.close(); }
});
test('parcours Windows hors ligne : édition, sauvegarde, projet, CSV et PDF', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-desktop-'));
  const errors = [];
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory, PLANOPILOT_TEST: '0' } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page); page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('button', { name: 'Explorer un exemple' }).waitFor();
    await fs.mkdir('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/01-accueil.png' });
    await page.getByRole('button', { name: 'Explorer un exemple' }).click();
    await page.getByRole('heading', { name: 'Conserves de légumes · Enseigne A' }).waitFor();
    await page.locator('.save-status.saved').waitFor();
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
    await page.getByRole('button', { name: 'Créer un regroupement' }).click();
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
    const plans = await page.evaluate(() => window.plano.listProjects());
    assert.equal(plans.length, 1);
    const project = await page.evaluate(id => window.plano.loadProject(id), plans[0].id);
    assert.equal(project.customGroups[0].label, 'Autres légumes');
    const exportedPath = path.join(directory, 'export.plano'), pdfPath = path.join(directory, 'rapport.pdf');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exportedPath);
    await page.getByRole('button', { name: 'Autres actions' }).click();
    await page.getByRole('button', { name: 'Exporter le projet .plano' }).click();
    await new Promise(resolve => setTimeout(resolve, 400));
    const exported = JSON.parse(await fs.readFile(exportedPath, 'utf8'));
    assert.deepEqual(exported.blockPlacements, project.blockPlacements);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, pdfPath);
    await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
    await page.getByText('Le PDF a été enregistré.', { exact: true }).waitFor();
    const pdf = await fs.readFile(pdfPath); assert.ok(pdf.length > 10000); assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
    await fs.copyFile(pdfPath, 'screenshots/exemple-planopilot.pdf');
    const csvPath = path.join(directory, 'export.csv');
    await app.evaluate(({ BrowserWindow }, file) => { BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_, item) => item.setSavePath(file)); }, csvPath);
    await page.getByRole('button', { name: 'Autres actions' }).click();
    await page.getByRole('button', { name: 'Exporter les données CSV' }).click();
    for (let i = 0; i < 30; i++) { try { await fs.stat(csvPath); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
    assert.ok((await fs.readFile(csvPath, 'utf8')).includes('Autres légumes'));
    await page.getByRole('button', { name: 'Mes plans' }).click();
    await page.locator('.library-open').first().click();
    assert.ok((await page.locator('.group-card h3').allTextContents()).includes('Autres légumes'));
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test('imports XLSX multi-onglets, CSV invalides et assortiment de 5 000 références', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-import-'));
  const errors = [], network = [];
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
  try {
    const page = await app.firstWindow(); await dismissTutorial(page); page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.getByRole('button', { name: 'Importer mes données' }).click();
    await page.locator('.file-drop input').setInputFiles('tests/fixtures/ventes-multi-onglets.xlsx');
    await page.getByLabel('Onglet à analyser').waitFor();
    await page.getByLabel('Onglet à analyser').selectOption('1');
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    assert.ok((await page.locator('.group-card h3').allTextContents()).includes('Haricots'));
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const plans = await page.evaluate(() => window.plano.listProjects());
    const excel = await page.evaluate(id => window.plano.loadProject(id), plans[0].id);
    assert.equal(excel.sourceSheet, 'Grains'); assert.equal(excel.products.reduce((sum, x) => sum + x.sales, 0), 3751);
    assert.equal(excel.products[0].ours, true); assert.equal(excel.products[1].ours, false);
    await page.getByRole('button', { name: 'Remplacer les données' }).click();
    await page.locator('.file-drop input').setInputFiles('tests/fixtures/ventes-invalides.csv');
    await page.locator('.validation.warning').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Importer les données', exact: true }).isDisabled());
    await page.getByLabel('Ignorer explicitement ces lignes et importer les autres').check();
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const csv = await page.evaluate(id => window.plano.loadProject(id), plans[0].id);
    assert.equal(csv.products.length, 2); assert.equal(csv.products.reduce((sum, x) => sum + x.sales, 0), 1734.81);
    const large = path.join(directory, '5000-references.csv');
    await fs.writeFile(large, 'Référence;Produit;Marque;Segment;Sous-segment;CA\n' + Array.from({ length: 5000 }, (_, i) => `REF-${i};Produit ${i};Marque ${i % 20};Légumes;Groupe ${i % 5};${100 + i}`).join('\n'));
    await page.getByRole('button', { name: 'Remplacer les données' }).click(); await page.locator('.file-drop input').setInputFiles(large);
    await page.getByRole('button', { name: 'Importer les données', exact: true }).click();
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await page.getByRole('switch', { name: 'Afficher le panneau de droite' }).check();
    await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
    assert.ok(await page.locator('.product-row').count() < 35);
    await page.getByRole('textbox', { name: 'Rechercher une référence' }).fill('REF-4999');
    await page.getByText('1 références · classées par ventes', { exact: true }).waitFor();
    assert.equal(await page.locator('.product-row').count(), 1);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await page.screenshot({ path: 'screenshots/04-fenetre-1280.png' });
    const actions = await page.locator('.workspace-actions').boundingBox(); assert.ok(actions.x + actions.width <= 1280);
    assert.deepEqual(network, []); assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test('gestes à la souris, quatre bords, collisions et géométrie des demi-éléments', { timeout: 120000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-gestures-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
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
    const id = (await page.evaluate(() => window.plano.listProjects()))[0].id;
    const snapshot = async () => (await page.evaluate(id => window.plano.loadProject(id), id)).blockPlacements.find(b => b.label === 'Promotion');
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
    await page.getByRole('button', { name: 'Appliquer la structure' }).click(); await page.getByRole('button', { name: 'Recalculer le plan', exact: true }).click();
    assert.equal(await page.locator('.shelf-numbers span').count(), 6);
    const half = await page.locator('.element-labels>span').last().evaluate(el => parseFloat(el.style.width));
    assert.ok(Math.abs(half - 20) < 1e-8);
    await page.keyboard.press('Control+s'); await page.locator('.save-status.saved').waitFor();
    const final = await page.evaluate(id => window.plano.loadProject(id), id); assert.equal(final.halfUnits, 7); assert.equal(final.elements, 2.5);
    await page.screenshot({ path: 'screenshots/05-demi-element.png' });
  } finally { await app.close(); }
});

test('les annexes PDF conservent leur pagination sans page vide', { timeout: 60000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-pdf-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--disable-gpu'], cwd: path.resolve('.'), env: { ...process.env, PLANOPILOT_DATA_DIR: directory } });
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
  } finally { await app.close(); }
});
