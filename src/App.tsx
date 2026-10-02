import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, PanelLeftClose, PanelLeftOpen, ChevronDown, Download, FileDown, FilePlus2, FolderOpen, HelpCircle, Keyboard, Layers, LoaderCircle, MoreHorizontal, Search, Plus, Redo2, Save, ShieldCheck, Undo2, X, AlertCircle, Table2, Package } from 'lucide-react';
import { Board, type Selection } from './Board';
import { SettingsPanel, RightPanel } from './Panels';
import { Summaries } from './Summaries';
import { ImportDialog } from './ImportDialog';
import { CatalogResourcesDialog } from './CatalogResourcesDialog';
import { OpenFoodFactsDialog } from './OpenFoodFactsDialog';
import { appendOpenFoodFactsProduct } from './openFoodFacts';
import { EditSelectionDialog } from './EditSelectionDialog';
import { projectWithImport, type ImportMode } from './importer';
import { usePlanFile } from './usePlanFile';
import { NewPlanDialog } from './NewPlanDialog';
import { RecentPlansDrawer } from './RecentPlansDrawer';
import { planSettings, validStructure } from './PlanParameters';
import { GroupDialog, BlockDialog } from './ComposeDialogs';
import { Modal } from './Modal';
import { TutorialDialog, initialTutorialStep, saveTutorialProgress } from './TutorialDialog';
import { capacity, demoProject, findSpace, generate, getGroups, newProject, scopeProducts, totalSales, uid, validBlock } from './domain';
import { csvContent, pdfPayload } from './exports';
import { planogramPNG } from './imageExport';
import { download, downloadBlob, initialRightPanel, saveRightPanel, safeName } from './storage';
import { groupingLabels, modeLabels, number, salesText } from './format';
import type { MenuAction, Project } from './types';

