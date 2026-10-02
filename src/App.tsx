import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Copy, Download, FileDown, FilePlus2, FolderOpen, HelpCircle, Keyboard, Layers, LoaderCircle, MoreHorizontal, Pencil, Plus, Redo2, Save, ShieldCheck, Undo2, Upload, X, AlertCircle, Table2, Settings2, Package } from 'lucide-react';
import { Board, type Selection } from './Board';
import { SettingsPanel, RightPanel } from './Panels';
import { Summaries } from './Summaries';
import { ImportDialog } from './ImportDialog';
import { SettingsDialog } from './SettingsDialog';
import { EditSelectionDialog } from './EditSelectionDialog';
import { projectWithImport, type ImportMode } from './importer';
import { LibraryDialog } from './LibraryDialog';
import { GroupDialog, BlockDialog } from './ComposeDialogs';
import { Modal } from './Modal';
import { TutorialDialog, initialTutorialStep, saveTutorialProgress } from './TutorialDialog';
import { capacity, demoProject, findSpace, generate, getGroups, newProject, normalizeProject, scopeProducts, totalSales, uid, validBlock } from './domain';
import { csvContent, pdfPayload } from './exports';
import { planogramPNG } from './imageExport';
import { download, downloadBlob, initialProject, initialRightPanel, saveRightPanel, safeName, saveProject } from './storage';
import { groupingLabels, modeLabels, number, salesText } from './format';
import type { Grouping, MenuAction, Project } from './types';

