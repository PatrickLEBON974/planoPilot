import { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Columns3, Copy, Layers, LayoutGrid, MapPin, Minus, Package, Plus, Ruler, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { GroupContents } from './GroupContents';
import { capacity, columnFraction, findSpace, getGroups, linearShare, palette, scopeProducts, setMassUnits, textColor, uid, validBlock } from './domain';
import { number, percent, salesText } from './format';
import type { Selection } from './Board';
import type { ArticlePlacement, Block, Project } from './types';

export function EditSelectionDialog({ p, selection, commit, select, onClose, onDelete }: { p: Project; selection: NonNullable<Selection>; commit: (p: Project) => void; select: (selection: Selection) => void; onClose: () => void; onDelete: () => void }) {
  const groups = getGroups(p), group = selection.kind === 'group' ? groups.find(group => group.id === selection.id) : undefined;
  const originalBlock = p.blockPlacements.find(block => selection.kind === 'block' && block.id === selection.id);
  const originalArticle = p.articlePlacements.find(article => selection.kind === 'article' && article.id === selection.id);
  const [block, setBlock] = useState(originalBlock), [article, setArticle] = useState(originalArticle);
  const initialGroup = group || groups.find(group => group.id === originalBlock?.groupId);
  const [color, setColor] = useState(initialGroup?.color || originalBlock?.color || '#2764cf');
  const [units, setUnits] = useState(p.massUnits[selection.id] || 0), [error, setError] = useState('');
  const product = p.products.find(product => product.id === article?.productId);
  const associated = group || groups.find(group => group.id === block?.groupId || group.products.some(item => item.id === article?.productId));
  if (!group && !block && !article) return null;

  let next = p, valid = true;
  if (group) {
    valid = Number.isInteger(units) && units >= 0 && units <= capacity(p);
    if (valid) next = { ...setMassUnits(p, group.id, units), groupColors: { ...p.groupColors, [group.id]: color } };
  } else if (block) {
    valid = Boolean(block.label.trim()) && validBlock(p, block, block.id);
    next = { ...p, blockPlacements: p.blockPlacements.map(item => item.id === block.id ? { ...block, label: block.label.trim(), color } : item), ...(block.groupId ? { groupColors: { ...p.groupColors, [block.groupId]: color } } : {}) };
  } else if (article) {
    valid = Boolean(product) && Number.isInteger(article.column) && Number.isInteger(article.shelf) && article.column >= 0 && article.column < capacity(p) && article.shelf >= 0 && article.shelf < p.shelves && !p.articlePlacements.some(item => item.id !== article.id && item.column === article.column && item.shelf === article.shelf);
    next = { ...p, articlePlacements: p.articlePlacements.map(item => item.id === article.id ? article : item) };
  }
  function duplicate() {
    if (!valid) return;
    if (block) {
      const space = findSpace(next, block.width, block.height);
      if (!space) { setError('Il n’y a pas d’emplacement libre pour un bloc de ces dimensions.'); return; }
      const copy = { ...block, ...space, label: block.label.trim(), color, id: uid() };
      commit({ ...next, blockPlacements: [...next.blockPlacements, copy] }); select({ kind: 'block', id: copy.id }); onClose();
    } else if (article) {
      for (let shelf = 0; shelf < next.shelves; shelf++) for (let column = 0; column < capacity(next); column++) {
        if (next.articlePlacements.some(item => item.column === column && item.shelf === shelf)) continue;
        const copy = { ...article, column, shelf, id: uid() };
        commit({ ...next, articlePlacements: [...next.articlePlacements, copy] }); select({ kind: 'article', id: copy.id }); onClose(); return;
      }
      setError('Toutes les cases du meuble sont occupées.');
    }
  }
  const title = group ? 'Modifier la descente' : block ? 'Modifier le bloc' : 'Modifier l’article';
  const name = product?.name || associated?.label || block?.label || '';
  const selectedColor = article ? associated?.color || '#2764cf' : color;
  const initialColor = initialGroup?.color || originalBlock?.color || '#2764cf';
  const dirty = group ? units !== (p.massUnits[group.id] || 0) || color !== initialColor : block && originalBlock ? color !== initialColor || (['groupId', 'label', 'column', 'shelf', 'width', 'height'] as const).some(key => block[key] !== originalBlock[key]) : Boolean(article && originalArticle && (article.column !== originalArticle.column || article.shelf !== originalArticle.shelf || article.productId !== originalArticle.productId));
  const changeBlock = (value: Block) => { setBlock(value); setError(''); };
  const changeArticle = (value: ArticlePlacement) => { setArticle(value); setError(''); };
  const changeColor = (value: string) => { setColor(value); setError(''); };
  const Icon = group ? Columns3 : block ? LayoutGrid : Package;
  const validation = group ? 'Choisissez un nombre entier d’unités dans la capacité du meuble.' : block && !block.label.trim() ? 'Saisissez un nom pour le bloc.' : 'Cet emplacement est occupé ou sort du meuble. Vérifiez les dimensions et la position.';
  const columns = capacity(p);
  const footprint = group ? `${number(units)} unité${units > 1 ? 's' : ''} sur ${p.shelves} tablettes` : block ? `${number(block.width * block.height)} cases · ${block.width} × ${block.height}` : '1 case · 1 référence';
  return <Modal title={title} subtitle={name} onClose={onClose} className="edit-selection-dialog" initialFocus={group ? '.edit-unit-input' : block ? '[aria-label="Largeur du bloc"]' : '[aria-label="Colonne de départ"]'} headerIcon={<span className="edit-object-icon" style={{ background: selectedColor, color: textColor(selectedColor) }}><Icon size={23}/></span>}>
    <form className="edit-selection-form" onSubmit={event => { event.preventDefault(); if (valid && dirty) { commit(next); onClose(); } }}>
      <div className="edit-layout">
        <div className="edit-settings">
          {group && <section className="edit-section">
            <h3><Ruler size={16}/>Largeur de la descente</h3>
            <label className="edit-number-field edit-unit-field"><span>Unités attribuées</span><div className="edit-unit-control"><button type="button" aria-label="Retirer une unité" disabled={units <= 0} onClick={() => setUnits(Math.max(0, units - 1))}><Minus size={18}/></button><input className="edit-unit-input" aria-label="Unités attribuées" type="number" min={0} max={columns} step={1} value={units} onFocus={event => event.currentTarget.select()} onChange={event => setUnits(Number(event.target.value))}/><button type="button" aria-label="Ajouter une unité" disabled={units >= columns} onClick={() => setUnits(Math.min(columns, units + 1))}><Plus size={18}/></button></div></label>
            <div className="edit-unit-scale"><span>0 unité</span><strong>Capacité : {columns} unités</strong></div>
            <p className="edit-field-help">La descente occupe toute la hauteur. Si nécessaire, l’espace est récupéré sur les groupes voisins.</p>
          </section>}
          {block && <>
            <section className="edit-section">
              <h3><Ruler size={16}/>Dimensions</h3>
              <div className="edit-field-grid">
                <NumberField label="Largeur" name="Largeur du bloc" unit="unités" min={1} max={columns} value={block.width} onChange={width => changeBlock({ ...block, width })}/>
                <NumberField label="Hauteur" name="Hauteur du bloc" unit="tablettes" min={1} max={p.shelves} value={block.height} onChange={height => changeBlock({ ...block, height })}/>
              </div>
            </section>
            <section className="edit-section">
              <h3><MapPin size={16}/>Position dans le meuble</h3>
              <div className="edit-field-grid">
                <NumberField label="Colonne de départ" min={1} max={columns} value={block.column + 1} onChange={column => changeBlock({ ...block, column: column - 1 })}/>
                <NumberField label="Tablette de départ" min={1} max={p.shelves} value={block.shelf + 1} onChange={shelf => changeBlock({ ...block, shelf: shelf - 1 })}/>
              </div>
              <p className="edit-field-help">{columns} colonnes · {p.shelves} tablettes, numérotées de haut en bas.</p>
            </section>
            <section className="edit-section">
              <h3><Layers size={16}/>Contenu du bloc</h3>
              <label className="edit-select-field">Groupe associé<select value={block.groupId || ''} onChange={event => { const group = groups.find(group => group.id === event.target.value); changeBlock({ ...block, groupId: group?.id || null, label: group?.label || block.label }); changeColor(group?.color || color); }}><option value="">Bloc indépendant</option>{groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
              {!block.groupId && <label className="edit-select-field">Nom du bloc<input maxLength={150} placeholder="Ex. Nouveautés" value={block.label} onChange={event => changeBlock({ ...block, label: event.target.value })}/></label>}
            </section>
          </>}
          {article && <>
            <section className="edit-section">
              <h3><Package size={16}/>Référence à implanter</h3>
              <label className="edit-select-field">Référence associée<select value={article.productId} onChange={event => changeArticle({ ...article, productId: event.target.value })}>{scopeProducts(p).map(product => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
              {product && <p className="edit-field-help">{product.brand} · {product.sku}{product.packaging ? ` · ${product.packaging}` : ''}</p>}
            </section>
            <section className="edit-section">
              <h3><MapPin size={16}/>Position dans le meuble</h3>
              <div className="edit-field-grid">
                <NumberField label="Colonne de départ" min={1} max={columns} value={article.column + 1} onChange={column => changeArticle({ ...article, column: column - 1 })}/>
                <NumberField label="Tablette de départ" min={1} max={p.shelves} value={article.shelf + 1} onChange={shelf => changeArticle({ ...article, shelf: shelf - 1 })}/>
              </div>
              <p className="edit-field-help">{columns} colonnes · {p.shelves} tablettes. Choisissez une case libre.</p>
            </section>
          </>}
          {(group || block) && <section className="edit-section edit-color-section">
            <h3>Couleur du {associated ? 'groupe' : 'bloc'}</h3>
            <div className="edit-palette">{palette.map(value => <button type="button" key={value} aria-label={`Couleur ${value}`} aria-pressed={color.toLowerCase() === value} className={color.toLowerCase() === value ? 'chosen' : ''} style={{ background: value, color: textColor(value) }} onClick={() => changeColor(value)}>{color.toLowerCase() === value && <Check size={16}/>}</button>)}<label className="edit-custom-color" title="Choisir une couleur personnalisée"><input type="color" aria-label="Couleur de l’élément sélectionné" value={color} onChange={event => changeColor(event.target.value)}/><span>Personnalisée</span></label></div>
            {associated && <p className="edit-field-help">Cette couleur est partagée par les éléments du groupe.</p>}
          </section>}
          {(!valid || error) && <div className="edit-validation" role="alert"><AlertCircle size={17}/><span>{!valid ? validation : error}</span></div>}
        </div>
        <aside className="edit-context" aria-label="Aperçu et informations">
          <section className="edit-preview-card">
            <div className="edit-preview-heading"><span>Aperçu dans le meuble</span><span className={`edit-validity ${valid ? '' : 'invalid'}`}>{valid ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>}<span>{valid ? 'Valide' : 'À corriger'}</span></span></div>
            <SelectionPreview p={valid ? next : p} selection={selection} block={block} article={article} units={units} color={selectedColor}/>
            <div className="edit-preview-caption"><span className="edit-color-dot" style={{ background: selectedColor }}/><strong>{footprint}</strong></div>
            <p className="edit-preview-note">{group && units === 0 ? 'Cette descente ne sera plus représentée sur le plan.' : 'La zone colorée représente l’élément que vous modifiez.'}</p>
          </section>
          {associated && <section className="edit-commercial-section">
            <h3>Repères commerciaux</h3>
            <div className="edit-metrics"><div><span>Linéaire du groupe</span><strong>{percent(linearShare(valid ? next : p, associated.id))}</strong></div><div><span>Part des ventes</span><strong>{p.salesMetric === 'catalog' ? '—' : percent(associated.share)}</strong></div></div>
            <div className="edit-sales-total"><span>{p.salesMetric === 'revenue' ? 'Chiffre d’affaires du groupe' : 'Ventes du groupe'}</span><strong>{salesText(associated.sales, p.salesMetric)}</strong></div>
            {p.salesMetric === 'catalog' && <p className="edit-field-help">Les ventes ne sont pas renseignées dans ce catalogue.</p>}
          </section>}
          {associated && !article && <details className="edit-reference-details"><summary><span><Layers size={15}/>Contenu du groupe <b>{associated.references}</b></span><ChevronDown size={16}/></summary><GroupContents key={associated.id} group={associated} custom={p.customGroups.find(custom => custom.id === associated.id)} metric={p.salesMetric}/></details>}
        </aside>
      </div>
      <div className="modal-footer edit-footer">
        <div className="edit-secondary-actions">{!group && <><button type="button" className="edit-delete" onClick={() => { onDelete(); onClose(); }}><Trash2 size={15}/>Supprimer</button><button type="button" className="button edit-duplicate" disabled={!valid} onClick={duplicate}><Copy size={15}/>Dupliquer</button></>}{group && <span className={`edit-draft-state ${dirty ? 'changed' : ''}`}><i/>{dirty ? 'Modifications à appliquer' : 'Aucune modification'}</span>}</div>
        <button type="button" className="button" onClick={onClose}>Annuler</button><button type="submit" className="button primary" disabled={!valid || !dirty}><Check size={16}/>Appliquer</button>
      </div>
    </form>
  </Modal>;
}

function NumberField({ label, name = label, unit, min, max, value, onChange }: { label: string; name?: string; unit?: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  return <label className="edit-number-field"><span>{label}</span><div className="edit-input-shell"><input type="number" aria-label={name} aria-invalid={!Number.isInteger(value) || value < min || value > max} min={min} max={max} step={1} value={value} onFocus={event => event.currentTarget.select()} onChange={event => onChange(Number(event.target.value))}/>{unit && <span>{unit}</span>}</div></label>;
}

function SelectionPreview({ p, selection, block, article, units, color }: { p: Project; selection: NonNullable<Selection>; block?: Block; article?: ArticlePlacement; units: number; color: string }) {
  const columns = capacity(p), groups = getGroups(p), width = 400, height = p.shelves * 32;
  let cursor = 0;
  const descents = groups.map(group => { const start = cursor, size = p.massUnits[group.id] || 0; cursor += size; return { id: group.id, column: start, shelf: 0, width: size, height: p.shelves }; });
  const selected = block || (article ? { ...article, width: 1, height: 1 } : { ...descents.find(group => group.id === selection.id)!, width: units });
  const otherBlocks = selection.kind === 'group' ? descents : selection.kind === 'block' ? p.blockPlacements : [];
  const geometry = (item: { column: number; shelf: number; width: number; height: number }) => {
    const column = Math.max(0, Math.min(columns, item.column)), end = Math.max(column, Math.min(columns, item.column + Math.max(0, item.width)));
    const top = Math.max(0, Math.min(p.shelves, item.shelf));
    return { x: columnFraction(p, column) * width, y: top * 32, width: (columnFraction(p, end) - columnFraction(p, column)) * width, height: Math.max(0, Math.min(item.height, p.shelves - top)) * 32 };
  };
  // Adjacent occupied article cells share a single rectangle in this small preview.
  const occupied = selection.kind === 'article' ? p.articlePlacements.filter(item => item.id !== selection.id).sort((a, b) => a.shelf - b.shelf || a.column - b.column) : [];
  const articleRows: { column: number; shelf: number; width: number; height: number }[] = [];
  if (selection.kind === 'article') for (const item of occupied) { const last = articleRows.at(-1); if (last && last.shelf === item.shelf && last.column + last.width === item.column) last.width++; else articleRows.push({ column: item.column, shelf: item.shelf, width: 1, height: 1 }); }
  const columnStep = Math.max(1, Math.ceil(columns / 24));
  return <div className="edit-preview-stage"><svg viewBox={`-8 -8 ${width + 16} ${height + 16}`} role="img" aria-label="Aperçu de l’élément sélectionné dans le meuble">
    <rect width={width} height={height} rx={4} fill="white"/>
    {[...otherBlocks.filter(item => item.id !== selection.id), ...articleRows].map((item, index) => <rect key={index} {...geometry(item)} className="edit-preview-neighbor"/>)}
    {selected && <rect {...geometry(selected)} fill={color} className="edit-preview-selection"/>}
    {Array.from({ length: p.shelves - 1 }, (_, index) => <line key={`shelf-${index}`} x1={0} x2={width} y1={(index + 1) * 32} y2={(index + 1) * 32} className="edit-preview-shelf"/>)}
    {Array.from({ length: Math.ceil(columns / columnStep) - 1 }, (_, index) => <line key={`unit-${index}`} x1={columnFraction(p, (index + 1) * columnStep) * width} x2={columnFraction(p, (index + 1) * columnStep) * width} y1={0} y2={height} className="edit-preview-unit"/>)}
    <rect width={width} height={height} rx={4} className="edit-preview-frame"/>
  </svg><div className="edit-preview-axis"><span>Colonne 1</span><span>Colonne {columns}</span></div></div>;
}
