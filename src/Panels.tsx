import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { FileSpreadsheet, Upload, ChevronDown, Columns3, LayoutGrid, Package, WandSparkles, SlidersHorizontal, Search, Filter, X, Check } from 'lucide-react';
import { scopeProducts } from './domain';
import { groupingLabels, number, salesText } from './format';
import { PlanStructureFields, validStructure, type PlanSettings } from './PlanParameters';
import type { Grouping, Project, ViewMode } from './types';

export function SettingsPanel({ p, settings, onSettings, onImport, onMode, onGenerate, onWeighted, hasData, hidden = false }: { hidden?: boolean; p: Project; settings: PlanSettings; onSettings: (settings: PlanSettings) => void; onImport: () => void; onMode: (mode: ViewMode) => void; onGenerate: () => void; onWeighted: (weighted: boolean) => void; hasData: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const changed = Object.entries(settings).some(([key, value]) => p[key as keyof PlanSettings] !== value);
  const valid = validStructure(settings);
  const segments = [...new Set(p.products.map(product => product.segment))].sort();
  const applyLabel = hasData ? 'Régénérer le plan' : 'Appliquer les paramètres';
  return <aside className="settings-panel" id="plan-settings" hidden={hidden}>
    <div className="panel-heading"><SlidersHorizontal size={16}/><span>Configurer le plan</span></div>
    {hasData && <section className="settings-section">
      <div className="section-heading"><h3>{p.salesMetric === 'catalog' ? 'Catalogue de produits' : 'Données commerciales'}</h3><Check size={15} className="success-text"/></div>
      <div className="imported-file"><FileSpreadsheet size={20}/><div><strong title={p.sourceName}>{p.sourceName}</strong><span>{number(p.products.length)} lignes importées</span></div></div>
      {!window.plano && <button className="button full" onClick={onImport}><Upload size={15}/>Remplacer les données</button>}
      <label className="field">Périmètre à implanter<select aria-label="Périmètre à implanter" value={settings.targetSegment} onChange={event => onSettings({ ...settings, targetSegment: event.target.value })}><option value="">Tous les segments</option>{segments.map(segment => <option key={segment}>{segment}</option>)}</select></label>
    </section>}
    <section className="settings-section">
      <button className="section-heading collapsible" onClick={() => setExpanded(!expanded)}><h3>Structure du meuble</h3><ChevronDown size={15} className={expanded ? '' : 'rotated'}/></button>
      {expanded && <PlanStructureFields value={settings} onChange={structure => onSettings({ ...settings, ...structure })}/>}
    </section>
    <section className="settings-section">
      <div className="section-heading"><h3>Type d’implantation</h3></div>
      <div className="mode-options">{([{ value: 'mass', label: 'En descente', description: 'Toute la hauteur', Icon: Columns3 }, { value: 'blocks', label: 'Par blocs', description: 'Composition libre', Icon: LayoutGrid }, { value: 'articles', label: 'À l’article', description: 'Référence par référence', Icon: Package }] as const).map(({ value, label, description, Icon }) => <button key={value} className={p.viewMode === value ? 'chosen' : ''} onClick={() => onMode(value)}><Icon size={19}/><div><strong>{label}</strong><span>{description}</span></div><i className="radio-dot"/></button>)}</div>
      <label className="field">Niveau de regroupement<select aria-label="Niveau de regroupement" value={settings.groupBy} onChange={event => onSettings({ ...settings, groupBy: event.target.value as Grouping })}>{Object.entries(groupingLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="switch-line"><div><strong>Pondérer selon les ventes</strong><span>{p.salesMetric === 'catalog' ? 'Ventes non renseignées' : p.weightedBySales ? 'Répartition proportionnelle' : 'Répartition à parts égales'}</span></div><input type="checkbox" role="switch" checked={p.weightedBySales} disabled={p.salesMetric === 'catalog'} onChange={event => onWeighted(event.target.checked)}/></label>
      {changed && <p className="pending-settings" role="status">Réglages en attente. Cliquez sur « {applyLabel} » pour les appliquer.</p>}
      <button className="button primary full generate" disabled={!valid || (!hasData && !changed)} onClick={onGenerate}><WandSparkles size={17}/>{applyLabel}</button>
    </section>
  </aside>;
}

export function RightPanel({ p }: { p: Project }) {
  return <aside className="right-panel"><Assortment p={p}/></aside>;
}

function Assortment({ p }: { p: Project }) {
  const [search, setSearch] = useState(''), [brand, setBrand] = useState(''), [segmentFilter, setSegmentFilter] = useState(''), [ownership, setOwnership] = useState(''), [filterOpen, setFilterOpen] = useState(false), [scrollTop, setScrollTop] = useState(0), [height, setHeight] = useState(600);
  const query = useDeferredValue(search.toLowerCase()), ref = useRef<HTMLDivElement>(null), products = useMemo(() => scopeProducts(p), [p.products, p.targetSegment]);
  const brands = useMemo(() => [...new Set(products.map(x => x.brand))].sort(), [products]);
  const segments = useMemo(() => [...new Set(products.map(x => x.segment))].sort(), [products]);
  useEffect(() => { setBrand(''); setSegmentFilter(''); }, [p.targetSegment, p.products]);
  const filtered = useMemo(() => products.filter(x => (!query || `${x.name} ${x.sku} ${x.brand} ${x.subsegment}`.toLowerCase().includes(query)) && (!brand || x.brand === brand) && (!segmentFilter || x.segment === segmentFilter) && (!ownership || (ownership === 'ours' ? x.ours === true : ownership === 'competitor' ? x.ours === false : x.ours === null))).sort((a, b) => b.sales - a.sales), [products, query, brand, segmentFilter, ownership]);
  useEffect(() => { setScrollTop(0); if (ref.current) ref.current.scrollTop = 0; }, [query, brand, segmentFilter, ownership, p.targetSegment]);
  useEffect(() => { if (!ref.current) return; const observer = new ResizeObserver(entries => setHeight(entries[0].contentRect.height)); observer.observe(ref.current); return () => observer.disconnect(); }, []);
  const start = Math.max(0, Math.floor(scrollTop / 88) - 4), count = Math.ceil(height / 88) + 8;
  return <section className="assortment"><div className="panel-heading"><span>Assortiment</span><span className="count-badge">{number(products.length)}</span></div><div className="assortment-controls"><div className="search-field"><Search size={16}/><input aria-label="Rechercher une référence" placeholder="Produit, marque, référence…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button className="icon-button" title="Effacer la recherche" onClick={() => setSearch('')}><X size={14}/></button>}</div><button className={`filter-button ${filterOpen || brand || segmentFilter || ownership ? 'active' : ''}`} onClick={() => setFilterOpen(!filterOpen)}><Filter size={14}/>Filtres<span>{brand || segmentFilter || ownership ? 'Actifs' : 'Tous les produits'}</span></button>{filterOpen && <div className="filter-fields"><select aria-label="Filtrer par marque" value={brand} onChange={e => setBrand(e.target.value)}><option value="">Toutes les marques</option>{brands.map(b => <option key={b}>{b}</option>)}</select><select aria-label="Filtrer par segment" value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)}><option value="">Tous les segments du périmètre</option>{segments.map(segment => <option key={segment}>{segment}</option>)}</select><select aria-label="Filtrer les références internes et concurrentes" value={ownership} onChange={e => setOwnership(e.target.value)}><option value="">Toutes les références</option><option value="ours">Références internes</option><option value="competitor">Références concurrentes</option><option value="unknown">Appartenance non identifiée</option></select></div>}<span className="result-count">{number(filtered.length)} références · {p.salesMetric === 'catalog' ? 'catalogue sans ventes' : 'classées par ventes'}</span></div><div className="product-list" ref={ref} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>{!products.length ? <div className="empty-assortment"><Package size={35}/><strong>Votre assortiment apparaîtra ici</strong><p>Importez vos données pour rechercher et filtrer vos références.</p></div> : !filtered.length ? <div className="empty-small"><Search size={24}/><p>Aucune référence ne correspond.</p><button className="text-button" onClick={() => { setSearch(''); setBrand(''); setSegmentFilter(''); setOwnership(''); }}>Réinitialiser les filtres</button></div> : <><div style={{ height: start * 88 }}/>{filtered.slice(start, start + count).map(product => <div className={`product-row ${p.viewMode === 'articles' ? 'draggable' : ''}`} key={product.id} draggable={p.viewMode === 'articles'} onDragStart={e => e.dataTransfer.setData('application/planopilot', `product:${product.id}`)} title={`${product.name} · ${product.sku}${product.packaging ? ` · ${product.packaging}` : ''}${product.notes ? ` · ${product.notes}` : ''}${product.sourceUrl ? ` · Source : ${product.sourceUrl}` : ''}${p.viewMode === 'articles' ? ' — Glissez cette référence vers une case libre' : ''}`}><div className={`product-monogram ${product.ours ? 'ours' : ''}`}><Package size={18}/></div><div className="product-content"><strong>{product.name}</strong><span>{product.brand} <i>·</i> {product.sku}</span><div><em className={product.ours ? 'ours-tag' : ''}>{product.ours === null ? 'Non identifié' : product.ours ? 'Référence interne' : 'Référence concurrente'}</em><b>{salesText(product.sales, p.salesMetric)}</b></div></div></div>)}<div style={{ height: Math.max(0, filtered.length - start - count) * 88 }}/></>}</div></section>;
}
