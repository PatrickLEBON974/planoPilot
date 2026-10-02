import { ArrowLeft, ArrowRight, Check, CheckCircle2, Columns3, Download, FileSpreadsheet, FolderOpen, LayoutGrid, Lightbulb, LockKeyhole, MousePointer2, MoveHorizontal, Package, Ruler, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { Modal } from './Modal';

const preferenceKey = 'planopilot:tutorial:v1';
const steps = [
  {
    label: 'Bienvenue', title: 'Votre premier plan, en quelques étapes',
    description: 'Des données de ventes à une implantation prête à présenter : voici les repères pour prendre PlanoPilot en main.',
    points: ['Importez votre assortiment et ses ventes.', 'Laissez le logiciel proposer une répartition.', 'Ajustez le plan librement, puis partagez le résultat.'],
    tip: 'Vous pouvez aussi explorer un exemple depuis l’accueil, sans préparer de fichier.',
  },
  {
    label: 'Importer', title: 'Commencez avec vos données',
    description: 'Dans la colonne gauche, cliquez sur « Importer un fichier ». Les formats CSV et Excel (.xlsx) sont acceptés.',
    points: ['Avec Excel, choisissez l’onglet et la ligne des en-têtes.', 'Associez les colonnes : produit, marque, segment et ventes.', 'Choisissez le périmètre à implanter après l’import.'],
    tip: 'Vérifiez la mesure choisie : chiffre d’affaires ou quantités vendues. Les lignes invalides sont signalées avant l’import.',
  },
  {
    label: 'Configurer', title: 'Donnez au plan les bonnes dimensions',
    description: 'Dans « Structure du meuble », indiquez les éléments, les tablettes et les unités disponibles en largeur.',
    points: ['Un élément mesure 1,33 m. Les demi-éléments sont possibles.', 'Choisissez de 4 à 9 tablettes et les unités par élément.', 'Cliquez sur « Appliquer la structure » après une modification.'],
    tip: 'Pour un demi-élément, sa capacité en unités est réglable séparément. Le quota du plan affiche l’espace restant.',
  },
  {
    label: 'Générer', title: 'Choisissez votre implantation',
    description: 'Sélectionnez un type de plan et un niveau de regroupement, puis cliquez sur « Générer le plan ».',
    points: ['En descente : chaque groupe occupe toute la hauteur.', 'Par blocs : composez des zones sur plusieurs tablettes.', 'À l’article : travaillez référence par référence.'],
    tip: 'Avec « Pondérer selon les ventes », l’espace suit les ventes. Sans pondération, la répartition est à parts égales.',
  },
  {
    label: 'Ajuster', title: 'Gardez la main sur chaque bloc',
    description: 'Sélectionnez un bloc pour afficher ses réglages dans la colonne droite. Déplacez-le à la souris et ajustez ses bords.',
    points: ['En descente, modifiez aussi les unités dans les cartes sous le plan.', 'En mode blocs, glissez « Nouveau bloc » dans un emplacement libre.', 'Comparez les parts de linéaire et de ventes sous le plan.'],
    tip: 'Ctrl + Z annule une action. Supprimer retire uniquement le bloc ou l’article sélectionné. Les ventes source restent conservées.',
  },
  {
    label: 'Partager', title: 'Retrouvez et partagez votre travail',
    description: 'Votre plan s’enregistre automatiquement sur cet ordinateur. « Mes plans » donne accès à votre bibliothèque.',
    points: ['« Télécharger le PDF » produit une présentation du plan.', 'Le menu « … » propose l’export des données en CSV.', 'Exportez un fichier .plano pour transférer un projet modifiable.'],
    tip: 'Ce tutoriel reste accessible depuis le bouton d’aide en haut à droite. Toutes ces fonctions sont disponibles hors ligne.',
  },
] as const;

export function initialTutorialStep(): number | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
    if (saved && typeof saved === 'object' && 'status' in saved) {
      if (saved.status === 'completed' || saved.status === 'dismissed') return null;
      if (saved.status === 'in-progress' && 'step' in saved && typeof saved.step === 'number' && Number.isInteger(saved.step) && saved.step >= 0 && saved.step < steps.length) return saved.step;
    }
  } catch { /* An unreadable preference restarts the guide. */ }
  return 0;
}

export function saveTutorialProgress(step: number, status: 'in-progress' | 'completed' | 'dismissed'): void {
  try { localStorage.setItem(preferenceKey, JSON.stringify({ step, status })); } catch { /* The guide remains usable if local storage is unavailable. */ }
}

