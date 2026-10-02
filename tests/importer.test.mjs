import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestMapping, mapProducts, readWorkbook, projectWithImport } from '../src/importer.ts';
import { readFile } from 'node:fs/promises';
import { newProject, normalizeProject, capacity, getGroups } from '../src/domain.ts';
const headers = ['Référence', 'Désignation', 'Marque', 'Segment', 'Sous-segment', 'CA', 'Quantité', 'Notre référence'];
test('les colonnes sont reconnues sans confondre segment et sous-segment', () => {
  assert.deepEqual(suggestMapping(headers), { sku: 0, name: 1, brand: 2, segment: 3, subsegment: 4, sales: 5, quantity: 6, ours: 7, packaging: -1, sourceUrl: -1, supplier: -1, notes: -1 });
});
test('les lignes invalides sont signalées et les références répétées restent traçables', () => {
  const rows = [headers, ['R1', 'Tomates', 'Maison', 'Légumes', 'Tomates', '1 234,56 €', '20', 'oui'], ['R1', 'Tomates', 'Maison', 'Légumes', 'Tomates', '100', '2', 'oui'], ['R2', 'Maïs', 'Autre', 'Légumes', 'Maïs', '-4', '', 'non'], ['R3', 'Champignons', 'Autre', 'Légumes', 'Champignons', '0', '', 'concurrent']];
  const result = mapProducts(rows, 0, suggestMapping(headers), headers);
  assert.equal(result.errors.length, 1); assert.equal(result.products.length, 3); assert.equal(result.duplicates, 1);
  assert.equal(result.products[0].sales, 1234.56); assert.equal(result.products[0].ours, true); assert.equal(result.products[2].ours, false);
});
test('une appartenance absente ne transforme pas artificiellement le produit en concurrent', () => {
  const mapping = { ...suggestMapping(headers), ours: -1 };
  const result = mapProducts([headers, ['R1', 'Tomates', 'Maison', 'Légumes', 'Tomates', '100']], 0, mapping, headers);
  assert.equal(result.products[0].ours, null);
});
test('un catalogue sans ventes conserve les sources et exclut les SKU répétés', () => {
  const columns = ['Référence', 'Désignation', 'Marque', 'Segment', 'Conditionnement', 'Source', 'Fournisseur', 'Notes'];
  const line = ['R1', 'Confiture', 'Royal Bourbon', 'Confitures', 'Bocal 250 g', 'https://royalbourbon.com/confitures-de-fruits-tropicaux.html', 'Royal Bourbon Industries', 'Format publié'];
  const mapping = suggestMapping(columns);
  const rows = [columns, line, line, ['R2', '', 'Royal Bourbon', 'Confitures']];
  const result = mapProducts(rows, 0, mapping, columns, 'catalog');
  assert.equal(result.products.length, 1); assert.equal(result.duplicates, 1); assert.equal(result.errors.length, 1);
  assert.equal(result.products[0].sales, 0); assert.equal(result.products[0].quantity, undefined); assert.equal(result.products[0].ours, null);
  assert.equal(result.products[0].packaging, 'Bocal 250 g'); assert.equal(result.products[0].sourceUrl, line[5]); assert.equal(result.products[0].notes, 'Format publié');
  assert.equal(mapProducts(rows, 0, mapping, columns).products.length, 0);
});
test('le fichier Royal Bourbon est importable sans erreurs et reste intact après réouverture', async () => {
  const content = await readFile(new URL('../data/imports/royal-bourbon-produits-2026-10-01.csv', import.meta.url));
  const file = new File([content], 'royal-bourbon.csv', { type: 'text/csv' });
  const [sheet] = await readWorkbook(file), headers = sheet.rows[0];
  const result = mapProducts(sheet.rows, 0, suggestMapping(headers), headers, 'catalog');
  const metadata = JSON.parse(await readFile(new URL('../data/imports/royal-bourbon-sources.json', import.meta.url), 'utf8'));
  assert.deepEqual(result.errors, []); assert.equal(result.duplicates, 0); assert.equal(result.products.length, metadata.entries);
  assert.ok(result.products.every(p => p.sku.startsWith('RBI-WEB-') && p.sourceUrl.startsWith('https://') && p.sales === 0 && p.quantity === undefined && p.ours === null));
  assert.equal(new Set(result.products.map(p => p.brand)).size, 5);
  const project = projectWithImport({ ...newProject(), groupBy: 'segment' }, result.products, file.name, sheet.name, 'catalog');
  assert.equal(project.weightedBySales, false); assert.equal(project.targetSegment, ''); assert.equal(project.groupBy, 'segment');
  assert.equal(getGroups(project).length, 11); assert.equal(Object.values(project.massUnits).reduce((a, b) => a + b, 0), capacity(project));
  const configured = projectWithImport({ ...newProject(), elements: 2.5, shelves: 5, viewMode: 'blocks', groupBy: 'brand' }, result.products, file.name, sheet.name, 'catalog');
  assert.equal(configured.elements, 2.5); assert.equal(configured.shelves, 5); assert.equal(configured.viewMode, 'blocks'); assert.equal(configured.groupBy, 'brand');
  assert.equal(getGroups(configured).length, 5);
  const reopened = normalizeProject(JSON.parse(JSON.stringify(project)));
  assert.equal(reopened.salesMetric, 'catalog'); assert.equal(reopened.weightedBySales, false); assert.deepEqual(reopened.products, result.products);
});
