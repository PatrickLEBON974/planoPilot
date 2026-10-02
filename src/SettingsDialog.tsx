import Papa from 'papaparse';
import { Download, FileSpreadsheet, Package, Upload } from 'lucide-react';
import { Modal } from './Modal';
import { download } from './storage';
import type { ImportMode } from './importer';
import royalBourbonCSV from '../data/imports/royal-bourbon-produits-2026-10-01.csv?raw';

const royalFileName = 'royal-bourbon-produits-2026-10-01.csv';
const royalCount = Papa.parse<string[]>(royalBourbonCSV, { skipEmptyLines: 'greedy' }).data.length - 1;
export function SettingsDialog({ onClose, onImport, showRightPanel, onRightPanel }: { onClose: () => void; onImport: (mode: ImportMode, file?: File) => void; showRightPanel: boolean; onRightPanel: (visible: boolean) => void }) {
  return <Modal title="Paramètres" subtitle="Personnalisez l’affichage et gérez vos fichiers et catalogues." onClose={onClose} wide className="settings-dialog">
    <div className="settings-dialog-body">
      <section className="settings-display"><h3>Affichage</h3><label className="switch-line"><div><strong>Afficher le panneau de droite</strong><span>Assortiment, recherche et filtres. Double-cliquez sur un élément du planogramme pour le modifier.</span></div><input type="checkbox" role="switch" checked={showRightPanel} onChange={event => onRightPanel(event.target.checked)}/></label></section>
      <h3>Import de produits</h3>
      <p className="settings-description">Importez un catalogue pour composer votre assortiment, ou un fichier de ventes pour calculer une répartition commerciale.</p>
      <div className="settings-import-cards">
        <div className="settings-import-card"><Package size={25}/><h4>Catalogue de produits</h4><p>Produits, marques, segments et conditionnements. Les ventes peuvent être absentes.</p><button className="button primary" onClick={() => onImport('catalog')}><Upload size={16}/>Importer un catalogue</button><button className="text-button" onClick={() => download('\ufeffRéférence;Désignation;Marque;Segment;Sous-segment;Conditionnement;Fournisseur;Source;Notes\r\n', 'modele-catalogue.csv', 'text/csv;charset=utf-8')}>Télécharger le modèle CSV</button></div>
        <div className="settings-import-card"><FileSpreadsheet size={25}/><h4>Données de ventes</h4><p>Chiffre d’affaires ou ventes en unités. Retrouvez l’association des colonnes et la validation des lignes.</p><button className="button" onClick={() => onImport('sales')}><Upload size={16}/>Importer des ventes</button></div>
      </div>
      <div className="settings-catalogue">
        <span className="eyebrow">CATALOGUE DISPONIBLE</span><h3>Royal Bourbon Industries</h3>
        <p>{royalCount} entrées relevées sur le site et la boutique officiels le 1er octobre 2026. Les gammes non détaillées et les formats à confirmer sont indiqués dans les notes.</p>
        <p className="settings-description">Le fichier contient des références internes PlanoPilot et les liens des sources. Le catalogue public ne détaille pas toutes les références de l’entreprise.</p>
        <div className="settings-catalogue-actions"><button className="button primary" onClick={() => onImport('catalog', new File([royalBourbonCSV], royalFileName, { type: 'text/csv' }))}><Upload size={16}/>Importer Royal Bourbon</button><button className="button" onClick={() => download(royalBourbonCSV, royalFileName, 'text/csv;charset=utf-8')}><Download size={16}/>Télécharger le CSV</button></div>
      </div>
    </div>
    <div className="modal-footer"><button className="button" onClick={onClose}>Fermer les paramètres</button></div>
  </Modal>;
}