const textInput = () => Boolean((document.activeElement as HTMLElement | null)?.closest('input:not([type=checkbox]):not([type=color]),textarea,[contenteditable=true]'));
type Confirmation = { title: string; text: string; action: string; run: () => void };
export default function App() {
  const [p, setProject] = useState<Project>(newProject), [selection, select] = useState<Selection>(null), [modal, setModal] = useState<'import' | 'group' | 'new' | 'recent' | 'shortcuts' | 'help' | 'catalog-resources' | 'off-search' | null>(null), [blockPosition, setBlockPosition] = useState<{ column: number; shelf: number } | null>(null), [confirmation, setConfirmation] = useState<Confirmation | null>(null), [toast, setToast] = useState(''), [menu, setMenu] = useState(false), [exporting, setExporting] = useState(false), [, updateHistory] = useState(0);
  const [settings, setSettings] = useState(() => planSettings(p));
  useEffect(() => setSettings(planSettings(p)), [p.id, p.products, p.elements, p.shelves, p.unitsPerElement, p.halfUnits, p.groupBy, p.targetSegment]);
  const desktop = Boolean(window.plano);
  const [showSettings, setShowSettings] = useState(true);
  const [zoom, setZoom] = useState(1), [showGrid, setShowGrid] = useState(true);
  const past = useRef<Project[]>([]), future = useRef<Project[]>([]), current = useRef(p), openInput = useRef<HTMLInputElement>(null), noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportingImage, setExportingImage] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(initialRightPanel), [editingText, setEditingText] = useState(false), [editingSelection, setEditingSelection] = useState<Selection>(null);
  const menuAction = useRef<(action: MenuAction) => void>(() => {});
  const editSelection = useCallback((value: NonNullable<Selection>) => { select(value); setToast(''); setEditingSelection(value); }, []);
  const closeEdit = useCallback(() => setEditingSelection(null), []);
  useEffect(() => saveRightPanel(showRightPanel), [showRightPanel]);
  useEffect(() => { const update = () => setEditingText(textInput()); document.addEventListener('focusin', update); document.addEventListener('focusout', update); return () => { document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); }; }, []);
  useEffect(() => window.plano?.onMenuAction(action => menuAction.current(action)), []);
  const [tutorialStep, setTutorialStep] = useState<number | null>(initialTutorialStep);
  const tutorialCurrent = useRef(tutorialStep); tutorialCurrent.current = tutorialStep;
  const closeTutorial = useCallback(() => { saveTutorialProgress(tutorialCurrent.current ?? 0, 'dismissed'); setTutorialStep(null); }, []);
  const completeTutorial = useCallback(() => { saveTutorialProgress(tutorialCurrent.current ?? 0, 'completed'); setTutorialStep(null); }, []);
  const [importSource, setImportSource] = useState<{ mode: ImportMode; file?: File }>({ mode: 'sales' });
  const startImport = (mode: ImportMode = 'sales', file?: File) => { setImportSource({ mode, file }); setModal('import'); };
  const [composeSize, setComposeSize] = useState({ width: 4, height: 2 });
  useEffect(() => { setComposeSize(size => ({ width: Math.min(size.width, capacity(p)), height: Math.min(size.height, p.shelves) })); }, [p.elements, p.unitsPerElement, p.halfUnits, p.shelves]);
  current.current = p;
  const notify = useCallback((text: string) => { setToast(text); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setToast(''), 7000); }, []);
  const commit = useCallback((next: Project) => { if (next === current.current) return; past.current.push(current.current); if (past.current.length > 60) past.current.shift(); future.current = []; const result = { ...next, updatedAt: new Date().toISOString() }; current.current = result; setProject(result); updateHistory(x => x + 1); }, []);
  const load = useCallback((next: Project) => { past.current = []; future.current = []; current.current = next; setProject(next); select(null); setModal(null); setBlockPosition(null); setEditingSelection(null); updateHistory(x => x + 1); }, []);
  const undo = useCallback(() => { const previous = past.current.pop(); if (!previous) return; future.current.push(current.current); const result = { ...previous, updatedAt: new Date().toISOString() }; current.current = result; setProject(result); select(null); updateHistory(x => x + 1); }, []);
  const redo = useCallback(() => { const next = future.current.pop(); if (!next) return; past.current.push(current.current); const result = { ...next, updatedAt: new Date().toISOString() }; current.current = result; setProject(result); select(null); updateHistory(x => x + 1); }, []);
  const file = usePlanFile({ project: p, current, load, notify });
  const { ready } = file;
  useEffect(() => { if (ready && tutorialStep !== null) saveTutorialProgress(tutorialStep, 'in-progress'); }, [ready, tutorialStep]);
  const saveNow = file.save;
  const saveState = file.error ? 'error' : file.saving ? 'saving' : file.dirty ? 'unsaved' : file.filePath ? 'saved' : 'new';
  const openProject = useCallback(() => { if (window.plano) return file.open(); openInput.current?.click(); }, [file.open]);
  const removeSelected = useCallback(() => {
    const project = current.current;
    if (selection?.kind === 'block') commit({ ...project, blockPlacements: project.blockPlacements.filter(b => b.id !== selection.id) });
    else if (selection?.kind === 'article') commit({ ...project, articlePlacements: project.articlePlacements.filter(a => a.id !== selection.id) });
    else return;
    select(null);
  }, [selection, commit]);
  const duplicateSelected = useCallback(() => {
    const project = current.current;
    if (selection?.kind === 'block') {
      const original = project.blockPlacements.find(b => b.id === selection.id); if (!original) return;
      const space = findSpace(project, original.width, original.height); if (!space) { notify('Il n’y a pas d’emplacement libre pour un bloc de ces dimensions.'); return; }
      const block = { ...original, ...space, id: uid() }; commit({ ...project, blockPlacements: [...project.blockPlacements, block] }); select({ kind: 'block', id: block.id });
    } else if (selection?.kind === 'article') {
      const original = project.articlePlacements.find(a => a.id === selection.id); if (!original) return;
      for (let shelf = 0; shelf < project.shelves; shelf++) for (let column = 0; column < capacity(project); column++) if (!project.articlePlacements.some(a => a.column === column && a.shelf === shelf)) { const article = { ...original, id: uid(), column, shelf }; commit({ ...project, articlePlacements: [...project.articlePlacements, article] }); select({ kind: 'article', id: article.id }); return; }
      notify('Toutes les cases du meuble sont occupées.');
    }
  }, [selection, commit, notify]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ready || file.working || file.saving || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Escape') { setMenu(false); select(null); }
      const input = (e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); void saveNow(e.shiftKey); return; }
      if (input) return;
      if (e.ctrlKey || e.metaKey) { if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); } if (e.key.toLowerCase() === 'o') { e.preventDefault(); void openProject(); } if (e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); } if (e.key.toLowerCase() === 'e' && selection) { e.preventDefault(); editSelection(selection); } if (e.key.toLowerCase() === 'n') { e.preventDefault(); setModal('new'); } if (file.hasDocument && e.key.toLowerCase() === 'a' && e.shiftKey) { e.preventDefault(); setShowRightPanel(visible => !visible); } }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selection?.kind !== 'group') { e.preventDefault(); removeSelected(); } }
      if (selection && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const project = current.current;
        if (selection.kind === 'block') { const b = project.blockPlacements.find(x => x.id === selection.id); if (b) { const candidate = { ...b, column: b.column + dx, shelf: b.shelf + dy }; if (validBlock(project, candidate, b.id)) commit({ ...project, blockPlacements: project.blockPlacements.map(x => x.id === b.id ? candidate : x) }); } }
        if (selection.kind === 'article') { const a = project.articlePlacements.find(x => x.id === selection.id); if (a) { const candidate = { ...a, column: a.column + dx, shelf: a.shelf + dy }; if (candidate.column >= 0 && candidate.column < capacity(project) && candidate.shelf >= 0 && candidate.shelf < project.shelves && !project.articlePlacements.some(x => x.id !== a.id && x.column === candidate.column && x.shelf === candidate.shelf)) commit({ ...project, articlePlacements: project.articlePlacements.map(x => x.id === a.id ? candidate : x) }); } }
        if (selection.kind === 'group' && dx) { const order = getGroups(project).map(g => g.id), i = order.indexOf(selection.id), target = i + dx; if (target >= 0 && target < order.length) { [order[i], order[target]] = [order[target], order[i]]; commit({ ...project, massOrder: order }); } }
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [selection, undo, redo, saveNow, removeSelected, duplicateSelected, openProject, editSelection, ready, file.hasDocument, file.working, file.saving]);
  const recalculate = (next: Project, text: string) => {
    const apply = () => { commit(next.products.length ? generate(next) : next); select(null); };
    if (p.products.length) setConfirmation({ title: 'Recalculer l’implantation ?', text, action: 'Recalculer le plan', run: apply }); else apply();
  };
  const generatePlan = () => {
    if (!validStructure(settings)) return;
    const next = { ...current.current, ...settings };
    if (next.groupBy !== current.current.groupBy || next.targetSegment !== current.current.targetSegment) next.massOrder = [];
    recalculate(next, 'Les paramètres sélectionnés seront appliqués et les implantations manuelles seront remplacées par une nouvelle répartition. Vous pourrez l’annuler.');
  };
  const openExample = () => { void file.replace(demoProject()).then(opened => { if (opened) notify('Exemple chargé. Vous pouvez le modifier librement.'); }); };
  const exportPDF = async () => { setExporting(true); try { const payload = pdfPayload({ ...current.current, name: file.documentName }); if (window.plano) { if (await window.plano.exportPDF(payload)) notify('Le PDF a été enregistré.'); } else { const win = window.open('', '_blank'); if (!win) throw new Error('Autorisez la fenêtre d’impression pour exporter le PDF.'); win.document.write(payload.html); win.document.close(); win.focus(); win.print(); } } catch (e) { notify(`Export PDF impossible : ${(e as Error).message}`); } finally { setExporting(false); } };
  const exportImage = async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    const snapshot = { ...current.current, name: file.documentName };
    setExportingImage(true);
    try {
      const blob = await planogramPNG(snapshot);
      if (window.plano) { if (await window.plano.exportImage({ name: snapshot.name, data: new Uint8Array(await blob.arrayBuffer()) })) notify('L’image PNG a été enregistrée.'); }
      else { downloadBlob(blob, `${safeName(snapshot.name)}.png`); notify('L’image PNG a été téléchargée.'); }
    } catch (e) { notify(`Export de l’image impossible : ${(e as Error).message}`); }
    finally { setExportingImage(false); }
  };
  const dialogOpen = Boolean(modal || blockPosition || confirmation || editingSelection || file.prompting || file.working || file.saving || (ready && tutorialStep !== null));
  const canEdit = Boolean(selection && (selection.kind === 'group' ? getGroups(p).some(group => group.id === selection.id) : selection.kind === 'block' ? p.blockPlacements.some(block => block.id === selection.id) : p.articlePlacements.some(article => article.id === selection.id)));
  useEffect(() => { void window.plano?.updateMenuState({ canGenerate: validStructure(settings), hasDocument: file.hasDocument, hasData: Boolean(p.products.length), canUndo: Boolean(past.current.length), canRedo: Boolean(future.current.length), canEdit, canMutate: canEdit && selection?.kind !== 'group', canCompose: p.viewMode === 'blocks' && Boolean(p.products.length), dialogOpen: !ready || dialogOpen, editingText, showRightPanel, showGrid, canZoomIn: zoom < 3, canZoomOut: zoom > 1, exporting, exportingImage }); }, [p, settings, file.hasDocument, selection, canEdit, dialogOpen, ready, editingText, showRightPanel, showGrid, zoom, exporting, exportingImage]);
  menuAction.current = action => {
    if (!ready || dialogOpen) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setMenu(false);
    switch (action) {
      case 'new': setModal('new'); break;
      case 'open': void openProject(); break;
      case 'recent': setModal('recent'); break;
      case 'save': void saveNow(); break;
      case 'save-as': void saveNow(true); break;
      case 'export-pdf': void exportPDF(); break;
      case 'export-image': void exportImage(); break;
      case 'export-csv': download(csvContent(current.current), `${safeName(file.documentName)}.csv`, 'text/csv;charset=utf-8'); break;
      case 'catalog-resources': setModal('catalog-resources'); break;
      case 'off-search': setModal('off-search'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'edit-selection': if (selection && canEdit) editSelection(selection); break;
      case 'duplicate': duplicateSelected(); break;
      case 'delete': removeSelected(); break;
      case 'toggle-panel': setShowRightPanel(visible => !visible); break;
      case 'toggle-grid': setShowGrid(visible => !visible); break;
      case 'zoom-in': setZoom(value => Math.min(3, value + .25)); break;
      case 'zoom-out': setZoom(value => Math.max(1, value - .25)); break;
      case 'zoom-reset': setZoom(1); break;
      case 'import-sales': startImport('sales'); break;
      case 'import-catalog': startImport('catalog'); break;
      case 'generate': generatePlan(); break;
      case 'create-group': setModal('group'); break;
      case 'compose-block': setBlockPosition(findSpace(p, composeSize.width, composeSize.height) || { column: 0, shelf: 0 }); break;
      case 'help': setModal('help'); break;
      case 'tutorial': setTutorialStep(0); break;
      case 'shortcuts': setModal('shortcuts'); break;
      case 'demo': openExample(); break;
    }
  };
  const groups = getGroups(p), products = scopeProducts(p), unrepresented = p.viewMode === 'mass' ? groups.filter(g => !(p.massUnits[g.id] > 0)).length : p.viewMode === 'articles' ? products.filter(x => !p.articlePlacements.some(a => a.productId === x.id)).length : groups.filter(g => !p.blockPlacements.some(b => b.groupId === g.id)).length;
  const closeModal = useCallback(() => setModal(null), []), closeBlock = useCallback(() => setBlockPosition(null), []), closeConfirm = useCallback(() => setConfirmation(null), []);
  return <div className="app-shell"><header className="app-header"><div className="brand"><div className="brand-mark"><i/><i/><i/></div><strong>Plano<span>Pilot</span></strong></div><div className="header-spacer"/>{!desktop && <><button className="header-action" onClick={() => setModal('catalog-resources')}><Package size={17}/>Modèles d’import CSV</button><button className="header-action" disabled={!file.hasDocument} onClick={() => setShowRightPanel(visible => !visible)} aria-pressed={file.hasDocument && showRightPanel}>Assortiment</button><button className="icon-button" title="Aide et tutoriel" onClick={() => setModal('help')}><HelpCircle size={19}/></button></>}{(exporting || exportingImage) && <span className="export-status" role="status"><LoaderCircle size={14} className="spin"/>{exporting ? "Export du PDF…" : "Export de l’image…"}</span>}{file.hasDocument && <span className={`save-status app-save-status ${saveState}`} title={file.filePath || 'Choisissez un emplacement avec Enregistrer.'}>{saveState === 'saving' ? <LoaderCircle size={13} className="spin"/> : saveState === 'error' || file.dirty ? <AlertCircle size={13}/> : <Check size={13}/>}<span>{saveState === 'saving' ? 'Enregistrement…' : saveState === 'error' ? 'Échec de l’enregistrement' : file.dirty ? 'Modifications non enregistrées' : file.filePath ? (desktop ? 'Enregistré' : 'Téléchargé') : 'Non enregistré'}</span></span>}</header>
    {!desktop && <div className="workspace-actions browser-actions"><button className="button" onClick={() => { setModal('new'); }}><FilePlus2 size={16}/>Nouveau plan</button><button className="button" onClick={() => void openProject()}><FolderOpen size={16}/>Ouvrir un plan (.plano)</button><button className="button primary" disabled={!p.products.length || exporting} onClick={() => void exportPDF()}>{exporting ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>}Télécharger le PDF</button><div className="menu-wrapper"><button className={`icon-button menu-trigger ${menu ? 'active' : ''}`} title="Autres actions" onClick={() => setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu && <><div className="menu-dismiss" onClick={() => setMenu(false)}/><div className="dropdown-menu"><button disabled={!file.hasDocument} onClick={() => { setMenu(false); void saveNow(); }}><Save size={16}/>Enregistrer le plan<kbd>Ctrl S</kbd></button><button disabled={!file.hasDocument} onClick={() => { setMenu(false); void saveNow(true); }}><FileDown size={16}/>Enregistrer sous…</button><button disabled={!p.products.length} onClick={() => { download(csvContent(p), `${safeName(file.documentName)}.csv`, 'text/csv;charset=utf-8'); setMenu(false); }}><Table2 size={16}/>Exporter les données CSV</button><button onClick={() => { setMenu(false); setModal('off-search'); }}><Search size={16}/>Rechercher sur Open Food Facts</button><button onClick={() => { setMenu(false); setModal('shortcuts'); }}><Keyboard size={16}/>Raccourcis clavier</button></div></>}</div></div>}
    <div className={`workspace ${file.hasDocument && showRightPanel ? '' : 'without-right-panel'} ${file.hasDocument && showSettings ? '' : 'without-left-panel'} ${file.hasDocument ? '' : 'document-home'}`} >{file.hasDocument && <SettingsPanel hidden={!showSettings} p={p} hasData={Boolean(p.products.length)} onImport={() => startImport()} settings={settings} onSettings={setSettings} onMode={viewMode => { commit({ ...p, viewMode }); select(null); }} onGenerate={generatePlan} onWeighted={weightedBySales => commit({ ...p, weightedBySales })}/>}<main className="main-content">{file.hasDocument && <div className="plan-context"><div><button className="button settings-toggle" aria-controls="plan-settings" aria-expanded={showSettings} aria-label={showSettings ? "Réduire les paramètres" : "Afficher les paramètres"} title={showSettings ? "Réduire les paramètres" : "Afficher les paramètres"} onClick={() => setShowSettings(visible => !visible)}>{showSettings ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}Paramètres</button><span className="context-dot"/>{modeLabels[p.viewMode]}<span className="context-divider"/>Par {groupingLabels[p.groupBy].toLowerCase()}<span className="tag subtle">{p.shelves} tablettes</span></div>{!desktop && <div className="history-actions"><button className="icon-button" disabled={!past.current.length} title="Annuler (Ctrl Z)" onClick={undo}><Undo2 size={17}/></button><button className="icon-button" disabled={!future.current.length} title="Rétablir (Ctrl Y)" onClick={redo}><Redo2 size={17}/></button></div>}</div>}{p.products.length > 0 && <div className="overview-metrics"><div><span>{p.salesMetric === 'catalog' ? 'VENTES NON RENSEIGNÉES' : p.salesMetric === 'revenue' ? 'CHIFFRE D’AFFAIRES DU PÉRIMÈTRE' : 'VENTES DU PÉRIMÈTRE'}</span><strong>{salesText(totalSales(p), p.salesMetric)}</strong></div><div><span>RÉFÉRENCES</span><strong>{number(new Set(products.map(x => x.sku)).size)}</strong></div><div><span>GROUPES</span><strong>{groups.length}</strong></div><div><span>LARGEUR DU RAYON</span><strong>{number(p.elements * 1.33, 2)} <small>m</small></strong></div></div>}<Board fileName={file.filePath ? file.documentName : undefined} hasDocument={file.hasDocument} onNewPlan={() => setModal('new')} zoom={zoom} onZoom={setZoom} grid={showGrid} onGrid={setShowGrid} assortmentVisible={file.hasDocument && showRightPanel} onEdit={editSelection} project={p} onExportImage={() => void exportImage()} exportingImage={exportingImage} commit={commit} selection={selection} select={select} notify={notify} onImport={() => startImport()} onDemo={openExample} onNewBlock={(column, shelf) => setBlockPosition({ column, shelf })}/>{p.products.length > 0 && unrepresented > 0 && <div className="unrepresented"><AlertCircle size={15}/>{unrepresented} {p.viewMode === 'articles' ? 'référence(s)' : 'groupe(s)'} sans emplacement dans ce mode. Les ventes restent incluses dans les calculs.</div>}{p.salesMetric === 'catalog' && p.products.length > 0 && <div className="catalogue-notice"><Package size={16}/><span>Catalogue sans données de ventes · Répartition à parts égales. Les parts de ventes et les écarts ne sont pas disponibles.</span></div>}<Summaries p={p} commit={commit} selection={selection} select={select} onCustomGroup={() => setModal('group')}/><footer className="workspace-footer"><span>PlanoPilot 1.2.0</span></footer></main>{file.hasDocument && showRightPanel && <RightPanel p={p}/>}</div>
    <input ref={openInput} type="file" accept=".plano" hidden onChange={e => { const selected = e.target.files?.[0]; if (selected) void file.openBrowserFile(selected); e.target.value = ''; }}/>
    {editingSelection && <EditSelectionDialog key={`${editingSelection.kind}:${editingSelection.id}`} p={p} selection={editingSelection} select={select} commit={commit} onClose={closeEdit} onDelete={removeSelected}/>}
    {modal === 'catalog-resources' && <CatalogResourcesDialog onClose={closeModal}/>}
    {modal === 'off-search' && <OpenFoodFactsDialog p={p} onClose={closeModal} onAdd={product => { const next = appendOpenFoodFactsProduct(p, product); void (file.hasDocument ? Promise.resolve(commit(next)).then(() => true) : file.replace(next)).then(added => { if (added) { select(null); closeModal(); notify('La référence a été ajoutée à l’assortiment.'); } }); }}/>}
    {modal === 'import' && <ImportDialog onClose={closeModal} initialMode={importSource.mode} initialFile={importSource.file} hasProducts={Boolean(p.products.length)} onImport={async (imported, sourceName, sourceSheet, salesMetric, destination) => {
      try {
        const base = destination === 'new' ? newProject() : p;
        const next = projectWithImport(base, imported, sourceName, sourceSheet, salesMetric);
        if (destination === 'new' || !file.hasDocument) { if (!await file.replace(next)) return; } else commit(next);
        select(null); closeModal(); notify(`${number(imported.length)} lignes importées. Votre implantation est prête.`);
      } catch (e) { notify(`Import impossible : ${(e as Error).message}`); }
    }}/>}
    {modal === 'group' && <GroupDialog p={p} onClose={closeModal} onCreate={next => { commit(next); closeModal(); select(null); notify('Le regroupement a été créé. Les blocs existants sont conservés.'); }}/>}
    {blockPosition && <BlockDialog p={p} {...blockPosition} composeSize={composeSize} onComposeSize={setComposeSize} onClose={closeBlock} onCreate={(next, id) => { commit(next); closeBlock(); select({ kind: 'block', id }); }}/>}
    {modal === 'new' && <NewPlanDialog onClose={closeModal} onCreate={file.replace} busy={file.working || file.saving}/>}
    {modal === 'recent' && <RecentPlansDrawer onClose={closeModal} onOpen={file.openRecent} onBrowse={() => { void openProject(); }} busy={file.working || file.saving}/>}
    {confirmation && <Modal title={confirmation.title} onClose={closeConfirm}><div className="dialog-body"><div className="confirm-icon"><Layers size={26}/></div><p className="confirmation-text">{confirmation.text}</p></div><div className="modal-footer"><button className="button" onClick={closeConfirm}>Conserver mon plan</button><button className="button primary" onClick={() => { confirmation.run(); closeConfirm(); }}>{confirmation.action}</button></div></Modal>}
    {modal === 'help' && <Modal title="Besoin d’un repère ?" subtitle="Retrouvez les étapes et les raccourcis pour travailler avec aisance." onClose={closeModal}><div className="help-dialog"><button className="help-card" aria-label="Revoir le tutoriel" onClick={() => { closeModal(); setTutorialStep(0); }}><span className="help-card-icon"><HelpCircle size={23}/></span><span><strong>Revoir le tutoriel</strong><small>Six étapes pour importer, composer et partager un plan.</small></span><ChevronDown size={17} className="help-card-arrow"/></button><button className="help-card" aria-label="Raccourcis clavier" onClick={() => setModal('shortcuts')}><span className="help-card-icon"><Keyboard size={23}/></span><span><strong>Raccourcis clavier</strong><small>Enregistrer, annuler, déplacer ou dupliquer une sélection.</small></span><ChevronDown size={17} className="help-card-arrow"/></button><div className="help-local-note"><ShieldCheck size={15}/><span>Vos fichiers et vos données restent sur cet ordinateur.</span></div></div><div className="modal-footer"><button className="button primary" onClick={closeModal}>Fermer l’aide</button></div></Modal>}
    {ready && tutorialStep !== null && !modal && !blockPosition && !confirmation && !editingSelection && !file.prompting && <TutorialDialog step={tutorialStep} onStep={setTutorialStep} onClose={closeTutorial} onComplete={completeTutorial}/>}
    {modal === 'shortcuts' && <Modal title="À portée de clavier" subtitle="Les raccourcis respectent toujours l’élément sélectionné." onClose={closeModal}><div className="shortcuts">{[['Créer un plan', 'Ctrl + N'], ['Enregistrer le plan', 'Ctrl + S'], ['Ouvrir un plan (.plano)', 'Ctrl + O'], ['Enregistrer sous', 'Ctrl + Maj + S'], ['Exporter le PDF', 'Ctrl + P (bureau)'], ['Zoom du plan', 'Ctrl + / Ctrl − / Ctrl 0 (bureau)'], ['Annuler', 'Ctrl + Z'], ['Rétablir', 'Ctrl + Y'], ['Modifier la sélection', 'Double-clic / Ctrl + E'], ['Afficher le panneau de droite', 'Ctrl + Maj + A'], ['Dupliquer le bloc ou l’article', 'Ctrl + D'], ['Déplacer la sélection', '← ↑ → ↓'], ['Supprimer le bloc ou l’article', 'Suppr / Retour arrière'], ['Fermer ou désélectionner', 'Échap']].map(([label, keys]) => <div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}</div><div className="modal-footer"><span className="muted">PlanoPilot · Plans disponibles hors ligne</span><button className="button primary" onClick={closeModal}>Compris</button></div></Modal>}
    {file.unsavedDialog}
    {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" title="Fermer la notification" onClick={() => setToast('')}><X size={16}/></button></div>}
    {!ready && <div className="loading-screen"><div className="brand-mark"><i/><i/><i/></div><LoaderCircle className="spin" size={24}/><span>Ouverture de votre espace de travail…</span></div>}
  </div>;
}
