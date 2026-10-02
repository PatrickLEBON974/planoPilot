const { Menu } = require('electron');

function createAppMenu(getWindow) {
  let state = {};
  const action = name => () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    if (state.editingText && (name === 'undo' || name === 'redo')) window.webContents[name]();
    else window.webContents.send('menu:action', name);
  };
  const item = (id, label, accelerator) => ({ id, label, ...(accelerator ? { accelerator } : {}), click: action(id) });
  const menu = Menu.buildFromTemplate([
    { label: 'Fichier', submenu: [
      item('new', 'Nouveau plan', 'CommandOrControl+N'),
      item('open', 'Ouvrir un plan (.plano)…', 'CommandOrControl+O'),
      item('recent', 'Plans récents…'),
      item('import-sales', 'Données de ventes…'),
      item('import-catalog', 'Catalogue de produits…'),
      { type: 'separator' },
      item('save', 'Enregistrer', 'CommandOrControl+S'),
      item('save-as', 'Enregistrer sous…', 'CommandOrControl+Shift+S'),
      { id: 'exports', label: 'Exporter', submenu: [
        item('export-pdf', 'Document PDF…', 'CommandOrControl+P'),
        item('export-image', 'Image PNG…'),
        item('export-csv', 'Données CSV…'),
      ] },
      { type: 'separator' },
      item('preferences', 'Paramètres…', 'CommandOrControl+,'),
      { type: 'separator' },
      { label: 'Quitter', accelerator: 'CommandOrControl+Q', click: () => getWindow()?.close() },
    ] },
    { label: 'Édition', submenu: [
      item('undo', 'Annuler', 'CommandOrControl+Z'),
      item('redo', 'Rétablir', 'CommandOrControl+Y'),
      { type: 'separator' },
      { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' },
      { type: 'separator' },
      item('edit-selection', 'Modifier la sélection…', 'CommandOrControl+E'),
      item('duplicate', 'Dupliquer la sélection', 'CommandOrControl+D'),
      item('delete', 'Supprimer la sélection', 'Delete'),
    ] },
    { label: 'Affichage', submenu: [
      { ...item('toggle-panel', 'Assortiment (panneau de droite)', 'CommandOrControl+Shift+A'), type: 'checkbox', checked: false },
      { ...item('toggle-grid', 'Afficher la grille des unités'), type: 'checkbox', checked: true },
      { type: 'separator' },
      item('zoom-in', 'Agrandir le plan', 'CommandOrControl+Plus'),
      item('zoom-out', 'Réduire le plan', 'CommandOrControl+-'),
      item('zoom-reset', 'Ajuster le plan à l’écran', 'CommandOrControl+0'),
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran', accelerator: 'F11' },
    ] },
    { label: 'Outils', submenu: [
      item('generate', 'Régénérer le plan…'),
      item('create-group', 'Créer un regroupement…'), item('compose-block', 'Composer un bloc…'),
      { type: 'separator' },
      item('catalog-resources', 'Modèles d’import CSV…'),
      item('off-search', 'Rechercher sur Open Food Facts…'),
    ] },
    { label: 'Aide', submenu: [
      item('help', 'Aide…'), item('tutorial', 'Revoir le tutoriel…'), item('shortcuts', 'Raccourcis clavier…'),
      { type: 'separator' },
      item('demo', 'Explorer un exemple…'),
    ] },
  ]);
  Menu.setApplicationMenu(menu);
  function update(next) {
    if (!next || typeof next !== 'object') return;
    state = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === 'boolean'));
    const available = !state.dialogOpen, editable = available && !state.editingText;
    const enable = (id, value) => { menu.getMenuItemById(id).enabled = Boolean(value); };
    for (const id of ['new', 'open', 'recent', 'save', 'save-as', 'exports', 'preferences', 'import-sales', 'import-catalog', 'catalog-resources', 'off-search', 'help', 'tutorial', 'shortcuts', 'demo', 'toggle-panel']) enable(id, available);
    for (const id of ['save', 'save-as', 'exports', 'toggle-panel']) enable(id, available && state.hasDocument);
    enable('undo', state.editingText || (available && state.canUndo));
    enable('redo', state.editingText || (available && state.canRedo));
    enable('edit-selection', editable && state.canEdit);
    for (const id of ['duplicate', 'delete']) enable(id, editable && state.canMutate);
    enable('export-pdf', available && state.hasData && !state.exporting);
    enable('export-image', available && state.hasData && !state.exportingImage);
    enable('export-csv', available && state.hasData);
    enable('create-group', available && state.hasData);
    enable('compose-block', available && state.canCompose);
    enable('generate', available && state.hasData && state.canGenerate);
    enable('toggle-grid', available && state.hasData);
    enable('zoom-in', available && state.hasData && state.canZoomIn);
    enable('zoom-out', available && state.hasData && state.canZoomOut);
    enable('zoom-reset', available && state.hasData);
    menu.getMenuItemById('toggle-panel').checked = Boolean(state.hasDocument && state.showRightPanel);
    menu.getMenuItemById('toggle-grid').checked = Boolean(state.showGrid);
  }
  update({ dialogOpen: true, showGrid: true });
  return update;
}
module.exports = { createAppMenu };
