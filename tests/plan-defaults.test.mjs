import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPlanDefaults, savePlanDefaults } from '../src/storage.ts';
import { newPlanWithDefaults } from '../src/planSettings.ts';

const initial = { elements: 4, shelves: 6, unitsPerElement: 12, halfUnits: 6, viewMode: 'mass', groupBy: 'subsegment' };
const custom = { elements: 2.5, shelves: 5, unitsPerElement: 13, halfUnits: 7, viewMode: 'articles', groupBy: 'brand' };
const key = 'planopilot:plan-defaults:v1';
function memoryStorage(t) {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  t.after(() => { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; });
  return values;
}

test('paramètres par défaut : mémorisation des réglages sans données ni identité de fichier', t => {
  const values = memoryStorage(t);
  assert.deepEqual(initialPlanDefaults(), initial);
  savePlanDefaults({ ...custom, id: 'ancien-plan', products: [{ id: 'ancien-produit' }], name: 'Ancien fichier' });
  assert.deepEqual(JSON.parse(values.get(key)), custom);
  assert.deepEqual(initialPlanDefaults(), custom);
  const first = newPlanWithDefaults(initialPlanDefaults()), second = newPlanWithDefaults(initialPlanDefaults());
  for (const field of Object.keys(custom)) assert.equal(first[field], custom[field]);
  assert.notEqual(first.id, second.id); assert.notEqual(first.id, 'ancien-plan'); assert.deepEqual(first.products, []);
  assert.equal(first.name, 'Sans titre'); assert.equal(first.sourceName, '');
});

test('paramètres par défaut : préférences absentes, corrompues ou hors limites', t => {
  const values = memoryStorage(t);
  for (const raw of ['{', 'null', '[]', JSON.stringify({ elements: 2 }), ...[
    { elements: '2.5' }, { elements: 2.25 }, { elements: 20 }, { shelves: 3 }, { unitsPerElement: 0 }, { halfUnits: 1.5 }, { viewMode: 'inconnu' }, { groupBy: 'inconnu' },
  ].map(change => JSON.stringify({ ...custom, ...change }))]) {
    values.set(key, raw); assert.deepEqual(initialPlanDefaults(), initial);
  }
  assert.throws(() => savePlanDefaults({ ...custom, shelves: 10 }), /invalides/);
});

test('paramètres par défaut : une erreur de stockage ne prétend pas enregistrer les réglages', t => {
  memoryStorage(t);
  globalThis.localStorage = { getItem: () => { throw new Error('unavailable'); }, setItem: () => { throw new Error('unavailable'); } };
  assert.deepEqual(initialPlanDefaults(), initial);
  assert.throws(() => savePlanDefaults(custom), /unavailable/);
});
