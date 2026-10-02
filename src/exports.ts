import Papa from 'papaparse';
import { capacity, columnMeters, getGroups, linearShare, scopeProducts, totalSales, textColor, columnFraction } from './domain.ts';
import { groupingLabels, modeLabels, number, percent, salesText } from './format.ts';
import type { Group, Project } from './types.ts';

export function csvContent(p: Project): string {
  const groups = getGroups(p), lookup = new Map(groups.map(g => [g.id, g]));
  const products = new Map(p.products.map(x => [x.id, x]));
  let start = 0;
  const rows: Record<string, string | number>[] = p.viewMode === 'mass' ? groups.map(g => {
    const width = p.massUnits[g.id] || 0, meters = columnMeters(p, start, width); start += width;
    return { Groupe: g.label, Ventes: (p.salesMetric === 'catalog' ? '' : number(g.sales, 2)), 'Part des ventes (%)': (p.salesMetric === 'catalog' ? '' : number(g.share * 100, 4)), Unités: width, 'Part de linéaire (%)': number(linearShare(p, g.id) * 100, 4), 'Largeur (m)': number(meters, 3), Références: g.references };
  }) : p.viewMode === 'blocks' ? p.blockPlacements.map(b => ({
    Groupe: lookup.get(b.groupId || '')?.label || b.label, 'Tablette de départ': b.shelf + 1, 'Unité de départ': b.column + 1, Largeur: b.width, Hauteur: b.height, Cases: b.width * b.height,
    'Ventes du groupe (non additives entre blocs)': (p.salesMetric === 'catalog' ? '' : number(lookup.get(b.groupId || '')?.sales || 0, 2)), 'Identifiant du groupe': b.groupId || '',
  })) : p.articlePlacements.map(a => {
    const product = products.get(a.productId)!;
    return { Tablette: a.shelf + 1, Position: a.column + 1, Référence: product.sku, Produit: product.name, Marque: product.brand, Segment: product.segment, 'Sous-segment': product.subsegment, Ventes: (p.salesMetric === 'catalog' ? '' : number(product.sales, 2)) };
  });
  return '\ufeff' + Papa.unparse(rows, { delimiter: ';', newline: '\r\n', escapeFormulae: true });
}
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]!));
const validColor = (color: string) => /^#[a-f0-9]{6}$/i.test(color) ? color : '#2764cf';
export function pdfPayload(p: Project): { name: string; html: string; width: number; height: number } {
  const groups = getGroups(p), cap = capacity(p), sales = totalSales(p), lookup = new Map(groups.map(g => [g.id, g]));
  const productLookup = new Map(p.products.map(x => [x.id, x])), productGroups = new Map(groups.flatMap(g => g.products.map(x => [x.id, g] as const)));
  const appendix = groups.length > 60;
  const columns = appendix ? 1 : groups.length > 30 ? 3 : groups.length > 14 ? 2 : 1;
  const rowCount = Math.ceil(groups.length / columns);
  let height = 1122;
  if (!appendix) {
    const tableHeight = Math.max(...Array.from({ length: columns }, (_, c) => groups.slice(c * rowCount, (c + 1) * rowCount).reduce((sum, g) => sum + 28 + Math.floor(g.label.length / (columns === 1 ? 85 : columns === 2 ? 35 : 22)) * 14, 0)), 0);
    height = Math.max(1122, 680 + tableHeight);
  }
  const width = Math.max(1587, Math.ceil(height * 1.4143));
  let cursor = 0;
  const rects = p.viewMode === 'mass' ? groups.filter(g => (p.massUnits[g.id] || 0) > 0).map(g => {
    const w = p.massUnits[g.id], x = cursor; cursor += w;
    return { x, y: 0, w, h: p.shelves, label: g.label, color: g.color, sub: `${percent(linearShare(p, g.id))} du linéaire · ${(p.salesMetric === 'catalog' ? '—' : percent(g.share))} des ventes` };
  }) : p.viewMode === 'blocks' ? p.blockPlacements.map(b => ({ x: b.column, y: b.shelf, w: b.width, h: b.height, label: lookup.get(b.groupId || '')?.label || b.label, color: lookup.get(b.groupId || '')?.color || b.color, sub: `${percent(b.groupId ? linearShare(p, b.groupId) : b.width * b.height / (cap * p.shelves))} du linéaire · ${(p.salesMetric === 'catalog' ? '—' : percent(lookup.get(b.groupId || '')?.share || 0))} des ventes` })) : p.articlePlacements.map(a => {
    const product = productLookup.get(a.productId)!;
    return { x: a.column, y: a.shelf, w: 1, h: 1, label: product.name, color: productGroups.get(product.id)?.color || '#2764cf', sub: product.sku };
  });
  const blocks = rects.map(b => `<div class="block" style="left:${columnFraction(p, b.x) * 100}%;top:${b.y / p.shelves * 100}%;width:${(columnFraction(p, b.x + b.w) - columnFraction(p, b.x)) * 100}%;height:${b.h / p.shelves * 100}%;color:${textColor(validColor(b.color))};background:${validColor(b.color)}"><strong>${escape(b.label)}</strong><span>${escape(b.sub)}</span></div>`).join('');
  const boundaries = Array.from({ length: Math.floor(p.elements) }, (_, i) => (i + 1) * p.unitsPerElement).filter(x => x < cap).map(x => `<div class="element" style="left:${columnFraction(p, x) * 100}%"></div>`).join('');
  const shelves = Array.from({ length: p.shelves - 1 }, (_, i) => `<div class="shelf" style="top:${(i + 1) / p.shelves * 100}%"></div>`).join('');
  cursor = 0;
  const meters = new Map(groups.map(g => { const value = columnMeters(p, cursor, p.massUnits[g.id] || 0); cursor += p.massUnits[g.id] || 0; return [g.id, value]; }));
  const occupied = new Map<string, number>();
  if (p.viewMode === 'blocks') p.blockPlacements.forEach(b => { if (b.groupId) occupied.set(b.groupId, (occupied.get(b.groupId) || 0) + b.width * b.height); });
  if (p.viewMode === 'articles') p.articlePlacements.forEach(a => { const g = productGroups.get(a.productId); if (g) occupied.set(g.id, (occupied.get(g.id) || 0) + 1); });
  const table = (xs: Group[]) => `<table><thead><tr><th>Groupe</th><th>${p.salesMetric === 'revenue' ? 'Chiffre d’affaires' : 'Ventes'}</th><th>Part ventes</th><th>Part linéaire</th><th>${p.viewMode === 'mass' ? 'Largeur' : 'Cases'}</th><th>Références</th></tr></thead><tbody>${xs.map(g => `<tr><td><i style="background:${validColor(g.color)}"></i>${escape(g.label)}</td><td>${escape(salesText(g.sales, p.salesMetric))}</td><td>${escape((p.salesMetric === 'catalog' ? '—' : percent(g.share)))}</td><td>${escape(percent(linearShare(p, g.id)))}</td><td>${p.viewMode === 'mass' ? `${number(meters.get(g.id) || 0, 2)} m` : occupied.get(g.id) || 0}</td><td>${g.references}</td></tr>`).join('')}</tbody></table>`;
  const summaries = appendix ? table(groups.slice(0, 8)) : Array.from({ length: columns }, (_, c) => table(groups.slice(c * rowCount, (c + 1) * rowCount))).join('');
  const total = `Total ventes : ${escape(salesText(sales, p.salesMetric))} · Parts des ventes : ${p.salesMetric === 'catalog' ? 'Non renseignées' : sales > 0 ? '100 %' : '0 %'}`;
  const source = `Source : ${escape(p.sourceName)}${p.sourceSheet ? ` / ${escape(p.sourceSheet)}` : ''} · ${new Date().toLocaleDateString('fr-FR')}`;
  const chunks: Group[][] = [];
  if (appendix) {
    let chunk: Group[] = [], used = 0;
    for (const g of groups) { const rowHeight = 30 + Math.floor(g.label.length / 80) * 14; if (chunk.length && used + rowHeight > 820) { chunks.push(chunk); chunk = []; used = 0; } chunk.push(g); used += rowHeight; }
    if (chunk.length) chunks.push(chunk);
  }
  const appendices = chunks.map((xs, i) => `<section class="page annex"><header><div><h1>Tableau commercial · ${escape(p.targetSegment || 'Tous les segments')}</h1><p>${escape(p.name)} · Annexe ${i + 1} sur ${chunks.length}</p></div><div class="brand">PlanoPilot</div></header><div class="annex-table">${table(xs)}</div><footer><span>${total}</span><span>Page ${i + 2} / ${chunks.length + 1}</span></footer></section>`).join('');
  const css = `@page{size:${width}px ${height}px;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;font:15px 'Segoe UI',Arial,sans-serif;color:#1b2b44}.page{width:${width}px;height:${height}px;padding:46px 50px;break-after:page;position:relative}.page:last-child{break-after:auto}header{display:flex;justify-content:space-between;align-items:flex-start;gap:25px}h1{font-size:30px;margin:0 0 8px;overflow-wrap:anywhere}p{margin:0;color:#66758a}.brand{font-size:23px;font-weight:800;color:#2764cf;white-space:nowrap}.meta{display:flex;gap:38px;margin:28px 0 24px;padding:18px 22px;background:#f1f5fa;border-radius:12px}.meta strong{display:block;font-size:19px;margin-top:5px}.meta span{font-size:12px;color:#66758a}.board{height:340px;position:relative;background:#f5f7fa;border:2px solid #1b2b44}.block{position:absolute;border:1px solid #fff8;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:5px;overflow:hidden}.block strong{font-size:${p.viewMode === 'articles' ? 8 : 15}px;overflow-wrap:anywhere}.block span{font-size:${p.viewMode === 'articles' ? 7 : 11}px;margin-top:8px;overflow-wrap:anywhere}.element{position:absolute;top:0;bottom:0;border-left:1px dashed #ffffff70;z-index:2}.shelf{position:absolute;left:0;right:0;border-top:1px solid #ffffff55;z-index:1}.caption{margin:9px 0 23px;font-size:12px}.tables{display:grid;grid-template-columns:repeat(${columns},1fr);gap:26px}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}th{text-align:right;padding:10px 6px;background:#f1f5fa;color:#66758a;font-size:10px}th:first-child{text-align:left;width:35%}th:nth-child(2){width:19%}td{padding:7px 6px;text-align:right;border-bottom:1px solid #e7ecf3;overflow-wrap:anywhere;vertical-align:top}td:first-child{text-align:left}tr{break-inside:avoid}i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:7px}h2{font-size:16px;margin:0 0 14px}footer{display:flex;justify-content:space-between;gap:20px;margin-top:22px;color:#66758a;font-size:11px}.annex header h1{font-size:24px}.annex-table{margin-top:35px}.annex footer{position:absolute;bottom:35px;left:50px;right:50px}.annex th:first-child{width:40%}.note{font-size:11px;margin-top:10px;color:#66758a}`;
  const independent = p.blockPlacements.filter(b => !b.groupId);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(p.name)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>${css}</style></head><body><section class="page"><header><div><h1>${escape(p.name)}</h1><p>${escape(p.targetSegment || 'Tous les segments')} · ${escape(modeLabels[p.viewMode])} · ${escape(groupingLabels[p.groupBy])}</p></div><div class="brand">PlanoPilot</div></header><div class="meta"><div><span>ÉLÉMENTS</span><strong>${number(p.elements, 1)}</strong></div><div><span>LARGEUR TOTALE</span><strong>${number(p.elements * 1.33, 2)} m</strong></div><div><span>TABLETTES</span><strong>${p.shelves}</strong></div><div><span>${p.salesMetric === 'revenue' ? 'CHIFFRE D’AFFAIRES' : 'VENTES'}</span><strong>${escape(salesText(sales, p.salesMetric))}</strong></div><div><span>RÉFÉRENCES</span><strong>${new Set(scopeProducts(p).map(x => x.sku)).size}</strong></div></div><div class="board">${blocks}${shelves}${boundaries}</div><p class="caption">Lecture de haut en bas · ${p.shelves} tablettes · Bande descriptive exclue de la capacité</p><h2>${appendix ? 'Aperçu de la répartition — Tableau complet dans les annexes' : 'Répartition commerciale et implantation'} · ${escape(p.targetSegment || 'Tous les segments')}</h2><div class="tables">${summaries}</div>${p.viewMode === 'blocks' && independent.length ? `<p class="note">Blocs indépendants : ${independent.map(b => escape(b.label)).join(', ')} · ${percent(independent.reduce((sum, b) => sum + b.width * b.height, 0) / (cap * p.shelves))} du linéaire · Ventes non attribuées.</p>` : ''}<footer><span>${total}</span><span>${source}</span></footer></section>${appendices}</body></html>`;
  return { name: p.name, html, width, height };
}
