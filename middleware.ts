/**
 * Vercel Edge Middleware – Reliable SEO fix for AniVault SPA
 *
 * When Googlebot / Bing / other crawlers request important pages,
 * we return a complete HTML document with unique title, description
 * and canonical. Normal users continue to get the SPA.
 */

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|assets|.*\\..*).*)',
  ],
};

const BOT_UA =
  /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|whatsapp|telegrambot|duckduckbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider/i;

function isBot(ua: string | null): boolean {
  if (!ua) return false;
  return BOT_UA.test(ua);
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Static pages that need unique SEO treatment for bots */
const STATIC_PAGES: Record<
  string,
  { title: string; description: string; h1: string; body: string }
> = {
  '/': {
    title: 'AniVault - Watch Anime Online Free in HD',
    description:
      'Discover anime, explore new releases, and watch your favorite anime free in HD on AniVault. English subtitles and dub available.',
    h1: 'Watch Anime Online Free in HD',
    body: 'AniVault is your free anime streaming platform. Search thousands of titles, track your watchlist, and continue watching from one clean place. New episodes updated regularly.',
  },
  '/home': {
    title: 'Home - AniVault',
    description:
      'Browse trending anime, new releases, and continue watching on AniVault. Free HD streaming with subtitles and dub.',
    h1: 'Home',
    body: 'Discover trending anime, new releases, and pick up where you left off. AniVault brings thousands of titles together in one place.',
  },
  '/search': {
    title: 'Search Anime - AniVault',
    description:
      'Search thousands of anime titles on AniVault. Find series by name, genre, or character and start watching in HD.',
    h1: 'Search Anime',
    body: 'Search the AniVault catalog for any anime title. Filter by genre or find characters and start watching instantly.',
  },
  '/genres': {
    title: 'Anime Genres - AniVault',
    description:
      'Browse anime by genre on AniVault. Action, Adventure, Comedy, Drama, Fantasy, Romance and more – free in HD.',
    h1: 'Browse by Genre',
    body: 'Explore anime organized by genre. From action and adventure to romance and fantasy, find your next series on AniVault.',
  },
  '/updated': {
    title: 'Recently Updated Anime - AniVault',
    description:
      'See the latest updated anime episodes on AniVault. New releases and fresh episodes added regularly.',
    h1: 'Recently Updated',
    body: 'Stay up to date with the newest anime episodes. AniVault continuously updates the catalog with the latest releases.',
  },
  '/updates': {
    title: 'Anime Updates - AniVault',
    description:
      'Latest anime updates and new episodes on AniVault. Watch the newest content free in HD.',
    h1: 'Anime Updates',
    body: 'Check the latest anime updates and newly added episodes. Keep your watchlist current with AniVault.',
  },
};

function buildPageHtml(opts: {
  title: string;
  description: string;
  canonical: string;
  h1: string;
  body: string;
  image?: string;
  type?: string;
}) {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description.slice(0, 160));
  const canonical = escapeHtml(opts.canonical);
  const h1 = escapeHtml(opts.h1);
  const body = escapeHtml(opts.body);
  const image = opts.image
    ? escapeHtml(opts.image)
    : 'https://www.anivault.online/landing/zoro-hero.webp';
  const ogType = opts.type || 'website';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:type" content="${ogType}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:site_name" content="AniVault" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AniVault",
    "url": "https://www.anivault.online/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.anivault.online/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  </script>

  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#07070c;color:#e2e8f0;margin:0;padding:2rem;line-height:1.6}
    a{color:#f59e0b}
    h1{color:#fff;margin-bottom:.75rem}
    .content{max-width:720px;margin-bottom:2rem}
    .cta{display:inline-block;margin-top:1.5rem;padding:.75rem 1.5rem;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}
    nav a{margin-right:1rem}
  </style>
</head>
<body>
  <header>
    <nav>
      <a href="https://www.anivault.online/">AniVault</a>
      <a href="https://www.anivault.online/home">Home</a>
      <a href="https://www.anivault.online/search">Search</a>
      <a href="https://www.anivault.online/genres">Genres</a>
      <a href="https://www.anivault.online/updated">Updated</a>
    </nav>
  </header>
  <main>
    <h1>${h1}</h1>
    <div class="content"><p>${body}</p></div>
    <a class="cta" href="${canonical}">Open AniVault →</a>
  </main>
</body>
</html>`;
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
  const description = escapeHtml((opts.description || '').slice(0, 160));
  const canonical = escapeHtml(opts.canonical);
  const image = opts.image
    ? escapeHtml(opts.image)
    : 'https://www.anivault.online/landing/zoro-hero.webp';
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
    body{font-family:system-ui,-apple-system,sans-serif;background:#07070c;color:#e2e8f0;margin:0;padding:2rem;line-height:1.6}
    a{color:#f59e0b}
    h1{color:#fff;margin-bottom:.5rem}
    .meta{color:#94a3b8;font-size:.9rem;margin-bottom:1.5rem}
    .synopsis{max-width:720px}
    .cta{display:inline-block;margin-top:2rem;padding:.75rem 1.5rem;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}
  </style>
</head>
<body>
  <header><a href="https://www.anivault.online/">AniVault</a></header>
  <main>
    <h1>${title}</h1>
    <div class="meta">${opts.score ? `Score: ${opts.score} · ` : ''}${genres}</div>
    <div class="synopsis"><p>${synopsis}</p></div>
    <a class="cta" href="${canonical}">Watch on AniVault →</a>
  </main>
</body>
</html>`;
}

export default async function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const { pathname } = url;

  // Only special-case bots
  if (!isBot(ua)) {
    return;
  }

  // 1. Homepage + main listing pages
  const staticPage = STATIC_PAGES[pathname];
  if (staticPage) {
    const html = buildPageHtml({
      title: staticPage.title,
      description: staticPage.description,
      canonical: `https://www.anivault.online${pathname === '/' ? '/' : pathname}`,
      h1: staticPage.h1,
      body: staticPage.body,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-AniVault-SEO': 'bot-html-static',
      },
    });
  }

  // 2. Anime detail pages
  if (!pathname.startsWith('/anime/')) {
    return;
  }

  const match = pathname.match(/-(\d+)$/);
  if (!match) {
    return;
  }

  const malId = match[1];

  try {
    const apiUrl = new URL(`/api/anilist/anime/${malId}`, url.origin);
    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    const title =
      data.title_english ||
      data.title ||
      data.title_romaji ||
      data.name ||
      `Anime ${malId}`;

    const rawSynopsis = (data.synopsis || data.description || '')
      .replace(/\n+/g, ' ')
      .trim();

    const description =
      rawSynopsis.slice(0, 155) +
        (rawSynopsis.length > 155 ? '…' : '') ||
      `Watch ${title} online in HD on AniVault.`;

    const image =
      data.coverImage?.extraLarge ||
      data.coverImage?.large ||
      data.image ||
      data.images?.jpg?.large_image_url ||
      undefined;

    const genres = Array.isArray(data.genres)
      ? data.genres
          .map((g: any) => (typeof g === 'string' ? g : g?.name))
          .filter(Boolean)
      : [];

    const score = data.averageScore || data.score || data.mean || undefined;

    const html = buildAnimeHtml({
      title,
      description,
      canonical: `https://www.anivault.online${pathname}`,
      image,
      synopsis: rawSynopsis,
      score,
      genres,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-AniVault-SEO': 'bot-html',
      },
    });
  } catch (err) {
    console.error('SEO middleware error:', err);
    return;
  }
}