const textInput = () => Boolean((document.activeElement as HTMLElement | null)?.closest('input:not([type=checkbox]):not([type=color]),textarea,[contenteditable=true]'));
type Confirmation = { title: string; text: string; action: string; run: () => void };
export default function App() {
  const [p, setProject] = useState<Project>(newProject), [ready, setReady] = useState(false), [selection, select] = useState<Selection>(null), [modal, setModal] = useState<'import' | 'library' | 'group' | 'new' | 'shortcuts' | 'help' | 'settings' | null>(null), [blockPosition, setBlockPosition] = useState<{ column: number; shelf: number } | null>(null), [confirmation, setConfirmation] = useState<Confirmation | null>(null), [toast, setToast] = useState(''), [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved'), [menu, setMenu] = useState(false), [editingName, setEditingName] = useState(false), [nameDraft, setNameDraft] = useState(''), [newName, setNewName] = useState(''), [exporting, setExporting] = useState(false), [, updateHistory] = useState(0);
  const past = useRef<Project[]>([]), future = useRef<Project[]>([]), current = useRef(p), timer = useRef<ReturnType<typeof setTimeout> | null>(null), openInput = useRef<HTMLInputElement>(null), noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useEffect(() => { if (ready && tutorialStep !== null) saveTutorialProgress(tutorialStep, 'in-progress'); }, [ready, tutorialStep]);
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
  const saveNow = useCallback(async () => { if (timer.current) clearTimeout(timer.current); const snapshot = current.current; setSaveState('saving'); try { await saveProject(snapshot); if (current.current === snapshot) setSaveState('saved'); } catch (e) { setSaveState('error'); notify(`Enregistrement impossible : ${(e as Error).message}`); throw e; } }, [notify]);
  useEffect(() => { void initialProject().then(project => { if (project) load(project); }).catch(e => notify(`Le dernier plan n’a pas pu être ouvert : ${e.message}`)).finally(() => setReady(true)); }, []);
  useEffect(() => { if (!ready || (!p.products.length && p.name === 'Nouveau plan' && !past.current.length)) return; setSaveState('saving'); timer.current = setTimeout(() => { void saveNow().catch(() => {}); }, 650); return () => { if (timer.current) clearTimeout(timer.current); }; }, [p, ready, saveNow]);
  useEffect(() => { if (!window.plano) return; return window.plano.onCloseRequest(() => { (document.activeElement as HTMLElement | null)?.blur(); void saveNow().then(() => window.plano!.finishClose()).catch(() => {}); }); }, [saveNow]);
  useEffect(() => { if (!window.plano) return; return window.plano.onProjectRequested(raw => { (document.activeElement as HTMLElement | null)?.blur(); void saveNow().then(() => { load(normalizeProject(raw)); notify('Le projet a été ouvert.'); }).catch(error => notify(error.message)); }); }, [saveNow, load, notify]);
  const openProject = useCallback(async () => { try { await saveNow(); if (window.plano) { const raw = await window.plano.openProject(); if (raw) { load(normalizeProject(raw)); notify('Le projet a été ouvert.'); } } else openInput.current?.click(); } catch (e) { notify((e as Error).message); } }, [saveNow, load, notify]);
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
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Escape') { setMenu(false); select(null); }
      const input = (e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); void saveNow().then(() => notify('Plan enregistré dans votre bibliothèque.')).catch(() => {}); return; }
      if (input) return;
      if (e.ctrlKey || e.metaKey) { if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); } if (e.key.toLowerCase() === 'o') { e.preventDefault(); void openProject(); } if (e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); } if (e.key.toLowerCase() === 'e' && selection) { e.preventDefault(); editSelection(selection); } if (e.key.toLowerCase() === 'n') { e.preventDefault(); setNewName(''); setModal('new'); } if (e.key.toLowerCase() === 'a' && e.shiftKey) { e.preventDefault(); setShowRightPanel(visible => !visible); } }
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
  }, [selection, undo, redo, saveNow, removeSelected, duplicateSelected, openProject, editSelection]);
  const recalculate = (next: Project, text: string) => {
    const apply = () => { commit(next.products.length ? generate(next) : next); select(null); };
    if (p.products.length) setConfirmation({ title: 'Recalculer l’implantation ?', text, action: 'Recalculer le plan', run: apply }); else apply();
  };
  const changeGrouping = (groupBy: Grouping, segment = p.targetSegment) => { if (groupBy === p.groupBy && segment === p.targetSegment) return; recalculate({ ...p, groupBy, targetSegment: segment, massUnits: {}, massOrder: [], blockPlacements: [], articlePlacements: [] }, 'Le nouveau périmètre ou niveau de regroupement recalculera les implantations dans les trois modes. Vos données et vos couleurs seront conservées.'); };
  const exportProject = async () => { setMenu(false); try { await saveNow(); if (window.plano) await window.plano.exportProject(current.current); else download(JSON.stringify(current.current, null, 2), `${safeName(current.current.name)}.plano`); } catch (e) { notify((e as Error).message); } };
  const exportPDF = async () => { setExporting(true); try { const payload = pdfPayload(current.current); if (window.plano) { if (await window.plano.exportPDF(payload)) notify('Le PDF a été enregistré.'); } else { const win = window.open('', '_blank'); if (!win) throw new Error('Autorisez la fenêtre d’impression pour exporter le PDF.'); win.document.write(payload.html); win.document.close(); win.focus(); win.print(); } } catch (e) { notify(`Export PDF impossible : ${(e as Error).message}`); } finally { setExporting(false); } };
  const exportImage = async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    const snapshot = current.current;
    setExportingImage(true);
    try {
      const blob = await planogramPNG(snapshot);
      if (window.plano) { if (await window.plano.exportImage({ name: snapshot.name, data: new Uint8Array(await blob.arrayBuffer()) })) notify('L’image PNG a été enregistrée.'); }
      else { downloadBlob(blob, `${safeName(snapshot.name)}.png`); notify('L’image PNG a été téléchargée.'); }
    } catch (e) { notify(`Export de l’image impossible : ${(e as Error).message}`); }
    finally { setExportingImage(false); }
  };
  const dialogOpen = Boolean(modal || blockPosition || confirmation || editingSelection || (ready && tutorialStep !== null));
  const canEdit = Boolean(selection && (selection.kind === 'group' ? getGroups(p).some(group => group.id === selection.id) : selection.kind === 'block' ? p.blockPlacements.some(block => block.id === selection.id) : p.articlePlacements.some(article => article.id === selection.id)));
  useEffect(() => { void window.plano?.updateMenuState({ hasData: Boolean(p.products.length), canUndo: Boolean(past.current.length), canRedo: Boolean(future.current.length), canEdit, canMutate: canEdit && selection?.kind !== 'group', canCompose: p.viewMode === 'blocks' && Boolean(p.products.length), dialogOpen: !ready || dialogOpen, editingText, showRightPanel, exporting, exportingImage }); }, [p, selection, canEdit, dialogOpen, ready, editingText, showRightPanel, exporting, exportingImage]);
  menuAction.current = action => {
    if (dialogOpen) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setMenu(false);
    switch (action) {
      case 'new': setNewName(''); setModal('new'); break;
      case 'open': void openProject(); break;
      case 'library': void saveNow().then(() => setModal('library')).catch(() => {}); break;
      case 'save': void saveNow().then(() => notify('Plan enregistré dans votre bibliothèque.')).catch(() => {}); break;
      case 'export-project': void exportProject(); break;
      case 'export-pdf': void exportPDF(); break;
      case 'export-image': void exportImage(); break;
      case 'export-csv': download(csvContent(current.current), `${safeName(current.current.name)}.csv`, 'text/csv;charset=utf-8'); break;
      case 'settings': setModal('settings'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'edit-selection': if (selection && canEdit) editSelection(selection); break;
      case 'duplicate': duplicateSelected(); break;
      case 'delete': removeSelected(); break;
      case 'toggle-panel': setShowRightPanel(visible => !visible); break;
      case 'import-sales': startImport('sales'); break;
      case 'import-catalog': startImport('catalog'); break;
      case 'create-group': setModal('group'); break;
      case 'compose-block': setBlockPosition(findSpace(p, composeSize.width, composeSize.height) || { column: 0, shelf: 0 }); break;
      case 'help': setModal('help'); break;
      case 'shortcuts': setModal('shortcuts'); break;
    }
  };
  const groups = getGroups(p), products = scopeProducts(p), unrepresented = p.viewMode === 'mass' ? groups.filter(g => !(p.massUnits[g.id] > 0)).length : p.viewMode === 'articles' ? products.filter(x => !p.articlePlacements.some(a => a.productId === x.id)).length : groups.filter(g => !p.blockPlacements.some(b => b.groupId === g.id)).length;
  const closeModal = useCallback(() => setModal(null), []), closeBlock = useCallback(() => setBlockPosition(null), []), closeConfirm = useCallback(() => setConfirmation(null), []);
  return <div className="app-shell"><header className="app-header"><div className="brand"><div className="brand-mark"><i/><i/><i/></div><strong>Plano<span>Pilot</span></strong></div><div className="header-divider"/><button className="nav-library" onClick={() => { void saveNow().then(() => setModal('library')).catch(() => {}); }}><FolderOpen size={17}/>Mes plans<ChevronDown size={13}/></button><div className="header-spacer"/><button className="nav-library settings-trigger" onClick={() => setModal('settings')}><Settings2 size={17}/>Paramètres</button><span className="offline-pill"><ShieldCheck size={14}/>Hors ligne</span><button className="icon-button" title="Aide et tutoriel" onClick={() => setModal('help')}><HelpCircle size={19}/></button><div className="avatar" title="Espace de travail local">PP</div></header>
    <div className="workspace-header"><div className="project-title"><div className="breadcrumb">MES PLANS <span>/</span> ESPACE DE TRAVAIL</div>{editingName ? <input className="name-input" maxLength={150} autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} onBlur={() => { if (nameDraft.trim() && nameDraft.trim() !== p.name) commit({ ...p, name: nameDraft.trim() }); setEditingName(false); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditingName(false); } }}/>: <button className="project-name" title="Renommer le plan" onClick={() => { setNameDraft(p.name); setEditingName(true); }}><h1>{p.name}</h1><Pencil size={16}/></button>}<div className={`save-status ${saveState}`}>{saveState === 'saving' ? <LoaderCircle size={12} className="spin"/> : saveState === 'error' ? <AlertCircle size={13}/> : <Check size={13}/>}<span>{saveState === 'saving' ? 'Enregistrement…' : saveState === 'error' ? 'Échec de la sauvegarde' : 'Toutes les modifications sont enregistrées'}</span></div></div><div className="workspace-actions"><button className="button" onClick={() => { setNewName(''); setModal('new'); }}><FilePlus2 size={16}/>Nouveau plan</button><button className="button" onClick={() => void openProject()}><FolderOpen size={16}/>Ouvrir un fichier</button><button className="button primary" disabled={!p.products.length || exporting} onClick={() => void exportPDF()}>{exporting ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>}Télécharger le PDF</button><div className="menu-wrapper"><button className={`icon-button menu-trigger ${menu ? 'active' : ''}`} title="Autres actions" onClick={() => setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu && <><div className="menu-dismiss" onClick={() => setMenu(false)}/><div className="dropdown-menu"><button onClick={() => { setMenu(false); void saveNow().then(() => notify('Plan enregistré dans votre bibliothèque.')).catch(() => {}); }}><Save size={16}/>Enregistrer le plan<kbd>Ctrl S</kbd></button><button onClick={() => void exportProject()}><FileDown size={16}/>Exporter le projet .plano</button><button disabled={!p.products.length} onClick={() => { download(csvContent(p), `${safeName(p.name)}.csv`, 'text/csv;charset=utf-8'); setMenu(false); }}><Table2 size={16}/>Exporter les données CSV</button><button onClick={() => { setMenu(false); setModal('shortcuts'); }}><Keyboard size={16}/>Raccourcis clavier</button></div></>}</div></div></div>
    <div className={`workspace ${showRightPanel ? '' : 'without-right-panel'}`}><SettingsPanel p={p} composeSize={composeSize} onComposeSize={setComposeSize} hasData={Boolean(p.products.length)} onImport={() => startImport()} onConfiguration={config => recalculate({ ...p, ...config }, 'La nouvelle structure recalculera les implantations pour respecter la capacité du meuble.')} onGrouping={changeGrouping} onMode={viewMode => { commit({ ...p, viewMode }); select(null); }} onGenerate={() => recalculate(p, 'Cette action remplacera les implantations manuelles par une nouvelle répartition, calculée selon le réglage de pondération. Vous pourrez l’annuler.')} onWeighted={weightedBySales => commit({ ...p, weightedBySales })} onCompose={() => setBlockPosition(findSpace(p, composeSize.width, composeSize.height) || { column: 0, shelf: 0 })}/><main className="main-content"><div className="plan-context"><div><span className="context-dot"/>{modeLabels[p.viewMode]}<span className="context-divider"/>Par {groupingLabels[p.groupBy].toLowerCase()}<span className="tag subtle">{p.shelves} tablettes</span></div><div className="history-actions"><button className="icon-button" disabled={!past.current.length} title="Annuler (Ctrl Z)" onClick={undo}><Undo2 size={17}/></button><button className="icon-button" disabled={!future.current.length} title="Rétablir (Ctrl Y)" onClick={redo}><Redo2 size={17}/></button></div></div>{p.products.length > 0 && <div className="overview-metrics"><div><span>{p.salesMetric === 'catalog' ? 'VENTES NON RENSEIGNÉES' : p.salesMetric === 'revenue' ? 'CHIFFRE D’AFFAIRES DU PÉRIMÈTRE' : 'VENTES DU PÉRIMÈTRE'}</span><strong>{salesText(totalSales(p), p.salesMetric)}</strong></div><div><span>RÉFÉRENCES</span><strong>{number(new Set(products.map(x => x.sku)).size)}</strong></div><div><span>GROUPES</span><strong>{groups.length}</strong></div><div><span>LARGEUR DU RAYON</span><strong>{number(p.elements * 1.33, 2)} <small>m</small></strong></div></div>}<Board assortmentVisible={showRightPanel} onEdit={editSelection} project={p} onExportImage={() => void exportImage()} exportingImage={exportingImage} commit={commit} selection={selection} select={select} notify={notify} onImport={() => startImport()} onDemo={() => { load(demoProject()); notify('Exemple chargé. Vous pouvez le modifier librement.'); }} onNewBlock={(column, shelf) => setBlockPosition({ column, shelf })}/>{p.products.length > 0 && unrepresented > 0 && <div className="unrepresented"><AlertCircle size={15}/>{unrepresented} {p.viewMode === 'articles' ? 'référence(s)' : 'groupe(s)'} sans emplacement dans ce mode. Les ventes restent incluses dans les calculs.</div>}{p.salesMetric === 'catalog' && p.products.length > 0 && <div className="catalogue-notice"><Package size={16}/><span>Catalogue sans données de ventes · Répartition à parts égales. Les formats à confirmer figurent dans les notes des produits.</span></div>}<Summaries p={p} commit={commit} selection={selection} select={select} onCustomGroup={() => setModal('group')}/><footer className="workspace-footer"><ShieldCheck size={13}/><span>Calculé depuis vos données · Enregistré sur cet ordinateur</span><span>PlanoPilot 1.2.0</span></footer></main>{showRightPanel && <RightPanel p={p}/>}</div>
    <input ref={openInput} type="file" accept=".plano" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void file.text().then(text => { load(normalizeProject(JSON.parse(text))); notify('Le projet a été ouvert.'); }).catch(err => notify(`Ouverture impossible : ${err.message}`)); e.target.value = ''; }}/>
    {editingSelection && <EditSelectionDialog key={`${editingSelection.kind}:${editingSelection.id}`} p={p} selection={editingSelection} select={select} commit={commit} onClose={closeEdit} onDelete={removeSelected}/>}
    {modal === 'settings' && <SettingsDialog onClose={closeModal} onImport={startImport} showRightPanel={showRightPanel} onRightPanel={setShowRightPanel}/>}
    {modal === 'import' && <ImportDialog onClose={closeModal} initialMode={importSource.mode} initialFile={importSource.file} hasProducts={Boolean(p.products.length)} onImport={async (imported, sourceName, sourceSheet, salesMetric, destination) => {
      try {
        if (destination === 'new') await saveNow();
        const base = destination === 'new' ? { ...newProject(), name: sourceName.startsWith('royal-bourbon-') ? 'Royal Bourbon Industries · Catalogue' : sourceName.replace(/\.[^.]+$/, '') } : p;
        const next = projectWithImport(base, imported, sourceName, sourceSheet, salesMetric);
        if (destination === 'new') load(next); else commit(next);
        select(null); closeModal(); notify(`${number(imported.length)} lignes importées. Votre implantation est prête.`);
      } catch (e) { notify(`Import impossible : ${(e as Error).message}`); }
    }}/>}
    {modal === 'library' && <LibraryDialog currentId={p.id} onClose={closeModal} onLoad={load} onNew={() => { setNewName(''); setModal('new'); }}/>}
    {modal === 'group' && <GroupDialog p={p} onClose={closeModal} onCreate={next => { commit(next); closeModal(); select(null); notify('Le regroupement a été créé. Les blocs existants sont conservés.'); }}/>}
    {blockPosition && <BlockDialog p={p} {...blockPosition} composeSize={composeSize} onComposeSize={setComposeSize} onClose={closeBlock} onCreate={(next, id) => { commit(next); closeBlock(); select({ kind: 'block', id }); }}/>}
    {modal === 'new' && <Modal title="Créer un nouveau plan" subtitle="Un nouveau projet indépendant dans votre bibliothèque locale." onClose={closeModal}><form onSubmit={e => { e.preventDefault(); const next = newProject(); next.name = newName.trim(); load(next); }}><div className="dialog-body"><label className="field">Nom du projet<input placeholder="Ex. Plan de masse · Enseigne A" value={newName} onChange={e => setNewName(e.target.value)} maxLength={150}/></label></div><div className="modal-footer"><button type="button" className="button" onClick={closeModal}>Annuler</button><button className="button primary" disabled={!newName.trim()}><Plus size={16}/>Créer le plan</button></div></form></Modal>}
    {confirmation && <Modal title={confirmation.title} onClose={closeConfirm}><div className="dialog-body"><div className="confirm-icon"><Layers size={26}/></div><p className="confirmation-text">{confirmation.text}</p></div><div className="modal-footer"><button className="button" onClick={closeConfirm}>Conserver mon plan</button><button className="button primary" onClick={() => { confirmation.run(); closeConfirm(); }}>{confirmation.action}</button></div></Modal>}
    {modal === 'help' && <Modal title="Besoin d’un repère ?" subtitle="Retrouvez les étapes et les raccourcis pour travailler avec aisance." onClose={closeModal}><div className="help-dialog"><button className="help-card" aria-label="Revoir le tutoriel" onClick={() => { closeModal(); setTutorialStep(0); }}><span className="help-card-icon"><HelpCircle size={23}/></span><span><strong>Revoir le tutoriel</strong><small>Six étapes pour importer, composer et partager un plan.</small></span><ChevronDown size={17} className="help-card-arrow"/></button><button className="help-card" aria-label="Raccourcis clavier" onClick={() => setModal('shortcuts')}><span className="help-card-icon"><Keyboard size={23}/></span><span><strong>Raccourcis clavier</strong><small>Enregistrer, annuler, déplacer ou dupliquer une sélection.</small></span><ChevronDown size={17} className="help-card-arrow"/></button><div className="help-local-note"><ShieldCheck size={15}/><span>Votre bibliothèque et vos données restent sur cet ordinateur.</span></div></div><div className="modal-footer"><button className="button primary" onClick={closeModal}>Fermer l’aide</button></div></Modal>}
    {ready && tutorialStep !== null && !modal && !blockPosition && !confirmation && !editingSelection && <TutorialDialog step={tutorialStep} onStep={setTutorialStep} onClose={closeTutorial} onComplete={completeTutorial}/>}
    {modal === 'shortcuts' && <Modal title="À portée de clavier" subtitle="Les raccourcis respectent toujours l’élément sélectionné." onClose={closeModal}><div className="shortcuts">{[['Enregistrer le plan', 'Ctrl + S'], ['Ouvrir un projet .plano', 'Ctrl + O'], ['Annuler', 'Ctrl + Z'], ['Rétablir', 'Ctrl + Y'], ['Modifier la sélection', 'Double-clic / Ctrl + E'], ['Afficher le panneau de droite', 'Ctrl + Maj + A'], ['Dupliquer le bloc ou l’article', 'Ctrl + D'], ['Déplacer la sélection', '← ↑ → ↓'], ['Supprimer le bloc ou l’article', 'Suppr / Retour arrière'], ['Fermer ou désélectionner', 'Échap']].map(([label, keys]) => <div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}</div><div className="modal-footer"><span className="muted">PlanoPilot · 100 % hors ligne</span><button className="button primary" onClick={closeModal}>Compris</button></div></Modal>}
    {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" title="Fermer la notification" onClick={() => setToast('')}><X size={16}/></button></div>}
    {!ready && <div className="loading-screen"><div className="brand-mark"><i/><i/><i/></div><LoaderCircle className="spin" size={24}/><span>Ouverture de votre espace de travail…</span></div>}
  </div>;
}
