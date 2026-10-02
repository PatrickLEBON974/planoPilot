const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('plano', {
  saveProject: project => ipcRenderer.invoke('project:save', project),
  listProjects: () => ipcRenderer.invoke('project:list'),
  loadProject: id => ipcRenderer.invoke('project:load', id),
  deleteProject: id => ipcRenderer.invoke('project:delete', id),
  openProject: () => ipcRenderer.invoke('project:open'),
  initialProject: () => ipcRenderer.invoke('project:initial'),
  exportProject: project => ipcRenderer.invoke('project:export', project),
  exportPDF: payload => ipcRenderer.invoke('export:pdf', payload),
  exportImage: payload => ipcRenderer.invoke('export:image', payload),
  onCloseRequest: callback => { const listener = () => callback(); ipcRenderer.on('app:closing', listener); return () => ipcRenderer.removeListener('app:closing', listener); },
  onProjectRequested: callback => { const listener = (_, project) => callback(project); ipcRenderer.on('project:requested', listener); return () => ipcRenderer.removeListener('project:requested', listener); },
  onMenuAction: callback => { const listener = (_, action) => callback(action); ipcRenderer.on('menu:action', listener); return () => ipcRenderer.removeListener('menu:action', listener); },
  updateMenuState: state => ipcRenderer.invoke('menu:update', state),
  finishClose: () => ipcRenderer.send('app:close-ready'),
});
