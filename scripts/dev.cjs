const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const port = 5173;
const vite = spawn(process.execPath, [path.join(__dirname, '../node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
let desktop, attempts = 0;
function stop() { desktop?.kill(); vite.kill(); }
function waitForServer() {
  if (++attempts > 100) { stop(); process.exitCode = 1; return; }
  const request = http.get(`http://127.0.0.1:${port}`, response => { response.resume(); if (response.statusCode !== 200) return setTimeout(waitForServer, 200); desktop = spawn(require('electron'), ['.'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PLANOPILOT_DEV_URL: `http://127.0.0.1:${port}` }, stdio: 'inherit' }); desktop.on('exit', () => { vite.kill(); }); });
  request.on('error', () => setTimeout(waitForServer, 200));
}
vite.on('exit', code => { desktop?.kill(); if (code) process.exitCode = code; });
process.on('SIGINT', stop); process.on('SIGTERM', stop); waitForServer();
