import type { OpenFoodFactsRequest, OpenFoodFactsResult } from '../electron/open-food-facts.mjs';
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
export interface OpenedPlan { project: unknown; filePath: string; }
export interface RecentPlan { filePath: string; name: string; lastUsed: string; available: boolean; }
export type MenuAction = 'new' | 'open' | 'recent' | 'save' | 'save-as' | 'export-pdf' | 'export-image' | 'export-csv' | 'catalog-resources' | 'off-search' | 'undo' | 'redo' | 'edit-selection' | 'duplicate' | 'delete' | 'toggle-panel' | 'toggle-grid' | 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'import-sales' | 'import-catalog' | 'generate' | 'create-group' | 'compose-block' | 'help' | 'tutorial' | 'shortcuts' | 'demo';
export interface MenuState { canGenerate: boolean; hasDocument: boolean; hasData: boolean; canUndo: boolean; canRedo: boolean; canEdit: boolean; canMutate: boolean; canCompose: boolean; dialogOpen: boolean; editingText: boolean; showRightPanel: boolean; showGrid: boolean; canZoomIn: boolean; canZoomOut: boolean; exporting: boolean; exportingImage: boolean; }
export interface DesktopAPI {
  searchOpenFoodFacts(request: OpenFoodFactsRequest): Promise<OpenFoodFactsResult>;
  openOpenFoodFactsProduct(code: string): Promise<void>;
  saveProject(project: Project, saveAs?: boolean): Promise<string | null>;
  activateProject(filePath: string | null): Promise<void>;
  updateDocumentState(state: { name: string; dirty: boolean; hasDocument: boolean }): Promise<void>;
  listRecentPlans(): Promise<RecentPlan[]>;
  openRecentPlan(filePath: string): Promise<OpenedPlan>;
  removeRecentPlan(filePath: string): Promise<void>;
  openProject(): Promise<OpenedPlan | null>;
  exportPDF(payload: { name: string; html: string; width: number; height: number }): Promise<boolean>;
  exportImage(payload: { name: string; data: Uint8Array }): Promise<boolean>;
  initialProject(): Promise<OpenedPlan | null>;
  onCloseRequest(callback: () => void): () => void;
  onProjectRequested(callback: (project: OpenedPlan) => void): () => void;
  onMenuAction(callback: (action: MenuAction) => void): () => void;
  updateMenuState(state: MenuState): Promise<void>;
  finishClose(): void;
}
declare global { interface Window { plano?: DesktopAPI; } }
