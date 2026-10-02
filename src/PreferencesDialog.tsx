import { useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from './Modal';
import { PlanStructureFields } from './PlanParameters';
import { validPlanDefaults, type PlanDefaults } from './planSettings';
import { groupingLabels, modeLabels } from './format';
import type { Grouping, ViewMode } from './types';

export function PreferencesDialog({ defaults, onClose, onSave }: { defaults: PlanDefaults; onClose: () => void; onSave: (value: PlanDefaults) => void }) {
  const [value, setValue] = useState(defaults), [error, setError] = useState('');
  return <Modal title="Paramètres" subtitle="Réglages par défaut pour les nouveaux plans." onClose={onClose} wide className="new-plan-dialog">
    <form onSubmit={event => {
      event.preventDefault();
      if (!validPlanDefaults(value)) return;
      try { onSave(value); } catch { setError('Les paramètres n’ont pas pu être enregistrés. Réessayez.'); }
    }}>
      <div className="new-plan-body">
        <section><h3>Structure par défaut</h3><PlanStructureFields value={value} onChange={structure => setValue({ ...value, ...structure })}/></section>
        <section><h3>Implantation par défaut</h3>
          <label className="field">Type d’implantation<select aria-label="Type d’implantation" value={value.viewMode} onChange={event => setValue({ ...value, viewMode: event.target.value as ViewMode })}>{Object.entries(modeLabels).map(([mode, label]) => <option value={mode} key={mode}>{label}</option>)}</select></label>
          <label className="field">Niveau de regroupement<select aria-label="Niveau de regroupement" value={value.groupBy} onChange={event => setValue({ ...value, groupBy: event.target.value as Grouping })}>{Object.entries(groupingLabels).map(([level, label]) => <option value={level} key={level}>{label}</option>)}</select></label>
        </section>
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="modal-footer"><button type="button" className="button" onClick={onClose}>Annuler</button><button className="button primary" disabled={!validPlanDefaults(value)}><Save size={16}/>Enregistrer</button></div>
    </form>
  </Modal>;
}
