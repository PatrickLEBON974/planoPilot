import { Download, FileSpreadsheet, Package } from 'lucide-react';
import { Modal } from './Modal';
import { download } from './storage';
export function CatalogResourcesDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="Modèles d’import CSV" subtitle={window.plano ? 'Préparez les données de votre choix, puis importez-les depuis Fichier → Importer dans le plan.' : 'Préparez les données de votre choix, puis cliquez sur Importer un fichier.'} onClose={onClose} wide className="settings-dialog">
    <div className="settings-dialog-body">
      <section className="catalog-template"><Package size={25}/><div><h3>Catalogue de produits</h3><p className="settings-description">La désignation, la marque et le segment sont obligatoires. Référence, conditionnement, fournisseur, source, notes et appartenance sont facultatifs. Aucune donnée de ventes n’est nécessaire.</p></div><button className="button" onClick={() => download('\ufeffRéférence;Désignation;Marque;Segment;Sous-segment;Conditionnement;Fournisseur;Source;Notes;Référence interne\r\n', 'modele-catalogue.csv', 'text/csv;charset=utf-8')}><Download size={16}/>Télécharger le modèle catalogue</button></section>
      <section className="catalog-template"><FileSpreadsheet size={25}/><div><h3>Données de ventes</h3><p className="settings-description">Ajoutez le chiffre d’affaires à la désignation, la marque et le segment pour répartir le plan selon les ventes. Vous pouvez choisir les ventes en unités dans l’assistant.</p></div><button className="button" onClick={() => download('\ufeffRéférence;Désignation;Marque;Segment;Sous-segment;Chiffre d’affaires;Quantité;Référence interne\r\n', 'modele-ventes.csv', 'text/csv;charset=utf-8')}><Download size={16}/>Télécharger le modèle ventes</button></section>
      <p className="settings-description">Les modèles contiennent uniquement les en-têtes. Renseignez vos produits dans un tableur et enregistrez le fichier en CSV. La colonne « Référence interne » accepte Oui ou Non ; laissez-la vide si l’appartenance est inconnue.</p>
    </div>
    <div className="modal-footer"><button className="button" onClick={onClose}>Fermer</button></div>
  </Modal>;
}
