import { useEffect, useState } from 'react';
import { FileText, FolderOpen, LoaderCircle, X } from 'lucide-react';
import { Modal } from './Modal';
import type { RecentPlan } from './types';

export function RecentPlansDrawer({ onClose, onOpen, onBrowse, busy }: { onClose: () => void; onOpen: (filePath: string) => Promise<boolean>; onBrowse: () => void; busy: boolean }) {
  const [files, setFiles] = useState<RecentPlan[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [removing, setRemoving] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void window.plano?.listRecentPlans().then(rows => { if (active) setFiles(rows); }).catch(cause => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const remove = async (filePath: string) => {
    setRemoving(filePath); setError('');
    try { await window.plano?.removeRecentPlan(filePath); setFiles(rows => rows.filter(row => row.filePath !== filePath)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setRemoving(null); }
  };
  return <Modal title="Plans récents" subtitle="Ouvrez un fichier .plano récemment utilisé." onClose={onClose} className="recent-files-drawer">
    <div className="recent-files-list">
      {loading ? <div className="empty-small"><LoaderCircle className="spin"/></div> : files.length ? files.map(file => <div className={`recent-file-row ${file.available ? '' : 'missing'}`} key={file.filePath}>
        <button className="recent-file-open" disabled={busy || Boolean(removing) || !file.available} onClick={() => { void onOpen(file.filePath); }} title={file.filePath}>
          <FileText size={24}/><span className="recent-file-info"><strong>{file.name}</strong><span>{file.filePath.replace(/[\\/][^\\/]+$/, '')}</span><small>{file.available ? `Utilisé le ${new Date(file.lastUsed).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Fichier introuvable'}</small></span>
        </button><button className="icon-button" disabled={busy || Boolean(removing)} title={`Retirer ${file.name} de la liste`} onClick={() => { void remove(file.filePath); }}>{removing === file.filePath ? <LoaderCircle size={16} className="spin"/> : <X size={16}/>}</button>
      </div>) : <div className="empty-small"><FolderOpen size={32}/><h3>Aucun fichier récent</h3><p>Les fichiers que vous ouvrez ou enregistrez apparaîtront ici.</p></div>}
    </div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-footer"><button className="button primary" disabled={busy || Boolean(removing)} onClick={onBrowse}><FolderOpen size={16}/>Parcourir les fichiers…</button></div>
  </Modal>;
}
