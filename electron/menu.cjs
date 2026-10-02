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
      item('open', 'Ouvrir un projet…', 'CommandOrControl+O'),
      item('library', 'Mes plans…'),
      { type: 'separator' },
      item('save', 'Enregistrer', 'CommandOrControl+S'),
      item('export-project', 'Exporter le projet .plano…', 'CommandOrControl+Shift+S'),
      { id: 'exports', label: 'Exporter', submenu: [
        item('export-pdf', 'Document PDF…', 'CommandOrControl+P'),
        item('export-image', 'Image PNG…'),
        item('export-csv', 'Données CSV…'),
      ] },
      { type: 'separator' },
      item('settings', 'Paramètres…', 'CommandOrControl+,'),
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
      { ...item('toggle-panel', 'Panneau de droite', 'CommandOrControl+Shift+A'), type: 'checkbox', checked: false },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran', accelerator: 'F11' },
    ] },
    { label: 'Outils', submenu: [
      item('import-sales', 'Importer des ventes…'), item('import-catalog', 'Importer un catalogue…'),
      { type: 'separator' },
      item('create-group', 'Créer un regroupement…'), item('compose-block', 'Composer un bloc…'),
    ] },
    { label: 'Aide', submenu: [item('help', 'Aide et tutoriel…'), item('shortcuts', 'Raccourcis clavier…')] },
  ]);
  Menu.setApplicationMenu(menu);
  function update(next) {
    if (!next || typeof next !== 'object') return;
    state = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === 'boolean'));
    const available = !state.dialogOpen, editable = available && !state.editingText;
    const enable = (id, value) => { menu.getMenuItemById(id).enabled = Boolean(value); };
    for (const id of ['new', 'open', 'library', 'save', 'export-project', 'settings', 'import-sales', 'import-catalog', 'help', 'shortcuts', 'toggle-panel']) enable(id, available);
    enable('undo', state.editingText || (available && state.canUndo));
    enable('redo', state.editingText || (available && state.canRedo));
    enable('edit-selection', editable && state.canEdit);
    for (const id of ['duplicate', 'delete']) enable(id, editable && state.canMutate);
    enable('exports', available && state.hasData);
    enable('export-pdf', available && state.hasData && !state.exporting);
    enable('export-image', available && state.hasData && !state.exportingImage);
    enable('export-csv', available && state.hasData);
    enable('create-group', available && state.hasData);
    enable('compose-block', available && state.canCompose);
    menu.getMenuItemById('toggle-panel').checked = Boolean(state.showRightPanel);
  }
  update({ dialogOpen: true });
  return update;
}
module.exports = { createAppMenu };
