import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenFoodFactsClient, productURL, searchURL } from '../electron/open-food-facts.mjs';
import { appendOpenFoodFactsProduct, searchOpenFoodFacts } from '../src/openFoodFacts.ts';
import { demoProject, newProject, normalizeProject } from '../src/domain.ts';

const item = { code: '3017620422003', product_name: 'Nom original', product_name_fr: 'Produit de test', brands: 'Marque A', quantity: '400 g', categories: 'Épicerie, Conserves', image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.1.200.jpg', nutriscore_grade: 'a' };
const json = value => new Response(JSON.stringify(value), { status: 200 });

test('Open Food Facts : recherche textuelle paginée, code-barres exact et URLs limitées au service', async () => {
  const calls = [];
  const search = createOpenFoodFactsClient({ fetcher: async (url, options) => { calls.push({ url: new URL(url), options }); return json(url.includes('/product/') ? { status: 'success', product: item } : { count: 43, is_count_exact: true, hits: [{ ...item, brands: ['Marque A', 'Marque B'] }] }); } });
  const first = await search({ query: 'tomates & marque', page: 2 });
  assert.equal(calls[0].url.origin, 'https://search.openfoodfacts.org');
  assert.equal(calls[0].url.pathname, '/search');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.q, 'tomates & marque'); assert.equal(body.page, 2); assert.equal(body.page_size, 20);
  assert.deepEqual(body.langs, ['fr', 'en']); assert.ok(body.fields.includes('image_front_small_url'));
  assert.ok(!calls[0].url.href.includes('tomates'));
  assert.ok(calls[0].options.headers['User-Agent'].startsWith('PlanoPilot/'));
  assert.equal(first.count, 43); assert.equal(first.countExact, true); assert.equal(first.page, 2); assert.equal(first.products[0].name, 'Produit de test');
  assert.equal(first.products[0].brands, 'Marque A, Marque B');
  assert.deepEqual(first.products[0].categories, ['Épicerie', 'Conserves']);
  const exact = await search({ query: '301 762 042 2003' });
  assert.equal(calls[1].url.pathname, '/api/v3.6/product/3017620422003.json');
  assert.equal(calls[1].options.method, 'GET'); assert.equal(calls[1].options.body, undefined);
  assert.equal(exact.count, 1); assert.equal(exact.pageSize, 1);
  for (const request of [null, { query: '' }, { query: 'a' }, { query: 'x'.repeat(121) }, { query: 'riz', page: -1 }, { query: 'riz', page: 101 }]) assert.throws(() => searchURL(request), /valide/);
  assert.throws(() => productURL('https://example.org'), /invalide/);
});

test('Open Food Facts : cache, requêtes simultanées et limite de dix recherches par minute', async () => {
  let time = 100000, requests = 0;
  const search = createOpenFoodFactsClient({ now: () => time, fetcher: async () => { requests++; return json({ count: 1, hits: [item] }); } });
  await Promise.all([search({ query: 'tomates' }), search({ query: 'tomates' })]);
  assert.equal(requests, 1);
  await search({ query: 'tomates' }); assert.equal(requests, 1);
  for (let i = 0; i < 9; i++) await search({ query: `autre ${i}` });
  await assert.rejects(search({ query: 'limite' }), /Attendez une minute/);
  assert.equal(requests, 10);
  time += 60001; await search({ query: 'limite' }); assert.equal(requests, 11);
  time += 300001; await search({ query: 'tomates' }); assert.equal(requests, 12);
});

test('Open Food Facts : format Search-a-licious, nombres estimés et cache distinct pour chaque page et recherche', async () => {
  const requests = [];
  const search = createOpenFoodFactsClient({ fetcher: async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return json({ count: 10000, is_count_exact: false, page: body.page, page_size: 20, hits: [{ ...item, product_name_fr: undefined, product_name: body.q === 'tomates' ? { fr: 'Tomates', en: 'Tomatoes' } : 'Autre produit', code: body.page === 2 ? '3017620422004' : item.code }] });
  } });
  const first = await search({ query: 'tomates' }), second = await search({ query: 'tomates', page: 2 }), other = await search({ query: 'marque' });
  assert.equal(first.countExact, false); assert.equal(first.count, 10000); assert.equal(first.products[0].name, 'Tomates');
  assert.equal(second.page, 2); assert.equal(second.products[0].code, '3017620422004');
  assert.equal(other.products[0].name, 'Autre produit');
  assert.deepEqual(await search({ query: ' tomates ', page: 2 }), second);
  assert.deepEqual(await search({ query: 'tomates' }), first);
  assert.equal(requests.length, 3);
});

