const origin = 'https://world.openfoodfacts.org';
const searchOrigin = 'https://search.openfoodfacts.org';
const fields = 'code,product_name,product_name_fr,brands,quantity,categories,image_front_small_url,nutriscore_grade';
const text = value => typeof value === 'string' ? value.trim().slice(0, 500) : '';
const listText = value => text(Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : value);

export function productURL(code) {
  if (typeof code !== 'string' || !/^\d{4,24}$/.test(code)) throw new Error('Code produit Open Food Facts invalide.');
  return `${origin}/product/${code}`;
}

export function searchURL(request) {
  if (!request || typeof request !== 'object') throw new Error('Saisissez un nom, une marque ou un code-barres valide.');
  const { query, page = 1 } = request;
  if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 120 || !Number.isInteger(page) || page < 1 || page > 100) throw new Error('Saisissez un nom, une marque ou un code-barres valide.');
  const term = query.trim(), barcode = term.replace(/\s/g, '');
  const url = /^\d{8,14}$/.test(barcode) ? new URL(`/api/v3.6/product/${barcode}.json`, origin) : new URL('/search', searchOrigin);
  if (url.origin === origin) {
    url.searchParams.set('fields', fields);
    url.searchParams.set('lc', 'fr');
  }
  return url;
}

function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.code !== 'string' || !/^\d{4,24}$/.test(raw.code)) return null;
  let imageUrl = '';
  try {
    const url = new URL(text(raw.image_front_small_url));
    if (url.protocol === 'https:' && url.hostname === 'images.openfoodfacts.org' && !url.port && !url.username && !url.password && url.pathname.startsWith('/images/products/')) imageUrl = url.href;
  } catch { /* Products can have no photo. */ }
  return {
    code: raw.code, name: text(raw.product_name_fr) || text(raw.product_name) || text(raw.product_name?.fr) || text(raw.product_name?.en), brands: listText(raw.brands), quantity: text(raw.quantity),
    categories: listText(raw.categories).split(',').map(value => value.trim()).filter(Boolean), imageUrl, sourceUrl: productURL(raw.code),
    nutriscore: /^[a-e]$/.test(raw.nutriscore_grade) ? raw.nutriscore_grade : '',
  };
}

export function createOpenFoodFactsClient({ fetcher = globalThis.fetch, now = Date.now, userAgent = 'PlanoPilot/1.2.0', timeoutMs = 20000 } = {}) {
  const cache = new Map(), pending = new Map();
  let requests = [];
  return async request => {
    const url = searchURL(request);
    url.searchParams.set('user_agent', userAgent);
    const barcode = url.origin === origin;
    const body = barcode ? undefined : JSON.stringify({ q: request.query.trim(), page: request.page || 1, page_size: 20, langs: ['fr', 'en'], fields: fields.split(',') });
    const key = JSON.stringify([url.href, body]);
    const cached = cache.get(key);
    if (cached && now() - cached.time < 300000) return cached.result;
    if (pending.has(key)) return pending.get(key);
    requests = requests.filter(time => now() - time < 60000);
    if (requests.length >= 10) throw new Error('Trop de recherches rapprochées. Attendez une minute avant de réessayer.');
    requests.push(now());
    const task = (async () => {
      let response;
      try {
        response = await fetcher(url.href, { method: barcode ? 'GET' : 'POST', body, headers: { Accept: 'application/json', 'User-Agent': userAgent, ...(!barcode ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit' });
      } catch (error) {
        const timeout = error.name === 'TimeoutError' || error.name === 'AbortError' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || /ERR_(?:CONNECTION_)?TIMED_OUT/.test(error.message);
        throw new Error(timeout ? 'La recherche a pris trop de temps. Réessayez dans un instant.' : 'Connexion à Open Food Facts impossible. Vérifiez votre connexion Internet.', { cause: error });
      }
      if (response.status === 429) throw new Error('Open Food Facts limite les recherches. Attendez une minute avant de réessayer.');
      if (!response.ok && !(barcode && response.status === 404)) throw new Error('Open Food Facts est temporairement indisponible. Réessayez plus tard.');
      let raw;
      try {
        const responseBody = await response.text();
        if (responseBody.length > 5 * 1024 * 1024) throw new Error();
        raw = barcode && response.status === 404 ? { status: 0 } : JSON.parse(responseBody);
        if (!raw || typeof raw !== 'object') throw new Error();
      } catch { throw new Error('La réponse d’Open Food Facts n’a pas pu être lue. Réessayez.'); }
      if (!barcode && !Array.isArray(raw.hits)) throw new Error('La réponse d’Open Food Facts n’a pas pu être lue. Réessayez.');
      if (!barcode && raw.timed_out === true) throw new Error('La recherche a pris trop de temps. Réessayez dans un instant.');
      const products = (barcode ? raw.status === 0 ? [] : [raw.product] : raw.hits).slice(0, 20).map(normalizeProduct).filter(Boolean);
      const count = barcode ? products.length : Number.isSafeInteger(Number(raw.count)) && Number(raw.count) >= 0 ? Number(raw.count) : products.length;
      const result = { products, count, countExact: barcode || raw.is_count_exact !== false, page: request.page || 1, pageSize: barcode ? 1 : 20 };
      cache.set(key, { time: now(), result });
      if (cache.size > 50) cache.delete(cache.keys().next().value);
      return result;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
