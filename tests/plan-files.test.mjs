import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { newProject } from '../src/domain.ts';
const { createPlanFiles } = createRequire(import.meta.url)('../electron/plan-files.cjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'planopilot-files-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, project: { ...newProject(), name: 'Rayon boissons' } };
}

test('un nouveau plan demande un emplacement puis Ctrl S réécrit ce fichier', async t => {
  const { directory, project } = await fixture(t), file = path.join(directory, 'boissons.plano');
  const choices = [];
  const plans = createPlanFiles({ chooseSavePath: async suggested => { choices.push(suggested); return file; } });
  assert.equal(plans.currentPath, null);
  assert.equal(await plans.save(project), file);
  assert.deepEqual(choices, ['Sans titre.plano']);
  const modified = { ...project, shelves: 8, name: 'Ancien nom ignoré' };
  assert.equal(await plans.save(modified), file);
  assert.equal(choices.length, 1);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { ...modified, name: 'boissons' });
  assert.deepEqual(await fs.readdir(directory), ['boissons.plano']);
});

test('ouvrir un fichier valide puis enregistrer ne crée aucune copie interne', async t => {
  const { directory, project } = await fixture(t), file = path.join(directory, 'rayon.plano');
  await fs.writeFile(file, JSON.stringify(project));
  const plans = createPlanFiles({ chooseSavePath: async () => { assert.fail('Aucune fenêtre d’enregistrement attendue'); } });
  const opened = await plans.read(file);
  assert.equal(plans.currentPath, null);
  assert.deepEqual(opened, { project, filePath: file });
  await plans.activate(opened.filePath);
  await plans.save({ ...project, shelves: 7 });
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).shelves, 7);
  assert.deepEqual(await fs.readdir(directory), ['rayon.plano']);
});

test('Enregistrer sous change le fichier actif et conserve le fichier précédent', async t => {
  const { directory, project } = await fixture(t), original = path.join(directory, 'original.plano'), copy = path.join(directory, 'copie.plano');
  let destination = original;
  const plans = createPlanFiles({ chooseSavePath: async () => destination });
  await plans.save(project);
  destination = copy;
  await plans.save({ ...project, shelves: 7 }, true);
  assert.equal(plans.currentPath, copy);
  await plans.save({ ...project, shelves: 8 });
  assert.equal(JSON.parse(await fs.readFile(original, 'utf8')).name, 'original');
  assert.equal(JSON.parse(await fs.readFile(copy, 'utf8')).name, 'copie');
  assert.equal(JSON.parse(await fs.readFile(original, 'utf8')).shelves, 6);
  assert.equal(JSON.parse(await fs.readFile(copy, 'utf8')).shelves, 8);
});

test('annuler un enregistrement garde le fichier actif et ses données', async t => {
  const { directory, project } = await fixture(t), file = path.join(directory, 'original.plano');
  let destination = null;
  const plans = createPlanFiles({ chooseSavePath: async () => destination });
  assert.equal(await plans.save(project), null);
  assert.equal(plans.currentPath, null);
  assert.deepEqual(await fs.readdir(directory), []);
  destination = file; await plans.save(project);
  destination = null;
  assert.equal(await plans.save({ ...project, name: 'Annulé' }, true), null);
  assert.equal(plans.currentPath, file);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { ...project, name: 'original' });
});

test('un échec d’écriture ou d’ouverture conserve le fichier actif', async t => {
  const { directory, project } = await fixture(t), file = path.join(directory, 'original.plano');
  let destination = file;
  const plans = createPlanFiles({ chooseSavePath: async () => destination });
  await plans.save(project);
  destination = path.join(directory, 'absent', 'erreur.plano');
  await assert.rejects(plans.save({ ...project, name: 'Erreur' }, true), /ENOENT/);
  assert.equal(plans.currentPath, file);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { ...project, name: 'original' });
  const invalid = path.join(directory, 'invalide.plano'); await fs.writeFile(invalid, '{');
  await assert.rejects(plans.read(invalid), SyntaxError);
  assert.equal(plans.currentPath, file);
  await plans.save({ ...project, shelves: 8 });
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).shelves, 8);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['invalide.plano', 'original.plano']);
});

test('le rendu ne peut activer qu’un fichier choisi ou ouvert', async t => {
  const { directory, project } = await fixture(t), file = path.join(directory, 'plan.plano');
  const plans = createPlanFiles({ chooseSavePath: async () => file });
  await assert.rejects(plans.activate(file), /Ouvrez le fichier/);
  await plans.save(project); await plans.activate(null);
  assert.equal(plans.currentPath, null);
  await plans.activate(file);
  assert.equal(plans.currentPath, file);
});


test('plans récents : chemins persistants, ordre, doublons, fichiers absents et retrait sans suppression', async t => {
  const { directory, project } = await fixture(t), original = path.join(directory, 'original.plano'), copy = path.join(directory, 'copie.plano');
  const recentPath = path.join(directory, 'preferences', 'recent-plans.json');
  let destination = original;
  const plans = createPlanFiles({ chooseSavePath: async () => destination, recentPath });
  await plans.save(project); destination = copy; await plans.save(project, true);
  assert.deepEqual((await plans.listRecent()).map(row => row.filePath), [copy, original]);
  const old = await plans.openRecent(original);
  assert.equal(plans.currentPath, copy); // Reading a candidate does not switch the document before confirmation.
  await plans.activate(old.filePath);
  assert.deepEqual((await plans.listRecent()).map(row => row.filePath), [original, copy]);
  const reopened = createPlanFiles({ chooseSavePath: async () => null, recentPath });
  assert.deepEqual((await reopened.listRecent()).map(row => row.filePath), [original, copy]);
  const history = JSON.parse(await fs.readFile(recentPath, 'utf8'));
  assert.deepEqual(Object.keys(history[0]).sort(), ['filePath', 'lastUsed']);
  await fs.unlink(copy);
  assert.equal((await reopened.listRecent())[1].available, false);
  await assert.rejects(reopened.openRecent(copy), /ENOENT/);
  await reopened.removeRecent(original);
  assert.equal(JSON.parse(await fs.readFile(original, 'utf8')).id, project.id);
  await assert.rejects(reopened.openRecent(original), /plans récents/);
  assert.deepEqual((await reopened.listRecent()).map(row => row.filePath), [copy]);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['original.plano', 'preferences']);
});

test('plans récents : liste limitée à vingt fichiers et enregistrement indépendant de l’historique', async t => {
  const { directory, project } = await fixture(t), recentPath = path.join(directory, 'recent-plans.json');
  let destination;
  const plans = createPlanFiles({ chooseSavePath: async () => destination, recentPath });
  for (let i = 0; i < 22; i++) { destination = path.join(directory, `plan-${i}.plano`); await plans.save(project, true); }
  const rows = await plans.listRecent();
  assert.equal(rows.length, 20); assert.equal(rows[0].filePath, destination); assert.equal(rows[19].name, 'plan-2.plano');
  const failedHistory = createPlanFiles({ chooseSavePath: async () => destination, recentPath: path.join(destination, 'invalid.json') });
  await failedHistory.save({ ...project, shelves: 9 });
  assert.equal(JSON.parse(await fs.readFile(destination, 'utf8')).shelves, 9);
});
