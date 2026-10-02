import { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { GroupContents } from './GroupContents';
import { capacity, findSpace, getGroups, linearShare, scopeProducts, setMassUnits, uid, validBlock } from './domain';
import { percent, salesText } from './format';
import type { Selection } from './Board';
import type { Project } from './types';

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
  return <Modal title={title} subtitle={associated?.label || block?.label || product?.name} onClose={onClose} className="edit-selection-dialog">
    <form onSubmit={event => { event.preventDefault(); if (valid) { commit(next); onClose(); } }}>
      <div className="dialog-body">
        {(group || block) && <label className="color-field"><input type="color" aria-label="Couleur de l’élément sélectionné" value={color} onChange={event => setColor(event.target.value)}/><span>Couleur du {associated ? 'groupe' : 'bloc'}</span><code>{color}</code></label>}
        {group && <label className="field">Unités attribuées<input type="number" min={0} max={capacity(p)} value={units} onChange={event => setUnits(Number(event.target.value))}/><small>Si nécessaire, l’espace est récupéré sur les groupes voisins.</small></label>}
        {block && <>
          <div className="form-grid two block-dimensions">
            <label>Largeur (unités)<input aria-label="Largeur du bloc" type="number" min={1} max={capacity(p)} value={block.width} onChange={event => setBlock({ ...block, width: Number(event.target.value) })}/></label>
            <label>Hauteur (tablettes)<input aria-label="Hauteur du bloc" type="number" min={1} max={p.shelves} value={block.height} onChange={event => setBlock({ ...block, height: Number(event.target.value) })}/></label>
            <label>Colonne de départ<input type="number" min={1} max={capacity(p)} value={block.column + 1} onChange={event => setBlock({ ...block, column: Number(event.target.value) - 1 })}/></label>
            <label>Tablette de départ<input type="number" min={1} max={p.shelves} value={block.shelf + 1} onChange={event => setBlock({ ...block, shelf: Number(event.target.value) - 1 })}/></label>
          </div>
          <label className="field">Groupe associé<select value={block.groupId || ''} onChange={event => { const group = groups.find(group => group.id === event.target.value); setBlock({ ...block, groupId: group?.id || null, label: group?.label || block.label }); setColor(group?.color || color); }}><option value="">Bloc indépendant</option>{groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
          {!block.groupId && <label className="field">Nom du bloc<input maxLength={150} value={block.label} onChange={event => setBlock({ ...block, label: event.target.value })}/></label>}
        </>}
        {article && <>
          <label className="field">Référence associée<select value={article.productId} onChange={event => setArticle({ ...article, productId: event.target.value })}>{scopeProducts(p).map(product => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
          <div className="form-grid two block-dimensions"><label>Colonne de départ<input type="number" min={1} max={capacity(p)} value={article.column + 1} onChange={event => setArticle({ ...article, column: Number(event.target.value) - 1 })}/></label><label>Tablette de départ<input type="number" min={1} max={p.shelves} value={article.shelf + 1} onChange={event => setArticle({ ...article, shelf: Number(event.target.value) - 1 })}/></label></div>
        </>}
        {!valid && <p className="error-banner" role="alert">{group ? 'Choisissez un nombre entier d’unités dans la capacité du meuble.' : block && !block.label.trim() ? 'Saisissez un nom pour le bloc.' : 'Cet emplacement est occupé ou sort du meuble. Vérifiez les dimensions et la position.'}</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}
        {associated && <><div className="inspector-metrics"><div><span>Linéaire occupé</span><strong>{percent(linearShare(valid ? next : p, associated.id))}</strong></div><div><span>Part des ventes</span><strong>{p.salesMetric === 'catalog' ? '—' : percent(associated.share)}</strong></div><div><span>{p.salesMetric === 'revenue' ? 'Chiffre d’affaires' : 'Ventes'}</span><strong>{salesText(associated.sales, p.salesMetric)}</strong></div></div>{!article && <GroupContents group={associated} custom={p.customGroups.find(custom => custom.id === associated.id)} metric={p.salesMetric}/>}</>}
      </div>
      <div className="modal-footer">{!group && <div className="edit-selection-actions"><button type="button" className="button danger" onClick={() => { onDelete(); onClose(); }}><Trash2 size={15}/>Supprimer</button><button type="button" className="button" disabled={!valid} onClick={duplicate}><Copy size={15}/>Dupliquer</button></div>}<button type="button" className="button" onClick={onClose}>Annuler</button><button type="submit" className="button primary" disabled={!valid}><Check size={16}/>Appliquer</button></div>
    </form>
  </Modal>;
}
