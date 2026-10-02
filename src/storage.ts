import { newProject } from './domain.ts';
import { planDefaults, validPlanDefaults, type PlanDefaults } from './planSettings.ts';

const panelKey = 'planopilot:right-panel-visible';
const defaultsKey = 'planopilot:plan-defaults:v1';
export function initialRightPanel(): boolean { try { return localStorage.getItem(panelKey) === 'true'; } catch { return false; } }
export function saveRightPanel(visible: boolean): void { try { localStorage.setItem(panelKey, String(visible)); } catch {} }
export function initialPlanDefaults(): PlanDefaults {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(defaultsKey) || 'null');
    if (validPlanDefaults(value)) return planDefaults(value);
  } catch { /* Missing or unreadable preferences use the initial dimensions. */ }
  return planDefaults(newProject());
}
export function savePlanDefaults(value: PlanDefaults): void {
  if (!validPlanDefaults(value)) throw new Error('Réglages par défaut invalides.');
  localStorage.setItem(defaultsKey, JSON.stringify(planDefaults(value)));
}
export function downloadBlob(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function download(content: string, name: string, mime = 'application/json'): void { downloadBlob(new Blob([content], { type: mime }), name); }
export const safeName = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'planopilot';
