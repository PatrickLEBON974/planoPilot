const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const key = file => process.platform === 'win32' ? file.toLowerCase() : file;

function createRecentPlans(historyFile, limit = 20) {
  let loaded, queue = Promise.resolve();
  const entries = () => loaded ||= (async () => {
    if (!historyFile) return [];
    try {
      const rows = JSON.parse(await fs.readFile(historyFile, 'utf8'));
      if (!Array.isArray(rows)) return [];
      const seen = new Set();
      return rows.filter(row => {
        if (!row || typeof row.filePath !== 'string' || !path.isAbsolute(row.filePath) || typeof row.lastUsed !== 'string' || !Number.isFinite(Date.parse(row.lastUsed)) || seen.has(key(row.filePath))) return false;
        seen.add(key(row.filePath)); return true;
      }).slice(0, limit).map(({ filePath, lastUsed }) => ({ filePath, lastUsed }));
    } catch { return []; }
  })();
  const persist = async rows => {
    if (!historyFile) return;
    await fs.mkdir(path.dirname(historyFile), { recursive: true });
    const temp = `${historyFile}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temp, JSON.stringify(rows, null, 2), 'utf8'); await fs.rename(temp, historyFile); }
    finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  };
  const change = task => { const next = queue.catch(() => {}).then(task); queue = next; return next; };
  return {
    async list() { await queue.catch(() => {}); return (await entries()).map(row => ({ ...row })); },
    touch(filePath) { return change(async () => {
      const rows = [{ filePath, lastUsed: new Date().toISOString() }, ...(await entries()).filter(row => key(row.filePath) !== key(filePath))].slice(0, limit);
      loaded = Promise.resolve(rows);
      // A history error must not turn a successful plan save into a failed save.
      await persist(rows).catch(() => {});
    }); },
    remove(filePath) { return change(async () => {
      const rows = (await entries()).filter(row => key(row.filePath) !== key(filePath));
      await persist(rows); loaded = Promise.resolve(rows);
    }); },
  };
}
module.exports = { createRecentPlans };
