export type Grouping = 'segment' | 'subsegment' | 'brand' | 'sku';
export type ViewMode = 'mass' | 'blocks' | 'articles';
export type SalesMetric = 'revenue' | 'units' | 'catalog';
export interface Product { id: string; sku: string; name: string; brand: string; segment: string; subsegment: string; sales: number; quantity?: number; ours: boolean | null; packaging?: string; sourceUrl?: string; supplier?: string; notes?: string; }
export interface Block { id: string; groupId: string | null; label: string; color: string; column: number; shelf: number; width: number; height: number; }
export interface CustomGroup { id: string; label: string; members: string[]; groupingLevel: Grouping; color: string; }
export interface ArticlePlacement { id: string; productId: string; column: number; shelf: number; }
export interface Project {
  schemaVersion: 1; id: string; name: string; updatedAt: string; products: Product[];
  sourceName: string; sourceSheet: string; salesMetric: SalesMetric; elements: number; shelves: number; unitsPerElement: number; halfUnits: number;
  viewMode: ViewMode; groupBy: Grouping; targetSegment: string; weightedBySales: boolean;
  massUnits: Record<string, number>; massOrder: string[]; blockPlacements: Block[]; articlePlacements: ArticlePlacement[]; customGroups: CustomGroup[]; groupColors: Record<string, string>;
}
export interface Group { id: string; label: string; sales: number; share: number; references: number; products: Product[]; color: string; }
export interface SavedPlan { id: string; name: string; updatedAt: string; }
export type MenuAction = 'new' | 'open' | 'library' | 'save' | 'export-project' | 'export-pdf' | 'export-image' | 'export-csv' | 'settings' | 'undo' | 'redo' | 'edit-selection' | 'duplicate' | 'delete' | 'toggle-panel' | 'import-sales' | 'import-catalog' | 'create-group' | 'compose-block' | 'help' | 'shortcuts';
export interface MenuState { hasData: boolean; canUndo: boolean; canRedo: boolean; canEdit: boolean; canMutate: boolean; canCompose: boolean; dialogOpen: boolean; editingText: boolean; showRightPanel: boolean; exporting: boolean; exportingImage: boolean; }
export interface DesktopAPI {
  saveProject(project: Project): Promise<void>;
  listProjects(): Promise<SavedPlan[]>;
  loadProject(id: string): Promise<unknown>;
  deleteProject(id: string): Promise<void>;
  openProject(): Promise<unknown | null>;
  exportProject(project: Project): Promise<boolean>;
  exportPDF(payload: { name: string; html: string; width: number; height: number }): Promise<boolean>;
  exportImage(payload: { name: string; data: Uint8Array }): Promise<boolean>;
  initialProject(): Promise<unknown | null>;
  onCloseRequest(callback: () => void): () => void;
  onProjectRequested(callback: (project: unknown) => void): () => void;
  onMenuAction(callback: (action: MenuAction) => void): () => void;
  updateMenuState(state: MenuState): Promise<void>;
  finishClose(): void;
}
declare global { interface Window { plano?: DesktopAPI; } }
