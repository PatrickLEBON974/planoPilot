const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createRecentPlans } = require('./recent-plans.cjs');

function projectJSON(project) {
  if (!project || project.schemaVersion !== 1 || typeof project.name !== 'string' || !Array.isArray(project.products) || typeof project.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(project.id)) throw new Error('Plan invalide.');
  const json = JSON.stringify(project, null, 2);
  if (Buffer.byteLength(json) > 100 * 1024 * 1024) throw new Error('Le plan dépasse la taille maximale.');
  return json;
}
async function atomicWrite(file, content) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try { await fs.writeFile(temp, content, 'utf8'); await fs.rename(temp, file); }
  finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

function createPlanFiles({ chooseSavePath, recentPath }) {
  let currentPath = null, writeQueue = Promise.resolve();
  const selectedPaths = new Set();
  const recent = createRecentPlans(recentPath);
  return {
    get currentPath() { return currentPath; },
    async read(file) {
      const filePath = path.resolve(file), stat = await fs.stat(filePath);
      if (stat.size > 100 * 1024 * 1024) throw new Error('Fichier trop volumineux.');
      const project = JSON.parse(await fs.readFile(filePath, 'utf8'));
      selectedPaths.add(filePath);
      return { project, filePath };
    },
    async activate(filePath) {
      if (filePath !== null && !selectedPaths.has(filePath)) throw new Error('Ouvrez le fichier avant de l’enregistrer.');
      currentPath = filePath;
      if (filePath) await recent.touch(filePath);
    },
    async listRecent() {
      return Promise.all((await recent.list()).map(async row => {
        const available = await fs.stat(row.filePath).then(stat => stat.isFile()).catch(() => false);
        return { ...row, name: path.basename(row.filePath), available };
      }));
    },
    async openRecent(filePath) {
      const rows = await recent.list();
      if (!rows.some(row => row.filePath === filePath)) throw new Error('Ce fichier ne figure pas dans les plans récents.');
      return this.read(filePath);
    },
    removeRecent(filePath) { return recent.remove(filePath); },
    save(project, saveAs = false) {
      projectJSON(project);
      const next = writeQueue.catch(() => {}).then(async () => {
        const target = saveAs || !currentPath ? await chooseSavePath(currentPath || 'Sans titre.plano') : currentPath;
        if (!target) return null;
        const filePath = path.resolve(target);
        await atomicWrite(filePath, projectJSON({ ...project, name: path.basename(filePath).replace(/\.plano$/i, '') }));
        selectedPaths.add(filePath);
        currentPath = filePath;
        await recent.touch(filePath);
        return filePath;
      });
      writeQueue = next;
      return next;
    },
  };
}
module.exports = { createPlanFiles };
