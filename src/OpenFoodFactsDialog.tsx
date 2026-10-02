import { useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, ExternalLink, Globe2, LoaderCircle, Package, Plus, Search } from 'lucide-react';
import { Modal } from './Modal';
import { searchOpenFoodFacts, type OpenFoodFactsProduct, type OpenFoodFactsResult } from './openFoodFacts';
import { parseNumber, uid } from './domain';
import { number } from './format';
import type { Product, Project } from './types';

export function OpenFoodFactsDialog({ p, onClose, onAdd }: { p: Project; onClose: () => void; onAdd: (product: Product) => void }) {
  const [query, setQuery] = useState(''), [searched, setSearched] = useState(''), [result, setResult] = useState<OpenFoodFactsResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [selected, setSelected] = useState<OpenFoodFactsProduct | null>(null);
  const [adding, setAdding] = useState(false), [draft, setDraft] = useState({ name: '', brand: '', segment: '', sales: '' });
  const searchId = useRef(0), catalog = !p.products.length || p.salesMetric === 'catalog';
  const duplicate = Boolean(selected && p.products.some(product => product.sku === selected.code));
  const sales = catalog ? 0 : parseNumber(draft.sales);
  const canAdd = Boolean(selected && !duplicate && draft.name.trim() && draft.brand.trim() && draft.segment.trim() && sales !== null && sales >= 0);

  async function search(term = query.trim(), page = 1) {
    if (term.length < 2 || term.length > 120 || busy) return;
    const id = ++searchId.current;
    setBusy(true); setError(''); setAdding(false); setSelected(null);
    try {
      const next = await searchOpenFoodFacts(term, page);
      if (id === searchId.current) { setResult(next); setSearched(term); }
    } catch (error) { if (id === searchId.current) setError((error as Error).message); }
    finally { if (id === searchId.current) setBusy(false); }
  }
  function choose(product: OpenFoodFactsProduct) {
    setSelected(product); setAdding(false); setError('');
    setDraft({ name: product.name, brand: product.brands, segment: p.targetSegment || product.categories.at(-1) || '', sales: '' });
  }
  async function openProduct() {
    if (!selected) return;
    try {
      if (window.plano) await window.plano.openOpenFoodFactsProduct(selected.code);
      else window.open(selected.sourceUrl, '_blank', 'noopener,noreferrer');
    } catch { setError('La fiche n’a pas pu être ouverte dans votre navigateur.'); }
  }
  function add(event: FormEvent) {
    event.preventDefault();
    if (!canAdd || !selected) return;
    onAdd({ id: uid(), sku: selected.code, name: draft.name.trim(), brand: draft.brand.trim(), segment: draft.segment.trim(), subsegment: 'Non renseigné', sales: sales!, ours: null, ...(selected.quantity ? { packaging: selected.quantity } : {}), sourceUrl: selected.sourceUrl, notes: 'Source : Open Food Facts · Données sous licence ODbL.' });
  }
  const pages = result ? Math.min(100, Math.ceil(result.count / result.pageSize)) : 0;
  return <Modal title="Rechercher sur Open Food Facts" subtitle="Trouvez un produit par son nom, sa marque ou son code-barres." onClose={onClose} wide className="off-dialog" initialFocus=".off-query">
    <div className="off-search-area"><form className="off-search-form" onSubmit={event => { event.preventDefault(); void search(); }}><label className="off-search-input"><Search size={18}/><input className="off-query" aria-label="Nom, marque ou code-barres" placeholder="Ex. tomates, marque ou code-barres…" minLength={2} maxLength={120} value={query} onChange={event => setQuery(event.target.value)}/></label><button className="button primary" disabled={busy || query.trim().length < 2}>{busy ? <LoaderCircle size={16} className="spin"/> : <Search size={16}/>}Rechercher</button></form><p><Globe2 size={13}/>Connexion Internet requise · Vos plans restent sur cet ordinateur.</p></div>
    {error && <div className="off-error" role="alert"><AlertCircle size={16}/>{error}</div>}
    <div className="off-content" aria-busy={busy}>
      <section className="off-results" aria-label="Résultats Open Food Facts">
        {busy ? <div className="off-empty" role="status"><LoaderCircle size={28} className="spin"/><strong>Recherche en cours…</strong></div> : !result ? <div className="off-empty"><Search size={30}/><strong>Explorez la base de produits</strong><p>Saisissez au moins deux caractères, puis lancez la recherche.</p></div> : <>
          <div className="off-result-heading" role="status"><strong>{number(result.count)}{!result.countExact ? '+' : ''} résultat{result.count > 1 ? 's' : ''}</strong><span>pour « {searched} »</span></div>
          {!result.products.length ? <div className="off-empty"><Package size={30}/><strong>Aucun produit trouvé</strong><p>Essayez un autre nom, une marque ou un code-barres.</p></div> : <div className="off-result-list">{result.products.map(product => <button type="button" className={`off-product ${selected?.code === product.code ? 'selected' : ''}`} aria-pressed={selected?.code === product.code} key={product.code} onClick={() => choose(product)}><ProductPhoto product={product}/><span><strong>{product.name || 'Désignation non renseignée'}</strong><small>{product.brands || 'Marque non renseignée'}{product.quantity ? ` · ${product.quantity}` : ''}</small><code>{product.code}</code></span><ArrowRight size={15}/></button>)}</div>}
          {pages > 1 && <div className="off-pagination"><button className="icon-button" title="Page précédente" disabled={result.page <= 1} onClick={() => void search(searched, result.page - 1)}><ArrowLeft size={16}/></button><span>Page {result.page} sur {pages}</span><button className="icon-button" title="Page suivante" disabled={result.page >= pages} onClick={() => void search(searched, result.page + 1)}><ArrowRight size={16}/></button></div>}
        </>}
      </section>
      <aside className="off-detail" aria-label="Fiche du produit">
        {!selected ? <div className="off-empty"><Package size={30}/><strong>Consultez une fiche</strong><p>Sélectionnez un résultat pour voir ses informations et l’ajouter à votre assortiment.</p></div> : <>
          <div className="off-detail-title"><ProductPhoto product={selected}/><div><span className="eyebrow">FICHE PRODUIT</span><h3>{selected.name || 'Désignation non renseignée'}</h3><p>{selected.brands || 'Marque non renseignée'}</p></div></div>

          <button type="button" className="text-button off-source-link" onClick={() => void openProduct()}>Voir la fiche sur Open Food Facts<ExternalLink size={13}/></button>
          {duplicate ? <div className="off-added"><Check size={16}/>Cette référence est déjà dans l’assortiment.</div> : !adding ? <button type="button" className="button primary off-add-button" onClick={() => setAdding(true)}><Plus size={16}/>Ajouter à l’assortiment…</button> : null}
          {!adding && <dl className="off-product-info"><div><dt>Code-barres</dt><dd>{selected.code}</dd></div><div><dt>Conditionnement</dt><dd>{selected.quantity || 'Non renseigné'}</dd></div>{selected.nutriscore && <div><dt>Nutri-Score</dt><dd className={`off-nutriscore grade-${selected.nutriscore}`}>{selected.nutriscore.toUpperCase()}</dd></div>}{selected.categories.length > 0 && <div><dt>Catégories</dt><dd>{selected.categories.join(' · ')}</dd></div>}</dl>}
          {adding && <form className="off-add-form" onSubmit={add}><h4>Préparer l’ajout au plan</h4><label className="field">Désignation<input autoFocus required maxLength={300} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label><div className="form-grid two"><label>Marque<input required maxLength={200} value={draft.brand} onChange={event => setDraft({ ...draft, brand: event.target.value })}/></label><label>Segment<input required maxLength={200} value={draft.segment} onChange={event => setDraft({ ...draft, segment: event.target.value })}/></label></div>{!catalog && <label className="field">{p.salesMetric === 'revenue' ? 'Chiffre d’affaires en euros' : 'Ventes en unités'}<input required inputMode="decimal" placeholder="À renseigner pour ce plan" value={draft.sales} onChange={event => setDraft({ ...draft, sales: event.target.value })}/></label>}<p className="off-add-note">{!p.products.length ? 'Le premier ajout crée un catalogue sans ventes dans ce plan.' : catalog ? 'Les ventes restent non renseignées. Vous pourrez générer le plan après l’ajout.' : 'Open Food Facts ne fournit pas vos ventes. L’implantation actuelle est conservée ; vous pourrez générer le plan après l’ajout.'}</p><div className="off-add-actions"><button type="button" className="text-button" onClick={() => setAdding(false)}>Annuler l’ajout</button><button className="button primary" disabled={!canAdd}><Plus size={15}/>Ajouter la référence</button></div></form>}
        </>}
      </aside>
    </div>
    <div className="modal-footer off-footer"><span>Source : Open Food Facts · Données ODbL · Images CC BY-SA</span><button className="button" onClick={onClose}>Fermer</button></div>
  </Modal>;
}

function ProductPhoto({ product }: { product: OpenFoodFactsProduct }) {
  const [failed, setFailed] = useState('');
  return <span className="off-product-photo">{product.imageUrl && failed !== product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(product.imageUrl)}/> : <Package size={24}/>}</span>;
}
