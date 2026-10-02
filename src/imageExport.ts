import { capacity, columnFraction, getGroups, linearShare, textColor } from './domain';
import { groupingLabels, modeLabels, number, percent } from './format';
import type { Project } from './types';

type ImageBlock = { column: number; shelf: number; width: number; height: number; label: string; color: string; details: string[] };
const fontFamily = "'Segoe UI', Arial, sans-serif";
const color = (value: string) => /^#[a-f\d]{6}$/i.test(value) ? value : '#2764cf';

function textLines(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  let remaining = text.replace(/\s+/g, ' ').trim();
  const lines: string[] = [];
  if (width < ctx.measureText('…').width || maxLines < 1) return lines;
  while (remaining && lines.length < maxLines) {
    if (ctx.measureText(remaining).width <= width) { lines.push(remaining); remaining = ''; break; }
    const chars = Array.from(remaining);
    let low = 1, high = chars.length;
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (ctx.measureText(chars.slice(0, mid).join('')).width <= width) low = mid; else high = mid - 1; }
    let length = low;
    const lastSpace = chars.slice(0, length + 1).lastIndexOf(' ');
    if (lastSpace > 0) length = lastSpace;
    lines.push(chars.slice(0, length).join('').trimEnd());
    remaining = chars.slice(length).join('').trimStart();
  }
  if (remaining && lines.length) {
    let last = Array.from(lines.at(-1)!);
    while (last.length && ctx.measureText(last.join('') + '…').width > width) last.pop();
    lines[lines.length - 1] = last.join('').trimEnd() + '…';
  }
  return lines;
}

function blocksForImage(p: Project): ImageBlock[] {
  const groups = getGroups(p), lookup = new Map(groups.map(g => [g.id, g]));
  const share = (value: number) => p.salesMetric === 'catalog' ? 'Ventes non renseignées' : `${percent(value)} des ventes`;
  if (p.viewMode === 'mass') {
    let column = 0;
    return groups.flatMap(g => {
      const width = p.massUnits[g.id] || 0, start = column; column += width;
      return width > 0 ? [{ column: start, shelf: 0, width, height: p.shelves, label: g.label, color: g.color, details: [`${percent(linearShare(p, g.id))} du linéaire`, share(g.share)] }] : [];
    });
  }
  if (p.viewMode === 'blocks') return p.blockPlacements.map(b => {
    const g = lookup.get(b.groupId || '');
    return { column: b.column, shelf: b.shelf, width: b.width, height: b.height, label: g?.label || b.label, color: g?.color || b.color, details: [`${percent(b.groupId ? linearShare(p, b.groupId) : b.width * b.height / (capacity(p) * p.shelves))} du linéaire`, share(g?.share || 0)] };
  });
  const products = new Map(p.products.map(product => [product.id, product]));
  const productGroups = new Map(groups.flatMap(g => g.products.map(product => [product.id, g] as const)));
  return p.articlePlacements.flatMap(a => {
    const product = products.get(a.productId);
    return product ? [{ column: a.column, shelf: a.shelf, width: 1, height: 1, label: product.name, color: productGroups.get(product.id)?.color || '#2764cf', details: [product.sku] }] : [];
  });
}

