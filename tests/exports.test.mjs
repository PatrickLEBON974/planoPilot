import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { demoProject, generate, getGroups, textColor } from '../src/domain.ts';
import { csvContent, pdfPayload } from '../src/exports.ts';
import { salesText } from '../src/format.ts';
test('les exports CSV conservent les métriques et neutralisent les formules des libellés', () => {
  const p = demoProject(), first = p.products[0];
  const formula = '=HYPERLINK("https://exemple.invalid")';
  const hostile = generate({ ...p, products: [{ ...first, subsegment: formula, sales: 100 }], customGroups: [] });
  const content = csvContent(hostile), parsed = Papa.parse(content.slice(1), { header: true, delimiter: ';' });
  assert.equal(parsed.data[0].Groupe, `'${formula}`);
  assert.equal(Number(parsed.data[0].Unités), 48);
  assert.equal(parsed.data[0]['Part des ventes (%)'], '100,0000');
});
test('le PDF utilise les couleurs du plan, échappe le HTML et garde un titre propre', () => {
  const p = { ...demoProject(), name: 'Plan <script>texte</script>' };
  const report = pdfPayload(p);
  assert.ok(report.html.includes('<title>Plan &lt;script&gt;texte&lt;/script&gt;</title>'));
  assert.ok(!report.html.includes('<script>'));
  for (const group of getGroups(p)) assert.ok(report.html.includes(group.color));
  assert.equal(textColor('#ffffff'), '#13243e'); assert.equal(textColor('#000000'), '#ffffff');
});
test('un grand tableau est complet dans les annexes sans produire une page géante', () => {
  const p = demoProject(), product = p.products[0];
  const large = generate({ ...p, groupBy: 'brand', products: Array.from({ length: 5000 }, (_, i) => ({ ...product, id: `prod-${i}`, sku: `ref-${i}`, brand: `Marque-${i}`, sales: i + 1 })), customGroups: [] });
  const report = pdfPayload(large);
  assert.equal(report.width, 1587); assert.equal(report.height, 1122);
  for (const brand of ['Marque-0', 'Marque-4999', 'Marque-2398']) assert.ok(report.html.includes(brand));
  assert.ok(report.html.includes('Tableau complet dans les annexes'));
  assert.ok(report.html.length < 10 * 1024 * 1024);
});
test('les exports de catalogue ne présentent pas les ventes inconnues comme zéro', () => {
  const p = generate({ ...demoProject(), salesMetric: 'catalog', weightedBySales: false });
  assert.equal(salesText(0, 'catalog'), 'Non renseigné');
  for (const viewMode of ['mass', 'blocks', 'articles']) {
    const rows = Papa.parse(csvContent({ ...p, viewMode }).slice(1), { header: true, delimiter: ';' }).data;
    const field = viewMode === 'blocks' ? 'Ventes du groupe (non additives entre blocs)' : 'Ventes';
    assert.ok(rows.length > 0); assert.ok(rows.every(row => row[field] === ''));
  }
  const html = pdfPayload(p).html;
  assert.ok(html.includes('Non renseigné')); assert.ok(html.includes('Parts des ventes : Non renseignées'));
  assert.ok(!html.includes('0,0 % des ventes'));
});
