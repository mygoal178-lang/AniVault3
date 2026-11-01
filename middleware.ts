import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Edge Middleware – SEO fix for AniVault SPA
 *
 * When a search-engine bot requests an anime page, we return a complete HTML
 * document with unique <title>, meta description, canonical and the synopsis.
 * Normal users still get the normal SPA experience.
 */

const BOT_UA =
  /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|whatsapp|telegrambot|duckduckbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider/i;

function isBot(ua: string | null): boolean {
  if (!ua) return false;
  return BOT_UA.test(ua);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAnimeHtml(opts: {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  synopsis?: string;
  score?: number | string;
  genres?: string[];
}) {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description.slice(0, 160));
  const canonical = escapeHtml(opts.canonical);
  const image = opts.image ? escapeHtml(opts.image) : 'https://www.anivault.online/landing/zoro-hero.webp';
  const synopsis = opts.synopsis ? escapeHtml(opts.synopsis) : description;
  const genres = (opts.genres || []).map(escapeHtml).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Watch Online | AniVault</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:type" content="video.tv_show" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${title} - Watch Online | AniVault" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:site_name" content="AniVault" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} - Watch Online | AniVault" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "name": "${title}",
    "description": "${description}",
    "url": "${canonical}",
    "image": "${image}"
  }
  </script>

  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background:#07070c; color:#e2e8f0; margin:0; padding:2rem; line-height:1.6; }
    a { color:#f59e0b; }
    h1 { color:#fff; margin-bottom:0.5rem; }
    .meta { color:#94a3b8; font-size:0.9rem; margin-bottom:1.5rem; }
    .synopsis { max-width:720px; }
    .cta { display:inline-block; margin-top:2rem; padding:0.75rem 1.5rem; background:#e11d48; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; }
  </style>
</head>
<body>
  <header>
    <a href="https://www.anivault.online/">AniVault</a>
  </header>
  <main>
    <h1>${title}</h1>
    <div class="meta">
      ${opts.score ? `Score: ${opts.score} · ` : ''}${genres ? genres : ''}
    </div>
    <div class="synopsis">
      <p>${synopsis}</p>
    </div>
    <a class="cta" href="${canonical}">Watch on AniVault →</a>
  </main>
</body>
</html>`;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and API routes
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets|.*\\..*).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  const { pathname } = req.nextUrl;

  // Only special-case bots on anime detail pages
  if (!isBot(ua) || !pathname.startsWith('/anime/')) {
    return NextResponse.next();
  }

  // Extract MAL ID from URL like /anime/one-piece-21 or /anime/attack-on-titan-16498
  const match = pathname.match(/-(\d+)$/);
  if (!match) {
    return NextResponse.next();
  }

  const malId = match[1];

  try {
    // Call our own API (same origin) to get metadata
    const apiUrl = new URL(`/api/anilist/anime/${malId}`, req.url);
    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.next();
    }

    const data = await res.json();

    const title =
      data.title_english ||
      data.title ||
      data.title_romaji ||
      data.name ||
      `Anime ${malId}`;

    const synopsis = (data.synopsis || data.description || '').replace(/\n+/g, ' ').trim();
    const description =
      synopsis.slice(0, 155) +
      (synopsis.length > 155 ? '…' : '') ||
      `Watch ${title} online in HD on AniVault.`;

    const image =
      data.coverImage?.extraLarge ||
      data.coverImage?.large ||
      data.image ||
      data.images?.jpg?.large_image_url ||
      undefined;

    const genres = Array.isArray(data.genres)
      ? data.genres.map((g: any) => (typeof g === 'string' ? g : g.name)).filter(Boolean)
      : [];

    const score = data.averageScore || data.score || data.mean || undefined;

    const html = buildAnimeHtml({
      title,
      description,
      canonical: `https://www.anivault.online${pathname}`,
      image,
      synopsis,
      score,
      genres,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-AniVault-SEO': 'bot-html',
      },
    });
  } catch (err) {
    // On any error fall back to normal SPA
    console.error('SEO middleware error:', err);
    return NextResponse.next();
  }
}
