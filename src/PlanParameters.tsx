import { Ruler } from 'lucide-react';
import { capacity } from './domain';
import { number } from './format';
import type { Project } from './types';

export type PlanStructure = Pick<Project, 'elements' | 'shelves' | 'unitsPerElement' | 'halfUnits'>;
export type PlanSettings = PlanStructure & Pick<Project, 'groupBy' | 'targetSegment'>;
export const planSettings = (project: Project): PlanSettings => ({ elements: project.elements, shelves: project.shelves, unitsPerElement: project.unitsPerElement, halfUnits: project.halfUnits, groupBy: project.groupBy, targetSegment: project.targetSegment });
export const validStructure = (value: PlanStructure) => value.elements >= .5 && value.elements <= 15 && Number.isInteger(value.elements * 2) && value.shelves >= 4 && value.shelves <= 9 && Number.isInteger(value.shelves) && value.unitsPerElement >= 1 && value.unitsPerElement <= 100 && Number.isInteger(value.unitsPerElement) && value.halfUnits >= 1 && value.halfUnits <= 100 && Number.isInteger(value.halfUnits);

export function PlanStructureFields({ value, onChange }: { value: PlanStructure; onChange: (value: PlanStructure) => void }) {
  return <>
    <label className="field">Nombre d’éléments<div className="counter"><button type="button" aria-label="Retirer un demi-élément" disabled={value.elements <= .5} onClick={() => onChange({ ...value, elements: Math.max(.5, value.elements - .5) })}>−</button><input aria-label="Nombre d’éléments" type="number" min="0.5" max="15" step="0.5" value={value.elements} onChange={event => onChange({ ...value, elements: Number(event.target.value) })}/><button type="button" aria-label="Ajouter un demi-élément" disabled={value.elements >= 15} onClick={() => onChange({ ...value, elements: Math.min(15, value.elements + .5) })}>+</button></div></label>
    <div className="dimension-summary"><Ruler size={14}/><strong>{number(value.elements * 1.33, 2)} m</strong><span>de largeur totale</span></div>
    <div className="form-grid two"><label>Tablettes<select aria-label="Tablettes" value={value.shelves} onChange={event => onChange({ ...value, shelves: Number(event.target.value) })}>{[4, 5, 6, 7, 8, 9].map(n => <option key={n}>{n}</option>)}</select></label><label>Unités / élément<input type="number" min={1} max={100} value={value.unitsPerElement} onChange={event => { const units = Number(event.target.value); onChange({ ...value, unitsPerElement: units, halfUnits: Math.ceil(units / 2) }); }}/></label></div>
    {value.elements % 1 !== 0 && <label className="field">Unités du demi-élément<input aria-label="Unités du demi-élément" type="number" min={1} max={100} value={value.halfUnits} onChange={event => onChange({ ...value, halfUnits: Number(event.target.value) })}/><small>Capacité entière pour une largeur de 66,5 cm.</small></label>}
    <div className="capacity-note"><strong>{capacity(value)}</strong> unités en largeur <span>· {capacity(value) * value.shelves} cases</span></div>
  </>;
}
