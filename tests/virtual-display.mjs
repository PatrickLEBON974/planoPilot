import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function startVirtualDisplay() {
  if (process.platform !== 'linux') return { env: { PLANOPILOT_TEST_HEADLESS: '1' }, visible: false, close: async () => {} };
  const candidates = [process.env.PLANOPILOT_XVFB_BIN, ...(process.env.PATH || '').split(path.delimiter).map(directory => path.join(directory, 'Xvfb')), path.join(os.homedir(), '.cache/planopilot-tests/xvfb/usr/bin/Xvfb')].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await fs.access(candidate, fs.constants.X_OK); executable = candidate; break; } catch {} }
  if (!executable) throw new Error('Les tests de bureau nécessitent Xvfb : installez xvfb ou renseignez PLANOPILOT_XVFB_BIN. Aucun test ne sera lancé sur votre écran.');
  const server = spawn(executable, ['-displayfd', '3', '-screen', '0', '1920x1080x24', '-nolisten', 'tcp', '-ac', '-noreset'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe'] });
  let errors = '';
  server.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000); });
  const stop = () => { if (server.exitCode === null) server.kill('SIGTERM'); };
  let display;
  try {
    display = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => finish(new Error('L’écran virtuel ne répond pas.')), 10000);
      const finish = (error, value) => { clearTimeout(timer); server.off('error', failed); server.off('exit', exited); server.stdio[3].off('data', data); error ? reject(error) : resolve(value); };
      const failed = error => finish(error);
      const exited = code => finish(new Error(`Xvfb s’est arrêté (${code}) : ${errors}`));
      const data = chunk => { output += chunk; if (/^\d+\n$/.test(output)) finish(null, `:${output.trim()}`); };
      server.once('error', failed); server.once('exit', exited); server.stdio[3].on('data', data);
    });
  } catch (error) { stop(); throw error; }
  process.once('exit', stop);
  const interrupted = () => { stop(); process.exit(130); };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  return {
    env: { DISPLAY: display, PLANOPILOT_TEST_HEADLESS: '0' }, visible: true,
    async close() {
      process.off('exit', stop); process.off('SIGINT', interrupted); process.off('SIGTERM', interrupted);
      if (server.exitCode !== null || server.signalCode !== null) return;
      await new Promise(resolve => {
        const timer = setTimeout(() => server.kill('SIGKILL'), 3000);
        server.once('exit', () => { clearTimeout(timer); resolve(); }); stop();
      });
    },
  };
}
