/**
 * PRINT AGENT — run this on ONE computer at the counter (same network as the printer).
 *
 *   cd print-agent && npm install && cp .env.example .env   (edit .env)
 *   npm start
 *
 * What it does:
 *   1. Listens to Firestore `printJobs` where status == "pending", oldest first.
 *   2. Prints them ONE AT A TIME (a serialized queue) so KOTs and receipts never mix.
 *   3. Status: pending -> printing -> printed
 *                                  -> failed     (could not connect: nothing printed, auto-retried AUTO_RETRY_LIMIT times)
 *                                  -> uncertain  (connection broke while sending: a person must check the paper)
 *   4. Every 15 s writes a heartbeat to `agents/<AGENT_NAME>` so the web app can show printer status.
 *
 * It NEVER retries an "uncertain" job by itself — that could print a KOT twice and the kitchen
 * would cook the food twice. Staff decide on the Printer page.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import admin from 'firebase-admin';
import { encodePages } from './escpos.js';

const VERSION = '1.0.0';
const cfg = {
  host: process.env.PRINTER_HOST,
  port: Number(process.env.PRINTER_PORT || 9100),
  timeoutMs: Number(process.env.PRINTER_TIMEOUT_MS || 8000),
  name: process.env.AGENT_NAME || 'POS-AGENT-01',
  keyPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json',
  retryLimit: Number(process.env.AUTO_RETRY_LIMIT || 3),
};

const log = (level, msg, extra) =>
  console[level === 'error' ? 'error' : 'log'](`${new Date().toISOString()} [agent][${level}] ${msg}`, extra ?? '');

if (!cfg.host) {
  log('error', 'PRINTER_HOST is missing in .env');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(cfg.keyPath, 'utf8'));
} catch (err) {
  log('error', `Cannot read service account key at ${cfg.keyPath}`, err.message);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const jobsCol = db.collection('printJobs');

// ------------------------------------------------------------------ printer I/O
/**
 * Sends bytes over raw TCP (port 9100).
 * Resolves { ok: true } or { ok: false, connected: boolean, error: string }.
 * `connected` tells us whether ANY data may have reached the printer.
 */
function sendToPrinter(buffer) {
  return new Promise((resolve) => {
    let connected = false;
    let finished = false;
    let written = false;
    const done = (result) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(result);
    };
    const socket = net.createConnection({ host: cfg.host, port: cfg.port });
    socket.setTimeout(cfg.timeoutMs);
    socket.on('connect', () => {
      connected = true;
      socket.write(buffer, (err) => {
        if (err) return done({ ok: false, connected, error: err.message });
        written = true;
        socket.end();
      });
    });
    socket.on('close', () => (written ? done({ ok: true }) : done({ ok: false, connected, error: 'connection closed early' })));
    socket.on('timeout', () => done({ ok: false, connected, error: `timeout after ${cfg.timeoutMs} ms` }));
    socket.on('error', (err) => done({ ok: false, connected, error: err.message }));
  });
}

function isPrinterReachable() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: cfg.host, port: cfg.port });
    const end = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(3000);
    socket.on('connect', () => end(true));
    socket.on('timeout', () => end(false));
    socket.on('error', () => end(false));
  });
}

// ------------------------------------------------------------------ queue
const queue = [];
const queued = new Set();
let working = false;

async function claim(ref) {
  // Transaction makes sure two agents (or a restart) never print the same job twice
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== 'pending') return null;
    tx.update(ref, { status: 'printing', attempts: (snap.data().attempts || 0) + 1, agent: cfg.name, updatedAt: Date.now() });
    return snap.data();
  });
}

async function processJob(id) {
  const ref = jobsCol.doc(id);
  const job = await claim(ref);
  if (!job) return;
  const label = `${job.type} ${job.ref} (${job.pages?.length ?? 0} page)`;
  log('info', `printing ${label}`);

  const result = await sendToPrinter(encodePages(job.pages || []));
  if (result.ok) {
    await ref.update({ status: 'printed', error: null, updatedAt: Date.now() });
    log('info', `printed ${label}`);
    return;
  }
  if (result.connected) {
    // Data may have reached the printer. Do NOT retry automatically.
    await ref.update({ status: 'uncertain', error: result.error, updatedAt: Date.now() });
    log('error', `UNCERTAIN ${label}: ${result.error} — staff must check the printer`);
    return;
  }
  const attempts = (job.attempts || 0) + 1;
  if (attempts < cfg.retryLimit) {
    log('error', `could not connect for ${label} (${result.error}); retry ${attempts}/${cfg.retryLimit} in 5 s`);
    await new Promise((r) => setTimeout(r, 5000));
    await ref.update({ status: 'pending', error: result.error, updatedAt: Date.now() });
  } else {
    await ref.update({ status: 'failed', error: result.error, updatedAt: Date.now() });
    log('error', `FAILED ${label}: ${result.error}`);
  }
}

async function drain() {
  if (working) return;
  working = true;
  while (queue.length) {
    const id = queue.shift();
    // Remove from the set BEFORE printing so an auto-retry (status back to pending) is picked up again.
    // Double printing is impossible: claim() only takes jobs that are still "pending".
    queued.delete(id);
    try {
      await processJob(id);
    } catch (err) {
      log('error', `job ${id} crashed`, err);
    }
  }
  working = false;
}

// ------------------------------------------------------------------ start-up
async function markInterruptedJobs() {
  // A job still "printing" means the agent stopped in the middle — we cannot know if it printed.
  const stuck = await jobsCol.where('status', '==', 'printing').get();
  for (const doc of stuck.docs) {
    await doc.ref.update({ status: 'uncertain', error: 'agent restarted while printing', updatedAt: Date.now() });
    log('error', `job ${doc.id} was interrupted -> uncertain`);
  }
}

async function heartbeat() {
  const printerOnline = await isPrinterReachable();
  await db
    .collection('agents')
    .doc(cfg.name)
    .set({ name: cfg.name, version: VERSION, lastSeen: Date.now(), printerOnline, printerHost: `${cfg.host}:${cfg.port}` });
}

async function main() {
  log('info', `agent ${cfg.name} v${VERSION} · project ${serviceAccount.project_id} · printer ${cfg.host}:${cfg.port}`);

  if (process.argv.includes('--test')) {
    const r = await sendToPrinter(
      encodePages([{ lines: [{ text: 'PRINT AGENT TEST', align: 'center', bold: true, big: true }, { text: new Date().toString(), align: 'center' }] }]),
    );
    log(r.ok ? 'info' : 'error', r.ok ? 'test page sent' : `test failed: ${r.error}`);
    process.exit(r.ok ? 0 : 1);
  }

  await markInterruptedJobs();
  await heartbeat().catch((err) => log('error', 'heartbeat failed', err.message));
  setInterval(() => heartbeat().catch((err) => log('error', 'heartbeat failed', err.message)), 15_000);

  jobsCol
    .where('status', '==', 'pending')
    .orderBy('createdAt')
    .onSnapshot(
      (snap) => {
        for (const doc of snap.docs) {
          if (!queued.has(doc.id)) {
            queued.add(doc.id);
            queue.push(doc.id);
          }
        }
        drain();
      },
      (err) => {
        log('error', 'listening to printJobs failed (missing index? see docs/TROUBLESHOOTING.md)', err.message);
        process.exit(1); // let the process manager restart us
      },
    );
  log('info', 'waiting for print jobs…');
}

main().catch((err) => {
  log('error', 'fatal', err);
  process.exit(1);
});
