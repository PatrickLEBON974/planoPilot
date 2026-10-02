const panelKey = 'planopilot:right-panel-visible';
export function initialRightPanel(): boolean { try { return localStorage.getItem(panelKey) === 'true'; } catch { return false; } }
export function saveRightPanel(visible: boolean): void { try { localStorage.setItem(panelKey, String(visible)); } catch {} }
export function downloadBlob(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function download(content: string, name: string, mime = 'application/json'): void { downloadBlob(new Blob([content], { type: mime }), name); }
export const safeName = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'planopilot';
