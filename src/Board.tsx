import { useRef, useState, type PointerEvent } from 'react';
import { Columns3, Grip, Plus, ZoomIn, ZoomOut, Maximize, Move, ImageDown, LoaderCircle } from 'lucide-react';
import { capacity, getGroups, linearShare, resizeMass, validBlock, uid, textColor, columnFraction, fractionColumn } from './domain';
import { number, percent } from './format';
import type { Block, Project } from './types';
export type Selection = { kind: 'group' | 'block' | 'article'; id: string } | null;
export function Board({ project, commit, selection, select, notify, fileName, hasDocument, onNewPlan, onImport, onDemo, onNewBlock, onExportImage, exportingImage, onEdit, assortmentVisible, zoom, onZoom, grid, onGrid }: { fileName?: string; hasDocument: boolean; onNewPlan: () => void; zoom: number; onZoom: (zoom: number) => void; grid: boolean; onGrid: (visible: boolean) => void; assortmentVisible: boolean; onEdit: (selection: NonNullable<Selection>) => void; onExportImage: () => void; exportingImage: boolean; project: Project; commit: (p: Project) => void; selection: Selection; select: (s: Selection) => void; notify: (text: string) => void; onImport: () => void; onDemo: () => void; onNewBlock: (column: number, shelf: number) => void }) {
  const ref = useRef<HTMLDivElement>(null), [preview, setPreview] = useState<Project | null>(null), [invalid, setInvalid] = useState(false), [dragging, setDragging] = useState(false);
  const p = preview || project, groups = getGroups(p), cap = capacity(p), lookup = new Map(groups.map(g => [g.id, g]));
  const used = p.viewMode === 'mass' ? groups.reduce((n, g) => n + (p.massUnits[g.id] || 0), 0) : p.viewMode === 'blocks' ? p.blockPlacements.reduce((n, b) => n + b.width * b.height, 0) : p.articlePlacements.length;
  const total = p.viewMode === 'mass' ? cap : cap * p.shelves;
  function gesture(event: PointerEvent, kind: 'group' | 'block' | 'article', id: string, operation = 'move') {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); select({ kind, id });
    const rect = ref.current!.getBoundingClientRect(), initial = project;
    const startX = event.clientX, startY = event.clientY;
    let final = initial, allowed = true, moved = false;
    const block = initial.blockPlacements.find(b => b.id === id), article = initial.articlePlacements.find(a => a.id === id);
    const initialGroups = getGroups(initial), groupIndex = initialGroups.findIndex(g => g.id === id);
    const onMove = (e: globalThis.PointerEvent) => {
      const rawX = fractionColumn(initial, (e.clientX - rect.left) / rect.width) - fractionColumn(initial, (startX - rect.left) / rect.width), dx = Math.round(rawX), dy = Math.round((e.clientY - startY) / rect.height * p.shelves);
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 4) return;
      moved = true; setDragging(true);
      if (kind === 'group') {
        if (operation === 'left' || operation === 'right') final = resizeMass(initial, id, (initial.massUnits[id] || 0) + (operation === 'left' ? -dx : dx), operation);
        else {
          const originalStart = initialGroups.slice(0, groupIndex).reduce((n, g) => n + (initial.massUnits[g.id] || 0), 0);
          const target = originalStart + (initial.massUnits[id] || 0) / 2 + rawX;
          let sum = 0, targetIndex = initialGroups.length - 1;
          for (let i = 0; i < initialGroups.length; i++) { const width = initial.massUnits[initialGroups[i].id] || 0; if (target < sum + width / 2) { targetIndex = i; break; } sum += width; }
          const order = initialGroups.map(g => g.id); order.splice(groupIndex, 1); order.splice(targetIndex, 0, id); final = { ...initial, massOrder: order };
        }
        allowed = true;
      } else if (kind === 'block' && block) {
        const candidate = { ...block };
        if (operation === 'move') { candidate.column += dx; candidate.shelf += dy; }
        if (operation === 'left') { candidate.column += dx; candidate.width -= dx; }
        if (operation === 'right') candidate.width += dx;
        if (operation === 'top') { candidate.shelf += dy; candidate.height -= dy; }
        if (operation === 'bottom') candidate.height += dy;
        allowed = validBlock(initial, candidate, id);
        final = { ...initial, blockPlacements: initial.blockPlacements.map(b => b.id === id ? candidate : b) };
      } else if (kind === 'article' && article) {
        const candidate = { ...article, column: article.column + dx, shelf: article.shelf + dy };
        allowed = candidate.column >= 0 && candidate.column < cap && candidate.shelf >= 0 && candidate.shelf < p.shelves && !initial.articlePlacements.some(a => a.id !== id && a.column === candidate.column && a.shelf === candidate.shelf);
        final = { ...initial, articlePlacements: initial.articlePlacements.map(a => a.id === id ? candidate : a) };
      }
      setInvalid(!allowed); setPreview(final);
    };
    const finish = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); setPreview(null); setInvalid(false); setDragging(false); if (moved && allowed) commit(final); else if (moved) notify('Emplacement indisponible : le bloc doit rester dans le meuble, sans chevauchement.'); };
    const cancel = () => { moved = false; finish(); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel);
  }
  function drop(event: React.DragEvent) {
    event.preventDefault(); const rect = ref.current!.getBoundingClientRect();
    const column = Math.min(cap - 1, Math.max(0, Math.floor(fractionColumn(p, (event.clientX - rect.left) / rect.width)))), shelf = Math.min(p.shelves - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * p.shelves)));
    const type = event.dataTransfer.getData('application/planopilot');
    if (type === 'new-block' && p.viewMode === 'blocks') onNewBlock(column, shelf);
    if (type.startsWith('product:') && p.viewMode === 'articles') {
      const productId = type.slice(8);
      if (!p.products.some(x => x.id === productId)) return;
      if (p.articlePlacements.some(a => a.column === column && a.shelf === shelf)) { notify('Cette case est déjà occupée. Déplacez ou supprimez sa référence avant de la remplacer.'); return; }
      const article = { id: uid(), productId, column, shelf }; commit({ ...p, articlePlacements: [...p.articlePlacements, article] }); select({ kind: 'article', id: article.id });
    }
  }
  const handles = (kind: 'group' | 'block', id: string) => <>{['left', 'right', ...(kind === 'block' ? ['top', 'bottom'] : [])].map(side => <span key={side} className={`resize-handle ${side}`} onPointerDown={e => gesture(e, kind, id, side)} role="presentation"/>)}</>;
  let cursor = 0;
  const massBlocks = groups.map(g => { const width = p.massUnits[g.id] || 0, start = cursor; cursor += width; return { group: g, width, start }; }).filter(b => b.width > 0);
  const elementLabels = Array.from({ length: Math.ceil(p.elements) }, (_, i) => ({ label: i === Math.floor(p.elements) ? `½ élément` : `Élément ${i + 1}`, start: i * p.unitsPerElement, width: i === Math.floor(p.elements) ? p.halfUnits : p.unitsPerElement }));
  return <section className="board-card">{hasDocument && <div className="board-toolbar"><div><span className="eyebrow">IMPLANTATION</span><h2 title={fileName}>{fileName && <>{fileName} </>}<span className="tag" style={{ marginLeft: fileName ? undefined : 0 }}>{number(p.elements * 1.33, 2)} m</span></h2></div>{!window.plano ? <div className="board-tools">{p.products.length > 0 && <button className="button board-image-button" title="Enregistrer le planogramme complet en PNG" disabled={exportingImage} onClick={onExportImage}>{exportingImage ? <LoaderCircle size={15} className="spin"/> : <ImageDown size={15}/>}<span>{exportingImage ? "Export de l’image…" : "Télécharger l’image"}</span></button>}<button className={`icon-button ${grid ? 'active' : ''}`} title="Afficher la grille des unités" onClick={() => onGrid(!grid)}><Columns3 size={17}/></button><div className="zoom-tools"><button className="icon-button" title="Réduire" disabled={zoom <= 1} onClick={() => onZoom(Math.max(1, zoom - .25))}><ZoomOut size={16}/></button><span>{Math.round(zoom * 100)} %</span><button className="icon-button" title="Agrandir" disabled={zoom >= 3} onClick={() => onZoom(Math.min(3, zoom + .25))}><ZoomIn size={16}/></button><button className="icon-button" title="Ajuster à l’écran" onClick={() => onZoom(1)}><Maximize size={15}/></button></div></div> : p.products.length > 0 && <span className="board-view-status">{Math.round(zoom * 100)} %{grid ? " · Grille affichée" : ""}</span>}</div>}
    {!p.products.length ? <div className="welcome-board"><div className="welcome-illustration"><div className="mock-rack"><i/><i/><i/><i/></div><div className="float-badge"><Columns3 size={23}/></div></div><span className="eyebrow">DES VENTES À L’IMPLANTATION</span><h2>Composez un rayon qui a du sens.</h2><p>Importez vos données commerciales et transformez-les<br/>en un plan clair, ajustable et prêt à présenter.</p><button className="button primary large" onClick={hasDocument ? onImport : onNewPlan}><Plus size={18}/>{hasDocument ? "Importer mes données" : "Nouveau plan"}</button>{!hasDocument && <button className="text-button" onClick={onImport}>Importer mes données</button>}<button className="text-button" onClick={onDemo}>Explorer un exemple</button></div> : <><div className="board-scroll"><div className="board-canvas" style={{ width: `${zoom * 100}%` }}><div className="element-labels">{elementLabels.map((el, i) => <span key={i} style={{ left: `${columnFraction(p, el.start) * 100}%`, width: `${(columnFraction(p, el.start + el.width) - columnFraction(p, el.start)) * 100}%` }}>{el.label}<small>{i === Math.floor(p.elements) ? '0,665 m' : '1,33 m'}</small></span>)}</div><div className={`shelf-board ${grid ? 'show-grid' : ''} ${dragging ? 'dragging' : ''}`} ref={ref} style={{ height: p.shelves * 65 }} onPointerDown={e => { if (e.target === e.currentTarget) select(null); }} onDragOver={e => { if (p.viewMode !== 'mass') e.preventDefault(); }} onDrop={drop}>
      {p.viewMode === 'mass' && massBlocks.map(({ group: g, width, start }) => <div key={g.id} className={`plan-block mass-block ${selection?.id === g.id ? 'selected' : ''}`} style={{ left: `${columnFraction(p, start) * 100}%`, width: `${(columnFraction(p, start + width) - columnFraction(p, start)) * 100}%`, top: 0, height: '100%', background: g.color, color: textColor(g.color) }} onPointerDown={e => gesture(e, 'group', g.id)} onDoubleClick={e => { e.stopPropagation(); onEdit({ kind: 'group', id: g.id }); }} title={`${g.label} — ${width} unités · ${percent(linearShare(p, g.id))} du linéaire · ${(p.salesMetric === 'catalog' ? '—' : percent(g.share))} des ventes · Double-cliquez pour modifier`}><div className="block-label"><strong>{g.label}</strong>{width / cap > .08 && <><span>{percent(linearShare(p, g.id))} du linéaire</span><small>{(p.salesMetric === 'catalog' ? '—' : percent(g.share))} des ventes</small></>}</div><Grip className="block-grip" size={17}/>{handles('group', g.id)}</div>)}
      {p.viewMode === 'blocks' && p.blockPlacements.map(b => { const g = lookup.get(b.groupId || ''), chosen = selection?.id === b.id; return <div key={b.id} className={`plan-block ${chosen ? 'selected' : ''} ${chosen && invalid ? 'invalid' : ''}`} style={{ left: `${columnFraction(p, b.column) * 100}%`, top: `${b.shelf / p.shelves * 100}%`, width: `${(columnFraction(p, b.column + b.width) - columnFraction(p, b.column)) * 100}%`, height: `${b.height / p.shelves * 100}%`, background: g?.color || b.color, color: textColor(g?.color || b.color) }} onPointerDown={e => gesture(e, 'block', b.id)} onDoubleClick={e => { e.stopPropagation(); onEdit({ kind: 'block', id: b.id }); }} title={`${g?.label || b.label} · ${b.width} unités × ${b.height} tablettes · Double-cliquez pour modifier`}><div className="block-label"><strong>{g?.label || b.label}</strong>{b.width / cap > .10 && <span>{percent(b.groupId ? linearShare(p, b.groupId) : b.width * b.height / total)} du linéaire · {(p.salesMetric === 'catalog' ? '—' : percent(g?.share || 0))} des ventes</span>}</div>{handles('block', b.id)}</div>; })}
      {p.viewMode === 'articles' && p.articlePlacements.map(a => { const product = p.products.find(x => x.id === a.productId); if (!product) return null; const g = groups.find(g => g.products.some(x => x.id === product.id)); return <div key={a.id} className={`plan-block article-block ${selection?.id === a.id ? 'selected' : ''} ${selection?.id === a.id && invalid ? 'invalid' : ''}`} style={{ left: `${columnFraction(p, a.column) * 100}%`, top: `${a.shelf / p.shelves * 100}%`, width: `${(columnFraction(p, a.column + 1) - columnFraction(p, a.column)) * 100}%`, height: `${100 / p.shelves}%`, background: g?.color || '#2764cf', color: textColor(g?.color || '#2764cf') }} onPointerDown={e => gesture(e, 'article', a.id)} onDoubleClick={e => { e.stopPropagation(); onEdit({ kind: 'article', id: a.id }); }} title={`${product.name} · ${product.sku} · Double-cliquez pour modifier`}><strong>{product.name}</strong><small>{product.sku}</small></div>; })}
      {grid && Array.from({ length: cap - 1 }, (_, i) => <div className="unit-line" key={`unit-${i}`} style={{ left: `${columnFraction(p, i + 1) * 100}%` }}/>) }
      {Array.from({ length: p.shelves - 1 }, (_, i) => <div className="shelf-line" key={i} style={{ top: `${(i + 1) / p.shelves * 100}%` }}/>) }
      {elementLabels.slice(1).map((el, i) => <div className="element-line" key={i} style={{ left: `${columnFraction(p, el.start) * 100}%` }}/>) }
      <div className="shelf-numbers">{Array.from({ length: p.shelves }, (_, i) => <span key={i} style={{ top: `${i / p.shelves * 100}%`, height: `${100 / p.shelves}%` }}>{i + 1}</span>)}</div>
    </div><div className="description-band">{p.viewMode === 'mass' ? massBlocks.map(({ group, width, start }) => <span style={{ left: `${columnFraction(p, start) * 100}%`, width: `${(columnFraction(p, start + width) - columnFraction(p, start)) * 100}%` }} key={group.id}><i style={{ background: group.color }}/>{group.label}</span>) : <span className="band-note">{p.shelves} tablettes · Bande descriptive hors capacité</span>}</div></div></div><div className="board-bottom"><div className="quota"><div className="quota-bar"><span style={{ width: `${used / total * 100}%` }}/></div><strong>{used} <span>/ {total} {p.viewMode === 'mass' ? 'unités' : 'cases'}</span></strong><span className="remaining">{total - used} disponibles</span></div>{p.viewMode === 'blocks' ? <button className="new-block-card" draggable onDragStart={e => e.dataTransfer.setData('application/planopilot', 'new-block')} onClick={() => onNewBlock(0, 0)}><Plus size={17}/>Nouveau bloc<Grip size={15}/></button> : <span className="interaction-hint"><Move size={14}/>{p.viewMode === 'mass' ? 'Glissez pour réordonner · Étirez les bords · Double-cliquez pour modifier' : assortmentVisible ? 'Glissez une référence de l’assortiment · Double-cliquez pour modifier' : 'Double-cliquez pour modifier · Assortiment disponible dans le menu Affichage'}</span>}</div></>}
  </section>;
}
