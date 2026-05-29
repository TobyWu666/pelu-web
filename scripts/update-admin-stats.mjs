import { mkdir, writeFile } from 'node:fs/promises';

const JSON_OUT_PATH = new URL('../data/admin-stats.json', import.meta.url);
const JS_OUT_PATH = new URL('../data/admin-stats.js', import.meta.url);
const RELEASE_REPO = process.env.RELEASE_REPO || 'TobyWu666/pelu-releases';
const ASSET_NAME = process.env.RELEASE_ASSET_NAME || 'PeluMac.dmg';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

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

function readManualWebStats() {
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
      note: 'GitHub Pages has no private page-view counter. Set repo variables WEB_VIEWS_TOTAL / WEB_UNIQUE_VISITORS only after connecting a privacy-friendly analytics source.'
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

const stats = {
  generatedAt: new Date().toISOString(),
  downloads: await fetchReleaseDownloads(),
  web: readManualWebStats()
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(JSON_OUT_PATH, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
await writeFile(JS_OUT_PATH, `window.PELU_ADMIN_STATS = ${JSON.stringify(stats, null, 2)};\n`, 'utf8');
console.log(`Wrote ${JSON_OUT_PATH.pathname}`);
console.log(`Wrote ${JS_OUT_PATH.pathname}`);
console.log(`DMG total downloads: ${stats.downloads.total}`);
