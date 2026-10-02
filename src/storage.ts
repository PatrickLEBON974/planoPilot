import { normalizeProject } from './domain';
import type { Project, SavedPlan } from './types';
const key = 'planopilot:plans:v1';
const panelKey = 'planopilot:right-panel-visible';
export function initialRightPanel(): boolean { try { return localStorage.getItem(panelKey) === 'true'; } catch { return false; } }
export function saveRightPanel(visible: boolean): void { try { localStorage.setItem(panelKey, String(visible)); } catch {} }
function webPlans(): Project[] { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
export async function saveProject(p: Project): Promise<void> {
  if (window.plano) return window.plano.saveProject(p);
  const plans = webPlans().filter(x => x.id !== p.id); plans.unshift(p);
  localStorage.setItem(key, JSON.stringify(plans)); localStorage.setItem('planopilot:last', p.id);
}
export async function listProjects(): Promise<SavedPlan[]> { return window.plano ? window.plano.listProjects() : webPlans().map(({ id, name, updatedAt }) => ({ id, name, updatedAt })); }
export async function loadProject(id: string): Promise<Project> { return normalizeProject(window.plano ? await window.plano.loadProject(id) : webPlans().find(x => x.id === id)); }
export async function initialProject(): Promise<Project | null> { const raw = window.plano ? await window.plano.initialProject() : webPlans().find(x => x.id === localStorage.getItem('planopilot:last')); return raw ? normalizeProject(raw) : null; }
export async function deleteProject(id: string): Promise<void> { if (window.plano) return window.plano.deleteProject(id); localStorage.setItem(key, JSON.stringify(webPlans().filter(x => x.id !== id))); }
export function downloadBlob(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function download(content: string, name: string, mime = 'application/json'): void { downloadBlob(new Blob([content], { type: mime }), name); }
export const safeName = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'planopilot';
