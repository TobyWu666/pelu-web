import { mkdir, readFile, writeFile } from 'node:fs/promises';

const JSON_OUT_PATH = new URL('../data/admin-stats.json', import.meta.url);
const JS_OUT_PATH = new URL('../data/admin-stats.js', import.meta.url);
const HISTORY_JSON_OUT_PATH = new URL('../data/admin-stats-history.json', import.meta.url);
const HISTORY_JS_OUT_PATH = new URL('../data/admin-stats-history.js', import.meta.url);
const RELEASE_REPO = process.env.RELEASE_REPO || 'TobyWu666/pelu-releases';
const ASSET_NAME = process.env.RELEASE_ASSET_NAME || 'PeluMac.dmg';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const HISTORY_LIMIT = 240;

function numberFromEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function githubJson(path) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pelu-web-admin-stats',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

async function fetchReleaseDownloads() {
  const releases = [];

  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubJson(`/repos/${RELEASE_REPO}/releases?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    releases.push(...batch);
    if (batch.length < 100) break;
  }

  const rows = releases.flatMap((release) => {
    const assets = Array.isArray(release.assets) ? release.assets : [];
    return assets
      .filter((asset) => asset.name === ASSET_NAME)
      .map((asset) => ({
        tagName: release.tag_name,
        releaseName: release.name || release.tag_name,
        publishedAt: release.published_at,
        assetName: asset.name,
        downloadCount: asset.download_count ?? 0,
        browserDownloadUrl: asset.browser_download_url
      }));
  });

  rows.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  return {
    repository: RELEASE_REPO,
    assetName: ASSET_NAME,
    total: rows.reduce((sum, row) => sum + row.downloadCount, 0),
    latest: rows[0] || null,
    releases: rows,
    status: rows.length ? 'ok' : 'asset_not_found'
  };
}

async function fetchWorkerWebStats() {
  const endpoint = process.env.WEB_STATS_ENDPOINT;
  const token = process.env.WEB_STATS_TOKEN;
  const rangeDays = numberFromEnv('WEB_VIEWS_RANGE_DAYS') || 30;

  if (!endpoint || !token) return null;

  const url = new URL(endpoint);
  url.searchParams.set('days', String(rangeDays));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Web stats ${response.status} from ${url.href}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  return {
    status: 'worker',
    provider: data.provider || 'pelu-worker',
    rangeDays: data.rangeDays || rangeDays,
    totalViews: Number.isFinite(Number(data.totalViews)) ? Number(data.totalViews) : null,
    uniqueVisitors: Number.isFinite(Number(data.uniqueVisitors)) ? Number(data.uniqueVisitors) : null,
    daily: Array.isArray(data.daily) ? data.daily : [],
    paths: Array.isArray(data.paths) ? data.paths : [],
    note: 'Pelu 自家的 Cloudflare Worker 匿名瀏覽統計;只保存日期、路徑與加總次數。'
  };
}

async function readWebStats() {
  const workerStats = await fetchWorkerWebStats();
  if (workerStats) return workerStats;

  const totalViews = numberFromEnv('WEB_VIEWS_TOTAL');
  const uniqueVisitors = numberFromEnv('WEB_UNIQUE_VISITORS');
  const rangeDays = numberFromEnv('WEB_VIEWS_RANGE_DAYS');
  const provider = process.env.WEB_ANALYTICS_PROVIDER || null;

  if (totalViews === null && uniqueVisitors === null) {
    return {
      status: 'not_configured',
      provider,
      rangeDays,
      totalViews: null,
      uniqueVisitors: null,
      note: '部署 Cloudflare Worker 後,設定 WEB_STATS_ENDPOINT / WEB_STATS_TOKEN 就會顯示匿名瀏覽量。'
    };
  }

  return {
    status: 'manual',
    provider: provider || 'manual',
    rangeDays,
    totalViews,
    uniqueVisitors,
    note: 'Values are supplied by repository variables during the scheduled stats workflow.'
  };
}

async function readExistingHistory() {
  try {
    const raw = await readFile(HISTORY_JSON_OUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function compactReleaseRows(releases) {
  return releases.slice(0, 12).map((release) => ({
    tagName: release.tagName,
    publishedAt: release.publishedAt,
    downloadCount: release.downloadCount
  }));
}

function appendHistorySnapshot(history, stats) {
  const snapshot = {
    generatedAt: stats.generatedAt,
    total: stats.downloads.total,
    latestTagName: stats.downloads.latest?.tagName || null,
    latestDownloadCount: stats.downloads.latest?.downloadCount ?? null,
    releaseCount: stats.downloads.releases.length,
    releases: compactReleaseRows(stats.downloads.releases)
  };

  const last = history.at(-1);
  const lastTime = last?.generatedAt ? new Date(last.generatedAt).getTime() : 0;
  const snapshotTime = new Date(snapshot.generatedAt).getTime();
  const sameNearbySnapshot = last
    && last.total === snapshot.total
    && last.latestTagName === snapshot.latestTagName
    && snapshotTime - lastTime < 30 * 60 * 1000;
  const nextHistory = sameNearbySnapshot
    ? [...history.slice(0, -1), snapshot]
    : [...history, snapshot];

  return nextHistory
    .filter((item) => item && item.generatedAt && Number.isFinite(Number(item.total)))
    .slice(-HISTORY_LIMIT);
}

const stats = {
  generatedAt: new Date().toISOString(),
  downloads: await fetchReleaseDownloads(),
  web: await readWebStats()
};

const history = appendHistorySnapshot(await readExistingHistory(), stats);
stats.downloads.history = history;

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(JSON_OUT_PATH, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
await writeFile(JS_OUT_PATH, `window.PELU_ADMIN_STATS = ${JSON.stringify(stats, null, 2)};\n`, 'utf8');
await writeFile(HISTORY_JSON_OUT_PATH, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
await writeFile(HISTORY_JS_OUT_PATH, `window.PELU_ADMIN_STATS_HISTORY = ${JSON.stringify(history, null, 2)};\n`, 'utf8');
console.log(`Wrote ${JSON_OUT_PATH.pathname}`);
console.log(`Wrote ${JS_OUT_PATH.pathname}`);
console.log(`Wrote ${HISTORY_JSON_OUT_PATH.pathname}`);
console.log(`Wrote ${HISTORY_JS_OUT_PATH.pathname}`);
console.log(`DMG total downloads: ${stats.downloads.total}`);
