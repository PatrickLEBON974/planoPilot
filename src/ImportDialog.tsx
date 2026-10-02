import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, FileSpreadsheet, UploadCloud, AlertTriangle, LoaderCircle } from 'lucide-react';
import { Modal } from './Modal';
import { fields, mapProducts, readWorkbook, suggestMapping, type ImportMode, type Mapping, type Sheet } from './importer';
import type { Product, SalesMetric } from './types';
import { number } from './format';

export function ImportDialog({ onClose, onImport, initialMode = 'sales', initialFile, hasProducts = false }: {
  onClose: () => void;
  onImport: (products: Product[], file: string, sheet: string, metric: SalesMetric, destination: 'new' | 'replace') => void;
  initialMode?: ImportMode; initialFile?: File; hasProducts?: boolean;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]), [sheetIndex, setSheetIndex] = useState(0), [fileName, setFileName] = useState('');
  const [header, setHeader] = useState(0), [mapping, setMapping] = useState<Mapping | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [skipInvalid, setSkipInvalid] = useState(false);
  const [metric, setMetric] = useState<SalesMetric>(initialMode === 'catalog' ? 'catalog' : 'revenue');
  const [destination, setDestination] = useState<'new' | 'replace'>(initialMode === 'catalog' ? 'new' : 'replace');
  const catalog = metric === 'catalog', current = sheets[sheetIndex], headers = current?.rows[header] || [];
  const activeFields = fields.filter(f => !catalog || !['sales', 'quantity'].includes(f.key));
  const required = (field: typeof fields[number]) => Boolean(field.required && (!catalog || field.key !== 'sales'));
  const selectedColumns = mapping ? activeFields.map(f => mapping[f.key]).filter(x => x >= 0) : [];
  const duplicateMapping = new Set(selectedColumns).size !== selectedColumns.length;
  const complete = mapping && !duplicateMapping && activeFields.filter(required).every(f => mapping[f.key] >= 0);
  const result = useMemo(() => current && mapping && complete ? mapProducts(current.rows, header, mapping, headers, catalog ? 'catalog' : 'sales') : null, [current, mapping, header, complete, catalog]);

  const read = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(''); setSheets([]); setMapping(null);
    try {
      const values = await readWorkbook(file);
      if (!values.length) throw new Error('Aucune feuille de données trouvée.');
      const firstRow = Math.max(0, values[0].rows.findIndex(row => row.filter(Boolean).length >= 3));
      const suggested = suggestMapping(values[0].rows[firstRow] || []);
      setSheets(values); setFileName(file.name); setSheetIndex(0); setHeader(firstRow); setMapping(suggested); setSkipInvalid(false);
      if (suggested.sales < 0) { setMetric('catalog'); setDestination('new'); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (initialFile) void read(initialFile); }, [initialFile]);
  const changeSheet = (i: number) => { setSheetIndex(i); setHeader(0); setMapping(suggestMapping(sheets[i].rows[0] || [])); setSkipInvalid(false); };
  const importData = async () => {
    if (busy || !result?.products.length || (result.errors.length && !skipInvalid)) return;
    setBusy(true);
    try { await onImport(result.products, fileName, current.name, metric, destination); } finally { setBusy(false); }
  };

  return <Modal title="Importer vos produits et ventes" subtitle="Les données restent sur cet ordinateur. Aucun fichier n’est envoyé en ligne." onClose={onClose} wide>
    {!sheets.length ? <div className="import-start">
      <label className="file-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void read(e.dataTransfer.files[0]); }}>
        <div className="large-icon"><UploadCloud size={32}/></div><h3>Déposez votre fichier ici</h3><p>ou cliquez pour choisir un fichier</p><span>CSV ou Excel XLSX · Jusqu’à 50 Mo</span>
        <input type="file" accept=".csv,.xlsx" onChange={e => void read(e.target.files?.[0])} hidden/>
      </label>
      <div className="import-tip"><FileSpreadsheet size={20}/><p>{catalog ? 'Pour un catalogue, le produit, la marque et le segment suffisent. Les conditionnements et les sources sont facultatifs.' : 'Votre fichier doit contenir le produit, la marque, le segment et les ventes. Un catalogue sans ventes est aussi accepté.'} Vous pourrez associer les colonnes à l’étape suivante.</p></div>
    </div> : <div className="import-body">
      <div className="source-summary"><FileSpreadsheet size={26}/><div><strong>{fileName}</strong><span>{number(current.rows.length - header - 1)} lignes · {sheets.length} onglet{sheets.length > 1 ? 's' : ''}</span></div><label className="text-button">Changer de fichier<input type="file" accept=".csv,.xlsx" onChange={e => void read(e.target.files?.[0])} hidden/></label></div>
      <div className="form-grid three">
        <label>Onglet à analyser<select value={sheetIndex} onChange={e => changeSheet(Number(e.target.value))}>{sheets.map((sheet, i) => <option value={i} key={i}>{sheet.name}</option>)}</select></label>
        <label>Ligne des en-têtes<input type="number" min={1} max={current.rows.length} value={header + 1} onChange={e => { const i = Math.max(0, Math.min(current.rows.length - 1, Number(e.target.value) - 1)); setHeader(i); setMapping(suggestMapping(current.rows[i] || [])); setSkipInvalid(false); }}/></label>
        <label>Mesure des ventes<select value={metric} onChange={e => { const value = e.target.value as SalesMetric; setMetric(value); setSkipInvalid(false); if (value === 'catalog') setDestination('new'); }}><option value="revenue">Chiffre d’affaires en euros</option><option value="units">Ventes en unités</option><option value="catalog">Catalogue sans ventes</option></select></label>
      </div>
      {catalog && <div className="import-tip"><FileSpreadsheet size={20}/><p>Les ventes et les quantités ne sont pas renseignées. Le plan sera réparti à parts égales, avec les parts de ventes affichées comme indisponibles.</p></div>}
      <h3 className="section-title">Associez les colonnes <span>* obligatoire</span></h3>
      <div className="mapping-grid">{activeFields.map(field => <label key={field.key}>{field.label}{required(field) && <b className="required"> *</b>}<select value={mapping?.[field.key] ?? -1} onChange={e => { setMapping({ ...mapping!, [field.key]: Number(e.target.value) }); setSkipInvalid(false); }}><option value={-1}>{required(field) ? 'Choisir une colonne' : 'Non disponible'}</option>{headers.map((name, i) => <option key={i} value={i}>{name || `Colonne ${i + 1}`}</option>)}</select></label>)}</div>
      <h3 className="section-title">Aperçu du fichier</h3>
      <div className="import-preview"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h || `Colonne ${i + 1}`}</th>)}</tr></thead><tbody>{current.rows.slice(header + 1, header + 5).map((row, i) => <tr key={i}>{headers.map((_, c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody></table></div>
      {result && <div className={`validation ${result.errors.length ? 'warning' : 'success'}`}>{result.errors.length ? <AlertTriangle size={20}/> : <Check size={20}/>}<div><strong>{number(result.products.length)} lignes prêtes à être importées</strong>{result.errors.length > 0 && <><p>{result.errors.length} lignes invalides. {result.errors.slice(0, 2).join(' ')}</p><label className="check-line"><input type="checkbox" checked={skipInvalid} onChange={e => setSkipInvalid(e.target.checked)}/>Ignorer explicitement ces lignes et importer les autres</label></>}{result.duplicates > 0 && <p>{catalog ? `${result.duplicates} références répétées exclues du catalogue.` : `${result.duplicates} références répétées : leurs ventes seront additionnées, et elles seront comptées une seule fois dans le nombre de références.`}</p>}</div></div>}
      <label className="field import-destination">Destination de l’import<select value={destination} onChange={e => setDestination(e.target.value as typeof destination)}><option value="new">Créer un nouveau plan</option><option value="replace">Utiliser le plan actuel</option></select></label>
      {destination === 'replace' && hasProducts && <p className="help-text">Cet import remplacera l’assortiment et les implantations du plan actuel. Vous pourrez annuler avec Ctrl Z.</p>}
    </div>}
    {duplicateMapping && <div className="error-banner">Chaque champ doit être associé à une colonne différente.</div>}{error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-footer"><button className="button" onClick={onClose}>Annuler</button><button className="button primary" disabled={busy || !result?.products.length || (result.errors.length > 0 && !skipInvalid)} onClick={importData}>{busy ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>}Importer les données</button></div>
  </Modal>;
}
