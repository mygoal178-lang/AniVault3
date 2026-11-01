/**
 * Build-time prerender for AniVault
 * Generates real HTML for important routes so Google can index them properly.
 */
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync, statSync } from 'fs';
import { lookup } from 'mime-types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '../dist');
const PORT = 4173;

// Static routes that should always be prerendered
const STATIC_ROUTES = [
  '/',
  '/home',
  '/search',
  '/genres',
  '/updated',
  '/updates',
];

// Limit how many anime detail pages we prerender (keeps build time reasonable)
const MAX_ANIME_PAGES = 120;

async function getAnimeRoutes() {
  try {
    const res = await fetch('https://www.anivault.online/sitemap.xml', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Sitemap status ${res.status}`);
    const xml = await res.text();
    const matches = [...xml.matchAll(/<loc>https:\/\/www\.anivault\.online(\/anime\/[^<]+)<\/loc>/g)];
    return matches.map((m) => m[1]).slice(0, MAX_ANIME_PAGES);
  } catch (err) {
    console.warn('⚠️  Could not load sitemap, skipping anime pages:', err.message);
    return [];
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';

        // Prefer exact file, then folder/index.html, then SPA fallback
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
      } catch (e) {
        res.writeHead(500);
        res.end('Server error');
      }
    });

    server.listen(PORT, () => resolve(server));
  });
}

async function prerender() {
  console.log('🚀 AniVault prerender starting...');

  if (!existsSync(DIST)) {
    console.error('❌ dist/ folder not found. Run vite build first.');
    process.exit(1);
  }

  const server = await startStaticServer();
  console.log(`Local server → http://localhost:${PORT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  );

  const animeRoutes = await getAnimeRoutes();
  const allRoutes = [...STATIC_ROUTES, ...animeRoutes];

  console.log(`Prerendering ${allRoutes.length} pages (${STATIC_ROUTES.length} static + ${animeRoutes.length} anime)...`);

  let success = 0;
  let failed = 0;

  for (const route of allRoutes) {
    const url = `http://localhost:${PORT}${route}`;
    try {
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 45000,
      });

      // Give React a moment to finish rendering meta + content
      await page.waitForFunction(
        () => document.title && document.title !== 'AniVault - Watch Anime Online' || document.querySelector('h1'),
        { timeout: 12000 }
      ).catch(() => {});

      // Small extra wait for dynamic content
      await new Promise((r) => setTimeout(r, 800));

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
      console.error(`  ✗ ${route} → ${err.message}`);
      failed++;
    }
  }

  await browser.close();
  server.close();

  console.log(`\n✅ Prerender finished: ${success} ok, ${failed} failed`);
  if (success === 0) {
    console.error('No pages were prerendered successfully.');
    process.exit(1);
  }
}

prerender().catch((err) => {
  console.error('Prerender crashed:', err);
  process.exit(1);
});
