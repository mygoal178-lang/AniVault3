/**
 * Build-time prerender for AniVault (Vercel-safe version)
 * Tries to prerender important pages. If it fails (common on Vercel), the build still succeeds.
 */
import { writeFileSync, mkdirSync, existsSync, createReadStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { lookup } from 'mime-types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '../dist');
const PORT = 4173;

const STATIC_ROUTES = ['/', '/home', '/search', '/genres', '/updated', '/updates'];
const MAX_ANIME_PAGES = 80;

async function getAnimeRoutes() {
  try {
    const res = await fetch('https://www.anivault.online/sitemap.xml', {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const xml = await res.text();
    const matches = [...xml.matchAll(/<loc>https:\/\/www\.anivault\.online(\/anime\/[^<]+)<\/loc>/g)];
    return matches.map((m) => m[1]).slice(0, MAX_ANIME_PAGES);
  } catch (err) {
    console.warn('Could not load sitemap:', err.message);
    return [];
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';

        const candidates = [
          join(DIST, urlPath),
          join(DIST, urlPath, 'index.html'),
          join(DIST, 'index.html'),
        ];

        let filePath = null;
        for (const p of candidates) {
          if (existsSync(p) && statSync(p).isFile()) {
            filePath = p;
            break;
          }
        }

        if (!filePath) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const mime = lookup(filePath) || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500);
        res.end('error');
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function prerender() {
  console.log('🚀 Trying prerender...');

  if (!existsSync(DIST)) {
    console.warn('dist/ not found – skipping prerender');
    return;
  }

  // Dynamically import puppeteer so the build doesn't crash if it's missing/broken
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (err) {
    console.warn('Puppeteer not available, skipping prerender:', err.message);
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
  } catch (err) {
    console.warn('Could not launch browser (common on Vercel). Skipping prerender.');
    console.warn(err.message);
    return;
  }

  const server = await startStaticServer();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const animeRoutes = await getAnimeRoutes();
  const allRoutes = [...STATIC_ROUTES, ...animeRoutes];

  console.log(`Prerendering ${allRoutes.length} pages...`);

  let success = 0;

  for (const route of allRoutes) {
    try {
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      await new Promise((r) => setTimeout(r, 600));

      const html = await page.content();

      let filePath;
      if (route === '/') {
        filePath = join(DIST, 'index.html');
      } else {
        const folder = join(DIST, route.replace(/^\//, ''));
        mkdirSync(folder, { recursive: true });
        filePath = join(folder, 'index.html');
      }

      writeFileSync(filePath, html, 'utf8');
      console.log(`  ✓ ${route}`);
      success++;
    } catch (err) {
      console.warn(`  ✗ ${route}: ${err.message}`);
    }
  }

  await browser.close();
  server.close();

  console.log(`✅ Prerender done: ${success} pages generated`);
}

prerender().catch((err) => {
  console.warn('Prerender failed (non-blocking):', err.message);
  // Do not exit with error – let the deployment succeed
});
