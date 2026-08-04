const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const TRIAL_DURATION_MS = 72 * 60 * 60 * 1000;

function trialFilePath() {
  return path.join(app.getPath('userData'), 'trial-access.json');
}

async function readTrialRecord() {
  try {
    return JSON.parse(await fs.readFile(trialFilePath(), 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return {};
    return {};
  }
}

async function writeTrialRecord(record) {
  await fs.mkdir(path.dirname(trialFilePath()), { recursive: true });
  await fs.writeFile(trialFilePath(), JSON.stringify(record, null, 2), 'utf8');
}

async function getTrialState() {
  const record = await readTrialRecord();
  if (!record.startedAt) return { status: 'not_started', startedAt: null, expiresAt: null, remainingMilliseconds: 0 };
  const systemNow = Date.now();
  const lastSeen = Number.isFinite(record.lastSeenAt) ? record.lastSeenAt : systemNow;
  const effectiveNow = Math.max(systemNow, lastSeen);
  const startedAtMs = new Date(record.startedAt).getTime();
  const expiresAtMs = startedAtMs + TRIAL_DURATION_MS;
  const remainingMilliseconds = Math.max(0, expiresAtMs - effectiveNow);
  if (effectiveNow > lastSeen) await writeTrialRecord({ ...record, lastSeenAt: effectiveNow });
  return {
    status: remainingMilliseconds > 0 ? 'trial' : 'expired',
    startedAt: record.startedAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingMilliseconds,
  };
}

async function startTrial() {
  const existing = await readTrialRecord();
  if (!existing.startedAt) {
    const now = Date.now();
    await writeTrialRecord({ startedAt: new Date(now).toISOString(), lastSeenAt: now });
  }
  return getTrialState();
}

const supported = (name) => /\.(txt|csv)$/i.test(name);

async function directoryExists(directoryPath) {
  try {
    return (await fs.stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
}

async function newestSupportedFileTimestamp(directoryPath, maxDepth = 5) {
  let newest = 0;
  async function visit(currentPath, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, depth + 1);
      } else if (entry.isFile() && supported(entry.name)) {
        try {
          const stat = await fs.stat(absolutePath);
          newest = Math.max(newest, stat.mtimeMs);
        } catch {
          // Ignore files that disappear during detection.
        }
      }
    }
  }
  await visit(directoryPath, 0);
  return newest;
}

async function findWinamaxFolder() {
  const documents = app.getPath('documents');
  const home = app.getPath('home');
  const roamingAppData = app.getPath('appData');
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const roots = [
    // Emplacement actuel utilisé par Winamax sous Windows.
    path.join(roamingAppData, 'winamax', 'documents', 'accounts'),
    path.join(roamingAppData, 'Winamax', 'documents', 'accounts'),
    // Variante possible dans AppData\Local.
    path.join(localAppData, 'winamax', 'documents', 'accounts'),
    path.join(localAppData, 'Winamax', 'documents', 'accounts'),
    // Anciens emplacements et installations personnalisées courantes.
    path.join(documents, 'Winamax Poker'),
    path.join(documents, 'Winamax'),
    path.join(documents, 'History'),
    path.join(home, 'OneDrive', 'Documents', 'Winamax Poker'),
    path.join(home, 'OneDrive', 'Documents', 'Winamax'),
    path.join(home, 'OneDrive', 'Documents', 'History'),
  ];

  const candidates = new Map();
  const addCandidate = async (directoryPath, score) => {
    if (!await directoryExists(directoryPath)) return;
    const newestFileAt = await newestSupportedFileTimestamp(directoryPath, 4);
    if (newestFileAt === 0) return;
    const previous = candidates.get(directoryPath);
    if (!previous || score > previous.score) {
      candidates.set(directoryPath, { directoryPath, score, newestFileAt });
    }
  };

  for (const root of roots) {
    if (!await directoryExists(root)) continue;
    const rootName = path.basename(root).toLowerCase();
    if (rootName === 'history') await addCandidate(root, 100);

    async function inspect(currentPath, depth) {
      if (depth > 5) return;
      let entries;
      try {
        entries = await fs.readdir(currentPath, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const absolutePath = path.join(currentPath, entry.name);
        const name = entry.name.toLowerCase();
        if (name === 'history') {
          const normalized = absolutePath.toLowerCase();
          const score = normalized.includes('winamax') ? 300 : normalized.includes('accounts') ? 250 : 150;
          await addCandidate(absolutePath, score);
        } else {
          await inspect(absolutePath, depth + 1);
        }
      }
    }
    await inspect(root, 0);
  }

  const best = [...candidates.values()].sort((a, b) => b.score - a.score || b.newestFileAt - a.newestFileAt)[0];
  if (!best) return null;
  return { directoryPath: best.directoryPath, directoryName: path.basename(best.directoryPath) };
}


async function readFolder(rootPath) {
  const files = [];
  async function visit(currentPath, prefix = '') {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(absolutePath, relativeName);
      else if (entry.isFile() && supported(entry.name)) {
        const stat = await fs.stat(absolutePath);
        const content = await fs.readFile(absolutePath, 'utf8');
        files.push({ relativeName, name: entry.name, size: stat.size, lastModified: stat.mtimeMs, content });
      }
    }
  }
  await visit(rootPath);
  return files;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#231518',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('winamax:select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choisir le dossier History de Winamax' });
  if (result.canceled || result.filePaths.length === 0) return null;
  const directoryPath = result.filePaths[0];
  return { directoryPath, directoryName: path.basename(directoryPath) };
});

ipcMain.handle('winamax:read-folder', async (_event, directoryPath) => readFolder(directoryPath));
ipcMain.handle('winamax:find-folder', async () => findWinamaxFolder());
ipcMain.handle('trial:get-state', async () => getTrialState());
ipcMain.handle('trial:start', async () => startTrial());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
