import { newProject } from './domain.ts';
import type { Project } from './types.ts';

export type PlanStructure = Pick<Project, 'elements' | 'shelves' | 'unitsPerElement' | 'halfUnits'>;
export type PlanSettings = PlanStructure & Pick<Project, 'groupBy' | 'targetSegment'>;
export type PlanDefaults = PlanStructure & Pick<Project, 'viewMode' | 'groupBy'>;

export const planSettings = (project: Project): PlanSettings => ({ elements: project.elements, shelves: project.shelves, unitsPerElement: project.unitsPerElement, halfUnits: project.halfUnits, groupBy: project.groupBy, targetSegment: project.targetSegment });
export const planDefaults = (value: PlanDefaults): PlanDefaults => ({ elements: value.elements, shelves: value.shelves, unitsPerElement: value.unitsPerElement, halfUnits: value.halfUnits, viewMode: value.viewMode, groupBy: value.groupBy });
export const validStructure = (value: PlanStructure) => Number.isFinite(value.elements) && value.elements >= .5 && value.elements <= 15 && Number.isInteger(value.elements * 2) && value.shelves >= 4 && value.shelves <= 9 && Number.isInteger(value.shelves) && value.unitsPerElement >= 1 && value.unitsPerElement <= 100 && Number.isInteger(value.unitsPerElement) && value.halfUnits >= 1 && value.halfUnits <= 100 && Number.isInteger(value.halfUnits);

export function validPlanDefaults(value: unknown): value is PlanDefaults {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as PlanDefaults;
  return validStructure(candidate) && ['mass', 'blocks', 'articles'].includes(candidate.viewMode) && ['segment', 'subsegment', 'brand', 'sku'].includes(candidate.groupBy);
}

export const newPlanWithDefaults = (defaults: PlanDefaults): Project => ({ ...newProject(), ...planDefaults(defaults) });
