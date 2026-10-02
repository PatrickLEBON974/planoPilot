import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from './Modal';
import { PlanStructureFields, validStructure } from './PlanParameters';
import { newProject } from './domain';
import { groupingLabels, modeLabels } from './format';
import type { Grouping, Project, ViewMode } from './types';

export function NewPlanDialog({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (plan: Project) => Promise<boolean>; busy: boolean }) {
  const [plan, setPlan] = useState(newProject);
  return <Modal title="Créer un nouveau plan" subtitle="Réglez le meuble et l’implantation. Le nom du fichier sera choisi lors de l’enregistrement." onClose={onClose} wide className="new-plan-dialog">
    <form onSubmit={event => { event.preventDefault(); if (validStructure(plan) && !busy) void onCreate({ ...plan, name: 'Sans titre' }); }}>
      <div className="new-plan-body">
        <section><h3>Structure du meuble</h3><PlanStructureFields value={plan} onChange={structure => setPlan({ ...plan, ...structure })}/></section>
        <section><h3>Implantation</h3><label className="field">Type d’implantation<select aria-label="Type d’implantation" value={plan.viewMode} onChange={event => setPlan({ ...plan, viewMode: event.target.value as ViewMode })}>{Object.entries(modeLabels).map(([mode, label]) => <option value={mode} key={mode}>{label}</option>)}</select></label><label className="field">Niveau de regroupement<select aria-label="Niveau de regroupement" value={plan.groupBy} onChange={event => setPlan({ ...plan, groupBy: event.target.value as Grouping })}>{Object.entries(groupingLabels).map(([level, label]) => <option value={level} key={level}>{label}</option>)}</select></label><label className="switch-line"><div><strong>Pondérer selon les ventes</strong><span>Appliqué après l’import des ventes</span></div><input type="checkbox" role="switch" checked={plan.weightedBySales} onChange={event => setPlan({ ...plan, weightedBySales: event.target.checked })}/></label><p className="help-text new-plan-help">Vous pourrez importer des ventes ou un catalogue dans ce plan.</p></section>
      </div>
      <div className="modal-footer"><button type="button" className="button" disabled={busy} onClick={onClose}>Annuler</button><button className="button primary" disabled={busy || !validStructure(plan)}><Plus size={16}/>Créer le plan</button></div>
    </form>
  </Modal>;
}