test('Open Food Facts : absence de produit, erreurs réseau et réponses non exploitables', async () => {
  const notFound = createOpenFoodFactsClient({ fetcher: async () => new Response('', { status: 404 }) });
  assert.deepEqual((await notFound({ query: '0000000000000' })).products, []);
  const offline = createOpenFoodFactsClient({ fetcher: async () => { throw new TypeError('failed'); } });
  await assert.rejects(offline({ query: 'riz' }), /Vérifiez votre connexion Internet/);
  const timeout = createOpenFoodFactsClient({ fetcher: async () => { throw new DOMException('expired', 'TimeoutError'); } });
  await assert.rejects(timeout({ query: 'riz' }), /trop de temps/);
  for (const error of [new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }), new Error('net::ERR_CONNECTION_TIMED_OUT')]) {
    const connectTimeout = createOpenFoodFactsClient({ fetcher: async () => { throw error; } });
    await assert.rejects(connectTimeout({ query: 'riz' }), failure => /trop de temps/.test(failure.message) && failure.cause === error);
  }
  for (const status of [429, 503]) {
    const search = createOpenFoodFactsClient({ fetcher: async () => new Response('', { status }) });
    await assert.rejects(search({ query: 'riz' }), status === 429 ? /limite les recherches/ : /temporairement indisponible/);
  }
  const malformed = createOpenFoodFactsClient({ fetcher: async () => new Response('<html>Erreur</html>') });
  await assert.rejects(malformed({ query: 'riz' }), /n’a pas pu être lue/);
  const missingHits = createOpenFoodFactsClient({ fetcher: async () => json({ count: 0 }) });
  await assert.rejects(missingHits({ query: 'riz' }), /n’a pas pu être lue/);
  const serverTimeout = createOpenFoodFactsClient({ fetcher: async () => json({ timed_out: true, count: 0, hits: [] }) });
  await assert.rejects(serverTimeout({ query: 'riz' }), /trop de temps/);
  const foreign = createOpenFoodFactsClient({ fetcher: async () => json({ count: 3, hits: [null, { ...item, code: '../path' }, { ...item, image_front_small_url: 'https://example.org/photo.png', url: 'https://example.org' }] }) });
  const result = await foreign({ query: 'riz' });
  assert.equal(result.products.length, 1); assert.equal(result.products[0].imageUrl, '');
  assert.equal(result.products[0].sourceUrl, 'https://world.openfoodfacts.org/product/3017620422003');
});

test('Open Food Facts : réessayer après un HTTP 503 et afficher une erreur sans préfixe Electron', async () => {
  let calls = 0;
  const search = createOpenFoodFactsClient({ fetcher: async () => ++calls === 1 ? new Response('', { status: 503 }) : json({ count: 1, hits: [item] }) });
  await assert.rejects(search({ query: 'riz' }), /temporairement indisponible/);
  assert.equal((await search({ query: 'riz' })).products.length, 1);
  assert.equal(calls, 2);
  const previousWindow = globalThis.window;
  globalThis.window = { plano: { searchOpenFoodFacts: async () => { throw new Error("Error invoking remote method 'open-food-facts:search': Error: Open Food Facts est temporairement indisponible. Réessayez plus tard."); } } };
  try {
    await assert.rejects(searchOpenFoodFacts('riz'), { message: 'Open Food Facts est temporairement indisponible. Réessayez plus tard.' });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('ajouter une référence conserve les ventes et implantations existantes, puis permet l’annulation', () => {
  const p = demoProject(), snapshot = structuredClone(p);
  const product = { id: 'off-test', sku: item.code, name: 'Produit de test', brand: 'Marque A', segment: p.targetSegment, subsegment: 'Non renseigné', sales: 123.45, ours: null, sourceUrl: productURL(item.code) };
  const next = appendOpenFoodFactsProduct(p, product);
  assert.equal(next.salesMetric, 'revenue'); assert.equal(next.products.at(-1).sales, 123.45);
  for (const key of ['massUnits', 'massOrder', 'blockPlacements', 'articlePlacements', 'customGroups', 'groupColors']) assert.deepEqual(next[key], snapshot[key]);
  assert.deepEqual(next.products.slice(0, -1), snapshot.products); assert.deepEqual(p, snapshot);
  assert.deepEqual(normalizeProject(JSON.parse(JSON.stringify(next))).products, next.products);
  assert.throws(() => appendOpenFoodFactsProduct(next, product), /déjà dans l’assortiment/);
  const catalog = appendOpenFoodFactsProduct({ ...newProject(), elements: 2.5, shelves: 5, viewMode: 'blocks', groupBy: 'brand' }, { ...product, sales: 0 });
  assert.equal(catalog.salesMetric, 'catalog'); assert.equal(catalog.weightedBySales, false);
  assert.equal(catalog.elements, 2.5); assert.equal(catalog.shelves, 5); assert.equal(catalog.viewMode, 'blocks'); assert.equal(catalog.groupBy, 'brand');
  assert.equal(catalog.sourceName, 'Open Food Facts'); assert.ok(catalog.articlePlacements.length);
});