/** Render the full project layout at twice the drawing resolution, independent of UI zoom or scroll. */
export async function planogramPNG(p: Project): Promise<Blob> {
  const blocks = blocksForImage(p), cap = capacity(p);
  const width = Math.max(1440, Math.min(6400, p.viewMode === 'articles' ? cap * 56 : p.elements * 280));
  const canvas = document.createElement('canvas');
  canvas.width = width * 2; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Le moteur de dessin n’est pas disponible.');
  ctx.font = `600 26px ${fontFamily}`;
  const title = textLines(ctx, p.name, width - 290, 2);
  ctx.font = `12px ${fontFamily}`;
  const subtitle = textLines(ctx, `${p.targetSegment || 'Tous les segments'} · ${modeLabels[p.viewMode]} · Par ${groupingLabels[p.groupBy].toLowerCase()}`, width - 84, 2);
  const top = 42 + title.length * 34 + 12 + subtitle.length * 18 + 26 + 40;
  const left = 74, boardWidth = width - left - 42, shelfHeight = 76, boardHeight = p.shelves * shelfHeight;
  const height = top + boardHeight + 80;
  canvas.height = Math.ceil(height * 2);
  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top'; ctx.fillStyle = '#233b5a'; ctx.font = `600 26px ${fontFamily}`;
  title.forEach((line, i) => ctx.fillText(line, 42, 36 + i * 34));
  ctx.textAlign = 'right'; ctx.fillStyle = '#2764cf'; ctx.font = `700 17px ${fontFamily}`; ctx.fillText('PlanoPilot', width - 42, 40);
  ctx.textAlign = 'left'; ctx.fillStyle = '#6c7d94'; ctx.font = `12px ${fontFamily}`;
  let y = 42 + title.length * 34 + 8;
  subtitle.forEach((line, i) => ctx.fillText(line, 42, y + i * 18));
  y += subtitle.length * 18 + 12;
  ctx.fillText(`${number(p.elements, p.elements % 1 ? 1 : 0)} éléments · ${number(p.elements * 1.33, 2)} m · ${p.shelves} tablettes · ${cap} unités en largeur`, 42, y);

  const x = (column: number) => left + columnFraction(p, column) * boardWidth;
  const elements = Array.from({ length: Math.ceil(p.elements) }, (_, i) => ({ column: i * p.unitsPerElement, width: i === Math.floor(p.elements) ? p.halfUnits : p.unitsPerElement, label: i === Math.floor(p.elements) ? '½ élément · 0,665 m' : `Élément ${i + 1} · 1,33 m` }));
  ctx.font = `11px ${fontFamily}`; ctx.fillStyle = '#7186a5'; ctx.textAlign = 'center';
  elements.forEach(el => ctx.fillText(el.label, (x(el.column) + x(el.column + el.width)) / 2, top - 26));
  ctx.fillStyle = '#f2f5fa'; ctx.fillRect(left, top, boardWidth, boardHeight);
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, boardWidth, boardHeight); ctx.clip();
  for (const b of blocks) {
    ctx.fillStyle = color(b.color); ctx.fillRect(x(b.column), top + b.shelf * shelfHeight, x(b.column + b.width) - x(b.column), b.height * shelfHeight);
    ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1; ctx.strokeRect(x(b.column), top + b.shelf * shelfHeight, x(b.column + b.width) - x(b.column), b.height * shelfHeight);
  }
  ctx.lineWidth = 1; ctx.strokeStyle = '#ffffff55';
  for (let shelf = 1; shelf < p.shelves; shelf++) { ctx.beginPath(); ctx.moveTo(left, top + shelf * shelfHeight); ctx.lineTo(left + boardWidth, top + shelf * shelfHeight); ctx.stroke(); }
  ctx.strokeStyle = '#ffffff70'; ctx.setLineDash([3, 3]);
  elements.slice(1).forEach(el => { ctx.beginPath(); ctx.moveTo(x(el.column), top); ctx.lineTo(x(el.column), top + boardHeight); ctx.stroke(); });
  ctx.setLineDash([]);
  for (const b of blocks) {
    const bx = x(b.column), bw = x(b.column + b.width) - bx, by = top + b.shelf * shelfHeight, bh = b.height * shelfHeight;
    const padding = Math.min(10, bw / 8), available = bw - padding * 2;
    ctx.save(); ctx.beginPath(); ctx.rect(bx + padding, by + 5, available, bh - 10); ctx.clip();
    ctx.fillStyle = textColor(color(b.color)); ctx.textAlign = 'center';
    const fontSize = p.viewMode === 'articles' ? 10 : bw < 65 ? 9 : bw < 140 ? 13 : 16;
    const lineHeight = fontSize * 1.3;
    const detailSize = p.viewMode === 'articles' ? 9 : bw < 65 ? 8 : 11;
    ctx.font = `${detailSize}px ${fontFamily}`;
    const details = b.details.flatMap(detail => textLines(ctx, detail, available, p.viewMode === 'articles' ? 2 : 1));
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    const labelBudget = bh - 14 - (details.length ? 10 + details.length * (detailSize + 4) : 0);
    const label = textLines(ctx, b.label, available, Math.max(0, Math.min(p.viewMode === 'articles' ? 3 : 8, Math.floor(labelBudget / lineHeight))));
    const textHeight = label.length * lineHeight + (details.length ? 10 + details.length * (detailSize + 4) : 0);
    let ty = by + Math.max(7, (bh - textHeight) / 2);
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    label.forEach(line => { ctx.fillText(line, bx + bw / 2, ty); ty += lineHeight; });
    ty += 10; ctx.font = `${detailSize}px ${fontFamily}`;
    details.forEach(line => { ctx.fillText(line, bx + bw / 2, ty); ty += detailSize + 4; });
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = '#8195b0'; ctx.lineWidth = 1.5; ctx.strokeRect(left, top, boardWidth, boardHeight);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7c8fa9'; ctx.font = `11px ${fontFamily}`;
  for (let shelf = 0; shelf < p.shelves; shelf++) ctx.fillText(String(shelf + 1), left - 18, top + (shelf + .5) * shelfHeight);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#f5f8fc'; ctx.fillRect(left, top + boardHeight + 9, boardWidth, 30);
  ctx.fillStyle = '#7c8fa9'; ctx.font = `10px ${fontFamily}`;
  ctx.fillText('Lecture de haut en bas · Les pointillés marquent les jonctions des éléments.', left + 12, top + boardHeight + 19);
  try {
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('L’image n’a pas pu être générée.')), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; }
}
