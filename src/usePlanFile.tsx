import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Modal } from './Modal';
import { normalizeProject } from './domain';
import { download, safeName } from './storage';
import type { OpenedPlan, Project } from './types';

const content = (project: Project) => JSON.stringify({ ...project, name: undefined, updatedAt: undefined });
const filename = (filePath: string | null) => filePath?.split(/[\\/]/).pop() || 'Sans titre';
const planName = (filePath: string | null) => filename(filePath).replace(/\.plano$/i, '');
type Prompt = { name: string; resolve: (proceed: boolean) => void };

export function usePlanFile({ project, current, load, notify }: { project: Project; current: RefObject<Project>; load: (project: Project) => void; notify: (message: string) => void }) {
  const [ready, setReady] = useState(false), [filePath, setFilePath] = useState<string | null>(null);
  const [hasDocument, setHasDocument] = useState(false);
  const documentOpen = useRef(false), activePath = useRef<string | null>(null);
  const [baseline, setBaseline] = useState<string | null>(() => content(project));
  const savedContent = useRef(baseline);
  const [saving, setSaving] = useState(false), [error, setError] = useState(false), [working, setWorking] = useState(false);
  const savingRef = useRef(false), workingRef = useRef(false), pendingPrompt = useRef<Prompt | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const dirty = hasDocument && (baseline === null || content(project) !== baseline);
  const documentName = planName(filePath);
  const setPath = useCallback((value: string | null) => { activePath.current = value; setFilePath(value); }, []);
  const markOpen = useCallback(() => { documentOpen.current = true; setHasDocument(true); }, []);
  const markSaved = useCallback((value: string | null) => { savedContent.current = value; setBaseline(value); }, []);
  const save = useCallback(async (saveAs = false) => {
    if (!documentOpen.current || savingRef.current) return false;
    savingRef.current = true; setSaving(true); setError(false);
    const snapshot = { ...current.current, name: planName(activePath.current) };
    try {
      let target: string | null;
      if (window.plano) target = await window.plano.saveProject(snapshot, saveAs);
      else { target = `${safeName(snapshot.name)}.plano`; download(JSON.stringify(snapshot, null, 2), target); }
      if (!target) return false;
      setPath(target); markSaved(content(snapshot));
      notify(window.plano ? 'Le fichier .plano a été enregistré.' : 'Le fichier .plano a été téléchargé.');
      return true;
    } catch (cause) { setError(true); notify(`Enregistrement impossible : ${(cause as Error).message}`); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }, [current, markSaved, notify, setPath]);
  const finishPrompt = useCallback((proceed: boolean) => {
    const pending = pendingPrompt.current;
    pendingPrompt.current = null; setPrompt(null); pending?.resolve(proceed);
  }, []);
  const cancelPrompt = useCallback(() => { if (!savingRef.current) finishPrompt(false); }, [finishPrompt]);
  const confirmChange = useCallback(async () => {
    if (!documentOpen.current || (savedContent.current !== null && content(current.current) === savedContent.current)) return true;
    if (pendingPrompt.current) return false;
    return new Promise<boolean>(resolve => { const next = { name: filename(activePath.current), resolve }; pendingPrompt.current = next; setPrompt(next); });
  }, [current]);
  const run = useCallback(async (action: () => Promise<boolean | void>) => {
    if (workingRef.current || savingRef.current) return false;
    workingRef.current = true; setWorking(true);
    try { return await action() !== false; } catch (cause) { notify((cause as Error).message); return false; }
    finally { workingRef.current = false; setWorking(false); }
  }, [notify]);
  const accept = useCallback(async (opened: OpenedPlan, confirm = true) => {
    const next = { ...normalizeProject(opened.project), name: planName(opened.filePath) };
    if (confirm && !await confirmChange()) return false;
    await window.plano?.activateProject(opened.filePath);
    setPath(opened.filePath); markOpen(); markSaved(content(next)); setError(false); load(next);
    notify('Le plan a été ouvert.');
    return true;
  }, [confirmChange, load, markSaved, notify, markOpen, setPath]);
  const replace = useCallback((next: Project) => run(async () => {
    if (!await confirmChange()) return false;
    await window.plano?.activateProject(null);
    setPath(null); markOpen(); markSaved(null); setError(false); load({ ...next, name: 'Sans titre' }); return true;
  }), [confirmChange, load, markSaved, run, markOpen, setPath]);
  const open = useCallback(() => run(async () => {
    const opened = await window.plano?.openProject();
    return opened ? accept(opened) : false;
  }), [accept, run]);
  const openRecent = useCallback((filePath: string) => run(async () => {
    const opened = await window.plano?.openRecentPlan(filePath);
    return opened ? accept(opened) : false;
  }), [accept, run]);
  const openBrowserFile = useCallback((file: File) => run(async () => {
    return accept({ project: JSON.parse(await file.text()), filePath: file.name });
  }), [accept, run]);
  useEffect(() => {
    void (async () => {
      try { const opened = await window.plano?.initialProject(); if (opened) await accept(opened, false); }
      catch (cause) { notify(`Ouverture impossible : ${(cause as Error).message}`); }
      finally { setReady(true); }
    })();
  }, []);
  useEffect(() => window.plano?.onProjectRequested(opened => { void run(() => accept(opened)); }), [accept, run]);
  useEffect(() => window.plano?.onCloseRequest(() => { (document.activeElement as HTMLElement | null)?.blur(); void run(async () => { if (await confirmChange()) window.plano!.finishClose(); }); }), [confirmChange, run]);
  useEffect(() => {
    const title = hasDocument ? `${filename(filePath)}${dirty ? ' *' : ''} — PlanoPilot` : 'PlanoPilot';
    document.title = title;
    void window.plano?.updateDocumentState({ name: documentName, dirty, hasDocument }).catch(() => {});
  }, [filePath, documentName, dirty, hasDocument]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!window.plano && documentOpen.current && (savedContent.current === null || content(current.current) !== savedContent.current)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [current]);
  const unsavedDialog = prompt && <Modal title="Enregistrer les modifications ?" onClose={cancelPrompt} initialFocus=".save-changes"><div className="dialog-body"><p className="confirmation-text">Le plan « {prompt.name} » contient des modifications non enregistrées.</p></div><div className="modal-footer"><button className="button" disabled={saving} onClick={cancelPrompt}>Annuler</button><button className="button" disabled={saving} onClick={() => finishPrompt(true)}>Ne pas enregistrer</button><button className="button primary save-changes" disabled={saving} onClick={() => { void save().then(finishPrompt); }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div></Modal>;
  return { ready, hasDocument, documentName, filePath, dirty, saving, error, working, save, open, openRecent, replace, openBrowserFile, unsavedDialog, prompting: Boolean(prompt) };
}
