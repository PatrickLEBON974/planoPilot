import type { Block, Group, Grouping, Product, Project } from './types.ts';

export const palette = ['#2764cf', '#177c83', '#aa6a31', '#7761b3', '#ad5278', '#547c48', '#56758c', '#93633f'];
export const uid = () => crypto.randomUUID();
export function newProject(): Project {
  return { schemaVersion: 1, id: uid(), name: 'Sans titre', updatedAt: new Date().toISOString(), products: [], sourceName: '', sourceSheet: '', salesMetric: 'revenue', elements: 4, shelves: 6, unitsPerElement: 12, halfUnits: 6, viewMode: 'mass', groupBy: 'subsegment', targetSegment: '', weightedBySales: true, massUnits: {}, massOrder: [], blockPlacements: [], articlePlacements: [], customGroups: [], groupColors: {} };
}
export const capacity = (p: Pick<Project, 'elements' | 'unitsPerElement' | 'halfUnits'>) => Math.floor(p.elements) * p.unitsPerElement + (p.elements % 1 ? p.halfUnits : 0);
const scopeCache = new WeakMap<Project, Product[]>(), groupCache = new WeakMap<Project, Group[]>(), shareCache = new WeakMap<Project, Map<string, number>>();
export const scopeProducts = (p: Project) => { const cached = scopeCache.get(p); if (cached) return cached; const result = p.products.filter(x => !p.targetSegment || x.segment === p.targetSegment); scopeCache.set(p, result); return result; };
export const totalSales = (p: Project) => scopeProducts(p).reduce((s, x) => s + x.sales, 0);
export const groupKey = (level: Grouping, value: string) => `${level}:${value}`;
export function getGroups(p: Project): Group[] {
  const cached = groupCache.get(p); if (cached) return cached;
  const products = scopeProducts(p), total = totalSales(p);
  const entries = new Map<string, Product[]>();
  for (const product of products) {
    const value = product[p.groupBy] || 'Non renseigné', key = groupKey(p.groupBy, value);
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key)!.push(product);
  }
  const grouped = new Map<string, { label: string; products: Product[]; color?: string }>();
  const baselineColors = new Map([...entries.keys()].map((id, i) => [id, palette[i % palette.length]]));
  for (const [id, xs] of entries) grouped.set(id, { label: p.groupBy === 'sku' ? `${xs[0].name} · ${xs[0].sku}` : id.slice(p.groupBy.length + 1), products: xs });
  const claimed = new Set<string>();
  for (const custom of p.customGroups.filter(x => x.groupingLevel === p.groupBy)) {
    const members = custom.members.filter(id => entries.has(id) && !claimed.has(id));
    if (!members.length) continue;
    const xs = members.flatMap(id => entries.get(id) || []);
    members.forEach(id => { claimed.add(id); grouped.delete(id); });
    grouped.set(custom.id, { label: custom.label, products: xs, color: custom.color });
  }
  const results = [...grouped.entries()].map(([id, g], i) => {
    const sales = g.products.reduce((s, x) => s + x.sales, 0);
    return { id, label: g.label, sales, share: total > 0 ? sales / total : 0, references: new Set(g.products.map(x => x.sku || x.id)).size, products: g.products, color: p.groupColors[id] || g.color || baselineColors.get(id) || palette[i % palette.length] };
  });
  const order = new Map(p.massOrder.map((id, i) => [id, i]));
  results.sort((a, b) => (order.get(a.id) ?? 100000) - (order.get(b.id) ?? 100000) || b.sales - a.sales || a.id.localeCompare(b.id));
  groupCache.set(p, results); return results;
}
export function allocate(weights: number[], total: number): number[] {
  if (!weights.length) return [];
  const safe = weights.map(x => Math.max(0, Number.isFinite(x) ? x : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  const theoretical = safe.map(x => sum ? x / sum * total : total / safe.length);
  const result = theoretical.map(Math.floor);
  const remaining = total - result.reduce((a, b) => a + b, 0);
  const indices = theoretical.map((x, i) => ({ i, rest: x - result[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let i = 0; i < remaining; i++) result[indices[i].i]++;
  return result;
}
export function generate(p: Project): Project {
  const groups = getGroups(p), cap = capacity(p);
  const weights = groups.map(g => p.weightedBySales ? g.sales : 1);
  const widths = allocate(weights, cap);
  const areas = allocate(weights, cap * p.shelves);
  const placements: Block[] = [];
  let cursor = 0;
  groups.forEach((g, i) => {
    let left = areas[i];
    while (left > 0) {
      const column = cursor % cap, shelf = Math.floor(cursor / cap), width = Math.min(left, cap - column);
      placements.push({ id: uid(), groupId: g.id, label: g.label, color: g.color, column, shelf, width, height: 1 });
      cursor += width; left -= width;
    }
  });
  const products = scopeProducts(p);
  const facings = allocate(products.map(x => p.weightedBySales ? x.sales : 1), cap * p.shelves);
  let articleCursor = 0;
  const articlePlacements = products.flatMap((product, i) => Array.from({ length: facings[i] }, () => { const pos = articleCursor++; return { id: uid(), productId: product.id, column: pos % cap, shelf: Math.floor(pos / cap) }; }));
  return { ...p, massOrder: groups.map(g => g.id), massUnits: Object.fromEntries(groups.map((g, i) => [g.id, widths[i]])), blockPlacements: placements, articlePlacements };
}
export function setMassUnits(p: Project, id: string, value: number): Project {
  const groups = getGroups(p), cap = capacity(p), units = { ...p.massUnits };
  const target = Math.max(0, Math.min(cap, Math.round(value || 0)));
  units[id] = target;
  let overflow = groups.reduce((n, g) => n + (units[g.id] || 0), 0) - cap;
  const index = groups.findIndex(g => g.id === id);
  const others = [...groups.slice(index + 1), ...groups.slice(0, index).reverse()];
  for (const other of others) {
    if (overflow <= 0) break;
    const take = Math.min(overflow, units[other.id] || 0);
    units[other.id] = (units[other.id] || 0) - take; overflow -= take;
  }
  return { ...p, massUnits: units };
}
export function resizeMass(p: Project, id: string, value: number, side: 'left' | 'right'): Project {
  const groups = getGroups(p), index = groups.findIndex(g => g.id === id), old = p.massUnits[id] || 0;
  const donorIds = side === 'left' ? [...groups.slice(0, index).reverse(), ...groups.slice(index + 1)] : [...groups.slice(index + 1), ...groups.slice(0, index).reverse()];
  const units = { ...p.massUnits }, target = Math.max(1, Math.min(capacity(p), Math.round(value)));
  if (target < old) { units[id] = target; if (donorIds[0]) units[donorIds[0].id] = (units[donorIds[0].id] || 0) + old - target; }
  else {
    let needed = target - old;
    const free = capacity(p) - groups.reduce((sum, g) => sum + (units[g.id] || 0), 0);
    needed -= Math.min(needed, free);
    for (const donor of donorIds) { const take = Math.min(needed, units[donor.id] || 0); units[donor.id] = (units[donor.id] || 0) - take; needed -= take; }
    units[id] = target - needed;
  }
  return { ...p, massUnits: units };
}
export function validBlock(p: Project, candidate: Block, excludeId?: string): boolean {
  const values = [candidate.column, candidate.shelf, candidate.width, candidate.height];
  if (values.some(x => !Number.isInteger(x))) return false;
  if (candidate.column < 0 || candidate.shelf < 0 || candidate.width < 1 || candidate.height < 1 || candidate.column + candidate.width > capacity(p) || candidate.shelf + candidate.height > p.shelves) return false;
  return !p.blockPlacements.some(b => b.id !== excludeId && candidate.column < b.column + b.width && candidate.column + candidate.width > b.column && candidate.shelf < b.shelf + b.height && candidate.shelf + candidate.height > b.shelf);
}
export function linearShare(p: Project, groupId: string): number {
  if (!shareCache.has(p)) {
    const cap = capacity(p), shares = new Map<string, number>();
    if (p.viewMode === 'mass') getGroups(p).forEach(g => shares.set(g.id, (p.massUnits[g.id] || 0) / cap));
    else if (p.viewMode === 'blocks') p.blockPlacements.forEach(b => { if (b.groupId) shares.set(b.groupId, (shares.get(b.groupId) || 0) + b.width * b.height / (cap * p.shelves)); });
    else { const productGroups = new Map(getGroups(p).flatMap(g => g.products.map(x => [x.id, g.id] as const))); p.articlePlacements.forEach(a => { const id = productGroups.get(a.productId); if (id) shares.set(id, (shares.get(id) || 0) + 1 / (cap * p.shelves)); }); }
    shareCache.set(p, shares);
  }
  return shareCache.get(p)!.get(groupId) || 0;
}
export function mergeGroups(p: Project, label: string, members: string[], color: string): { project: Project; id: string } {
  const id = `custom-${uid()}`, groups = getGroups(p), units = { ...p.massUnits }, set = new Set(members);
  units[id] = members.reduce((sum, member) => sum + (units[member] || 0), 0);
  members.forEach(member => delete units[member]);
  let inserted = false;
  const order = groups.flatMap(g => { if (!set.has(g.id)) return [g.id]; if (inserted) return []; inserted = true; return [id]; });
  return { id, project: { ...p, customGroups: [...p.customGroups, { id, label, members, color, groupingLevel: p.groupBy }], massUnits: units, massOrder: order, groupColors: { ...p.groupColors, [id]: color }, blockPlacements: p.blockPlacements.map(b => set.has(b.groupId || '') ? { ...b, groupId: id, label, color } : b) } };
}
export function findSpace(p: Project, width: number, height: number): { column: number; shelf: number } | null {
  for (let shelf = 0; shelf <= p.shelves - height; shelf++) for (let column = 0; column <= capacity(p) - width; column++) if (validBlock(p, { id: '', groupId: null, label: '', color: '', column, shelf, width, height })) return { column, shelf };
  return null;
}
export function textColor(hex: string): string { const [r, g, b] = [1, 3, 5].map(i => { const channel = parseInt(hex.slice(i, i + 2), 16) / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b > .179 ? '#13243e' : '#ffffff'; }
export function columnMeters(p: Project, start: number, width: number): number {
  return (columnFraction(p, start + width) - columnFraction(p, start)) * p.elements * 1.33;
}
export function columnFraction(p: Project, column: number): number {
  const fullColumns = Math.floor(p.elements) * p.unitsPerElement;
  const meters = fullColumns === 0 ? column * .665 / p.halfUnits : Math.min(column, fullColumns) * 1.33 / p.unitsPerElement + Math.max(0, column - fullColumns) * .665 / p.halfUnits;
  return meters / (p.elements * 1.33);
}
export function fractionColumn(p: Project, fraction: number): number {
  const meters = fraction * p.elements * 1.33, fullMeters = Math.floor(p.elements) * 1.33, fullColumns = Math.floor(p.elements) * p.unitsPerElement;
  return fullColumns === 0 ? meters / .665 * p.halfUnits : meters <= fullMeters ? meters / 1.33 * p.unitsPerElement : fullColumns + (meters - fullMeters) / .665 * p.halfUnits;
}
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value ?? '').trim().replace(/[\s\u00a0\u202f€]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function normalizeProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Le fichier ne contient pas un plan PlanoPilot.');
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== undefined && data.schemaVersion !== 1) throw new Error('Cette version de plan n’est pas prise en charge.');
  if (!Array.isArray(data.products) || typeof data.name !== 'string') throw new Error('Le plan est incomplet.');
  const p = { ...newProject(), ...structuredClone(data) } as Project;
  if ((p.viewMode as string) === 'block') p.viewMode = 'blocks';
  if ((p.groupBy as string) === 'reference') p.groupBy = 'sku';
  if (!p.id) p.id = uid();
  if (typeof p.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(p.id)) throw new Error('L’identifiant du plan est invalide.');
  p.name = p.name.trim() || 'Plan sans titre';
  p.sourceName = typeof p.sourceName === 'string' ? p.sourceName : '';
  p.sourceSheet = typeof p.sourceSheet === 'string' ? p.sourceSheet : '';
  p.targetSegment = typeof p.targetSegment === 'string' ? p.targetSegment : '';
  p.salesMetric = p.salesMetric === 'catalog' ? 'catalog' : p.salesMetric === 'units' ? 'units' : 'revenue';
  if (p.salesMetric === 'catalog') p.weightedBySales = false;
  p.weightedBySales = p.weightedBySales !== false;
  if (data.halfUnits === undefined) p.halfUnits = Math.ceil(p.unitsPerElement / 2);
  if (typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt))) p.updatedAt = new Date().toISOString();
  const integer = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
  if (typeof p.elements !== 'number' || p.elements < 0.5 || p.elements > 15 || p.elements * 2 % 1 || !integer(p.shelves, 4, 9) || !integer(p.unitsPerElement, 1, 100) || !integer(p.halfUnits, 1, 100)) throw new Error('La configuration du meuble est invalide.');
  if (!['mass', 'blocks', 'articles'].includes(p.viewMode) || !['segment', 'subsegment', 'brand', 'sku'].includes(p.groupBy)) throw new Error('Le type de plan est invalide.');
  const productIds = new Set<string>();
  p.products = p.products.map((x, i) => {
    if (!x || typeof x.name !== 'string' || typeof x.brand !== 'string' || typeof x.segment !== 'string' || typeof x.sales !== 'number' || !Number.isFinite(x.sales) || x.sales < 0) throw new Error(`Produit invalide à la ligne ${i + 1}.`);
    const id = x.id || uid();
    if (typeof id !== 'string' || productIds.has(id)) throw new Error(`Identifiant de produit dupliqué ou invalide à la ligne ${i + 1}.`);
    productIds.add(id);
    const product = { ...x };
    for (const key of ['packaging', 'sourceUrl', 'supplier', 'notes'] as const) if (typeof product[key] !== 'string') delete product[key];
    return { ...product, id, sku: String(x.sku || `REF-${i + 1}`), subsegment: String(x.subsegment || ''), ours: typeof x.ours === 'boolean' ? x.ours : null };
  });
  const colorValid = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
  p.groupColors = p.groupColors && typeof p.groupColors === 'object' ? Object.fromEntries(Object.entries(p.groupColors).filter(([, value]) => colorValid(value))) : {};
  const customIds = new Set<string>(), customMembers = new Set<string>();
  p.customGroups = (Array.isArray(p.customGroups) ? p.customGroups : []).map(g => {
    if (!g || typeof g.label !== 'string' || !Array.isArray(g.members) || g.members.some(x => typeof x !== 'string') || !['segment', 'subsegment', 'brand', 'sku'].includes(g.groupingLevel)) throw new Error('Un regroupement est invalide.');
    const id = g.id || `custom-${uid()}`;
    if (typeof id !== 'string' || customIds.has(id)) throw new Error('Un regroupement possède un identifiant dupliqué.');
    customIds.add(id);
    const members = g.members.map(member => member.startsWith(`${g.groupingLevel}:`) ? member : groupKey(g.groupingLevel, member));
    for (const member of members) { if (customMembers.has(member)) throw new Error('Un groupe appartient à plusieurs regroupements.'); customMembers.add(member); }
    return { ...g, id, members, color: colorValid(g.color) ? g.color : '#2764cf' };
  });
  const activeGroups = getGroups({ ...p, massOrder: [] });
  const resolveGroup = (key: string) => activeGroups.find(g => g.id === key || g.label === key)?.id || key;
  p.groupColors = Object.fromEntries(Object.entries(p.groupColors).map(([key, value]) => [resolveGroup(key), value]));
  p.massOrder = (Array.isArray(p.massOrder) ? p.massOrder : []).filter(x => typeof x === 'string').map(resolveGroup);
  p.massUnits = p.massUnits && typeof p.massUnits === 'object' ? Object.fromEntries(Object.entries(p.massUnits).map(([key, value]) => [resolveGroup(key), value])) : {};
  let occupied = 0;
  for (const g of getGroups(p)) {
    const n = p.massUnits[g.id] ?? 0;
    if (!integer(n, 0, capacity(p))) throw new Error('Une attribution d’unités est invalide.');
    occupied += n;
  }
  if (occupied > capacity(p)) throw new Error('Les unités dépassent la capacité du meuble.');
  const blocks = Array.isArray(p.blockPlacements) ? p.blockPlacements : [];
  p.blockPlacements = [];
  const blockIds = new Set<string>();
  for (const b of blocks) {
    if (!b || typeof b !== 'object') throw new Error('Le plan contient un bloc invalide.');
    const legacyGroup = (b as unknown as { group?: string }).group;
    const associated = activeGroups.find(g => g.id === b.groupId || g.label === legacyGroup);
    const block = { ...b, id: b.id || uid(), groupId: associated?.id || null, label: typeof b.label === 'string' ? b.label : associated?.label || legacyGroup || 'Bloc', color: colorValid(b.color) ? b.color : associated?.color || '#2764cf' };
    if (typeof block.id !== 'string' || blockIds.has(block.id) || !validBlock(p, block)) throw new Error('Le plan contient un bloc hors du meuble ou un chevauchement.');
    p.blockPlacements.push(block); blockIds.add(block.id);
  }
  const occupiedArticles = new Set<string>(), articleIds = new Set<string>();
  p.articlePlacements = (Array.isArray(p.articlePlacements) ? p.articlePlacements : []).map(a => {
    if (!a || typeof a !== 'object') throw new Error('Une implantation à l’article est invalide.');
    const key = `${a.column}:${a.shelf}`;
    if (typeof a.id !== 'string' || articleIds.has(a.id) || !integer(a.column, 0, capacity(p) - 1) || !integer(a.shelf, 0, p.shelves - 1) || occupiedArticles.has(key) || !p.products.some(x => x.id === a.productId)) throw new Error('Une référence est placée hors du meuble ou en doublon dans une case.');
    articleIds.add(a.id);
    occupiedArticles.add(key); return a;
  });
  return p;
}
export function demoProject(): Project {
  const p = newProject(); p.name = 'Exemple · Conserves de légumes'; p.targetSegment = 'Conserves de légumes'; p.sourceName = 'Données fictives de démonstration';
  const labels = ['Tomates', 'Maïs', 'Champignons', 'Légumes salades', 'Autres grains'];
  const sales = [74594, 61320, 47280, 53100, 152290];
  p.products = labels.flatMap((subsegment, i) => Array.from({ length: [12, 9, 8, 10, 15][i] }, (_, j) => ({ id: uid(), sku: `REF-${i + 1}${String(j + 1).padStart(3, '0')}`, name: `${subsegment} ${j % 2 ? '400' : '250'} g`, brand: ['Marque A', 'Marque B', 'Marque C'][j % 3], segment: 'Conserves de légumes', subsegment, sales: sales[i] / [12, 9, 8, 10, 15][i], quantity: 400 + j * 31, ours: j % 3 === 0 })));
  return generate(p);
}