function TutorialVisual({ step }: { step: number }) {
  return <div className={`tutorial-visual scene-${step}`} aria-hidden="true">
    <div className="tutorial-visual-caption"><span className="tutorial-scene-dot"/>PLANO<span>PILOT</span><ShieldCheck size={14}/></div>
    {step === 1 ? <div className="tutorial-file-scene"><div className="tutorial-file-icon"><FileSpreadsheet size={35}/><span>CSV / XLSX</span></div><div className="tutorial-preview-table"><div><span>Produit</span><span>Segment</span><span>Ventes</span></div><div><span>Tomates</span><span>Légumes</span><strong>24 000 €</strong></div><div><span>Maïs</span><span>Légumes</span><strong>16 000 €</strong></div><div><span>Haricots</span><span>Légumes</span><strong>10 000 €</strong></div></div><div className="tutorial-floating-chip"><CheckCircle2 size={15}/>Colonnes associées</div></div>
      : step === 2 ? <><div className="tutorial-dimensions"><span><Ruler size={15}/>4 éléments</span><span>5,32 m</span></div><MiniPlan/><div className="tutorial-specs"><div><strong>6</strong><span>tablettes</span></div><div><strong>12</strong><span>unités / élément</span></div><div><strong>48</strong><span>unités en largeur</span></div></div></>
      : step === 3 ? <><div className="tutorial-modes"><span><Columns3 size={16}/>Descente</span><span><LayoutGrid size={16}/>Blocs</span><span><Package size={16}/>Articles</span></div><MiniPlan/><div className="tutorial-floating-chip"><WandSparkles size={15}/>Répartition selon les ventes</div></>
      : step === 4 ? <><MiniPlan selected/><div className="tutorial-cursor"><MousePointer2 size={25}/></div><div className="tutorial-comparison"><div><span>Part de linéaire</span><strong>40 %</strong></div><div><span>Part de ventes</span><strong>48 %</strong></div></div><div className="tutorial-floating-chip"><MoveHorizontal size={15}/>Déplacer · Redimensionner</div></>
      : step === 5 ? <><div className="tutorial-report"><div className="tutorial-report-title"><div><span>MON PLANOGRAMME</span><strong>Conserves de légumes</strong></div><Download size={18}/></div><MiniPlan/><div className="tutorial-report-lines"><i/><i/><i/></div></div><div className="tutorial-export-formats"><span>PDF</span><span>CSV</span><span>.plano</span></div><div className="tutorial-floating-chip"><CheckCircle2 size={15}/>Enregistré sur cet ordinateur</div></>
      : <><div className="tutorial-welcome-icon"><Sparkles size={30}/></div><MiniPlan/><div className="tutorial-floating-chip"><LockKeyhole size={15}/>Votre espace, 100 % hors ligne</div></>}
    <div className="tutorial-visual-footnote">ILLUSTRATION · EXEMPLE DE PLAN</div>
  </div>;
}

function MiniPlan({ selected = false }: { selected?: boolean }) {
  return <div className={`tutorial-mini-plan ${selected ? 'has-selection' : ''}`}><div className="tutorial-mini-group tomatoes"><strong>Tomates</strong>{selected && <><i className="tutorial-mini-handle left"/><i className="tutorial-mini-handle right"/></>}</div><div className="tutorial-mini-group corn"><strong>Maïs</strong></div><div className="tutorial-mini-group beans"><strong>Grains</strong></div><div className="tutorial-mini-shelves">{Array.from({ length: 5 }, (_, i) => <i key={i}/>)}</div></div>;
}

export function TutorialDialog({ step, onStep, onClose, onComplete }: { step: number; onStep: (step: number) => void; onClose: () => void; onComplete: () => void }) {
  const content = steps[step], last = step === steps.length - 1;
  return <Modal title="Bien démarrer avec PlanoPilot" subtitle="Un guide rapide pour créer votre première implantation." className="tutorial-modal" initialFocus=".tutorial-next" onClose={onClose}>
    <div className="tutorial-progress"><span>PRISE EN MAIN</span><strong aria-live="polite">Étape {step + 1} sur {steps.length}</strong><div className="tutorial-progress-track" role="progressbar" aria-label="Progression du tutoriel" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}><i style={{ width: `${(step + 1) / steps.length * 100}%` }}/></div></div>
    <div className="tutorial-body"><TutorialVisual step={step}/><div className="tutorial-copy" aria-live="polite" aria-atomic="true"><span className="tutorial-eyebrow">{content.label}</span><h3>{content.title}</h3><p>{content.description}</p><ul>{content.points.map(point => <li key={point}><Check size={15}/><span>{point}</span></li>)}</ul><div className="tutorial-tip"><Lightbulb size={17}/><p>{content.tip}</p></div></div></div>
    <div className="modal-footer tutorial-footer"><button className="text-button tutorial-skip" onClick={onClose}>Passer le tutoriel</button>{step > 0 && <button className="button" onClick={() => onStep(step - 1)}><ArrowLeft size={15}/>Précédent</button>}<button className="button primary tutorial-next" onClick={() => last ? onComplete() : onStep(step + 1)}>{last ? <><FolderOpen size={16}/>Commencer</> : <>Suivant<ArrowRight size={16}/></>}</button></div>
  </Modal>;
}
