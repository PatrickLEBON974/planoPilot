import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, capacity, columnMeters, columnFraction, fractionColumn, demoProject, generate, getGroups, linearShare, mergeGroups, normalizeProject, parseNumber, resizeMass, setMassUnits, totalSales, validBlock } from '../src/domain.ts';

test('les plus grands restes conservent exactement la capacité, y compris sans ventes', () => {
  for (let n = 1; n <= 70; n++) for (let total = 0; total <= 220; total += 11) {
    const weights = Array.from({ length: n }, (_, i) => Math.sin(i * 7 + n) ** 2 * 1200);
    const result = allocate(weights, total);
    assert.equal(result.reduce((a, b) => a + b, 0), total);
    assert.ok(result.every(x => Number.isInteger(x) && x >= 0));
  }
  assert.deepEqual(allocate([0, 0, 0], 5), [2, 2, 1]);
  assert.deepEqual(allocate([], 5), []);
});
test('un demi-élément garde sa largeur physique et sa capacité entière', () => {
  const p = { ...demoProject(), elements: 2.5, unitsPerElement: 13, halfUnits: 7 };
  assert.equal(capacity(p), 33);
  assert.ok(Math.abs(columnMeters(p, 0, 33) - 3.325) < 1e-10);
  assert.ok(Math.abs(columnMeters(p, 26, 7) - .665) < 1e-10);
  assert.ok(Math.abs(columnFraction(p, 26) - .8) < 1e-10);
  assert.ok(Math.abs(fractionColumn(p, .9) - 29.5) < 1e-10);
});
test('les trois implantations automatiques respectent le meuble et les ventes', () => {
  for (const elements of [.5, 2.5, 8, 15]) {
    const p = generate({ ...demoProject(), elements, unitsPerElement: 13, halfUnits: 7 });
    assert.equal(Object.values(p.massUnits).reduce((a, b) => a + b), capacity(p));
    assert.equal(p.articlePlacements.length, capacity(p) * p.shelves);
    assert.equal(p.blockPlacements.reduce((a, b) => a + b.width * b.height, 0), capacity(p) * p.shelves);
    for (const b of p.blockPlacements) assert.ok(validBlock(p, b, b.id));
    assert.ok(Math.abs(getGroups(p).reduce((a, b) => a + b.share, 0) - 1) < 1e-10);
  }
});
test('la saisie et le redimensionnement ne modifient pas le CA et ne dépassent pas la capacité', () => {
  const p = demoProject(), group = getGroups(p)[0];
  const manually = setMassUnits(p, group.id, 25);
  assert.equal(manually.massUnits[group.id], 25);
  assert.equal(totalSales(manually), totalSales(p));
  assert.ok(Object.values(manually.massUnits).reduce((a, b) => a + b) <= capacity(p));
  const oversized = setMassUnits(p, group.id, 999);
  assert.equal(oversized.massUnits[group.id], capacity(p));
  for (const side of ['left', 'right']) {
    const resized = resizeMass(p, group.id, 999, side);
    assert.equal(Object.values(resized.massUnits).reduce((a, b) => a + b), capacity(p));
  }
});
test('un regroupement additionne les ventes et conserve chaque bloc non sélectionné', () => {
  const p = { ...demoProject(), viewMode: 'blocks' }, groups = getGroups(p), members = groups.slice(0, 2).map(g => g.id);
  const { project: next, id } = mergeGroups(p, 'Autres', members, '#2857a7');
  const merged = getGroups(next).find(g => g.id === id);
  assert.ok(Math.abs(merged.sales - groups[0].sales - groups[1].sales) < 1e-8);
  assert.equal(next.blockPlacements.length, p.blockPlacements.length);
  assert.deepEqual(next.blockPlacements.filter(b => !members.includes(p.blockPlacements.find(x => x.id === b.id).groupId)), p.blockPlacements.filter(b => !members.includes(b.groupId)));
  assert.equal(totalSales(next), totalSales(p));
  for (const group of groups.filter(g => !members.includes(g.id))) assert.equal(getGroups(next).find(g => g.id === group.id).color, group.color);
  assert.ok(Math.abs(linearShare(next, id) - members.reduce((sum, member) => sum + linearShare(p, member), 0)) < 1e-10);
});
test('le plan rouvert conserve implantations, couleurs et regroupements', () => {
  const p = demoProject(), g = getGroups(p);
  const customized = mergeGroups(p, 'Autres marques', g.slice(0, 2).map(x => x.id), '#2857a7').project;
  const reopened = normalizeProject(JSON.parse(JSON.stringify(customized)));
  assert.deepEqual(reopened, customized);
  assert.notEqual(getGroups(normalizeProject({ ...p, groupColors: {} }))[0].color, '#ffffff');
  const invalid = { ...p, blockPlacements: [p.blockPlacements[0], { ...p.blockPlacements[0], id: 'overlap' }] };
  assert.throws(() => normalizeProject(invalid), /chevauchement/);
});
test('les nombres français et internationaux sont lus sans perdre les décimales', () => {
  assert.equal(parseNumber('74 594,21 €'), 74594.21);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('abc'), null);
});
