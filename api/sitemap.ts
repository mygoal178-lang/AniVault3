import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.anivault.online';

function getSupabaseEnv() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';
  return { url, key };
}

function slugify(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&' + 'apos;');
}

function toIso(dateVal: unknown): string | null {
  if (!dateVal) return null;
  try {
    const d = new Date(String(dateVal));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();

    if (!supabaseUrl || !supabaseKey) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).send('Supabase environment variables are missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const staticPages = [
      { url: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
      { url: `${SITE_URL}/home`, changefreq: 'daily', priority: '0.9' },
      { url: `${SITE_URL}/search`, changefreq: 'daily', priority: '0.8' },
      { url: `${SITE_URL}/genres`, changefreq: 'weekly', priority: '0.8' },
      { url: `${SITE_URL}/updated`, changefreq: 'hourly', priority: '0.8' },
      { url: `${SITE_URL}/updates`, changefreq: 'hourly', priority: '0.7' },
      { url: `${SITE_URL}/request`, changefreq: 'weekly', priority: '0.6' },
      { url: `${SITE_URL}/about`, changefreq: 'monthly', priority: '0.5' },
      { url: `${SITE_URL}/privacy`, changefreq: 'monthly', priority: '0.4' },
      { url: `${SITE_URL}/terms`, changefreq: 'monthly', priority: '0.4' },
    ];

    // Anime list (Supabase default max rows is often 1000 — paginate if needed)
    let anime: any[] = [];
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('id, external_id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(2000);

      if (error) {
        console.error('Anime sitemap error:', error.message);
      } else {
        anime = data || [];
      }
    } catch (e: any) {
      console.error('Anime fetch threw:', e?.message || e);
    }

    // Episodes — limit to keep function fast/reliable
    let episodes: any[] = [];
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('id, anime_id, episode_number, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3000);

      if (error) {
        console.warn('Episode sitemap warning:', error.message);
      } else {
        episodes = data || [];
      }
    } catch (e: any) {
      console.warn('Episode fetch threw:', e?.message || e);
    }

    const urls: Array<{
      url: string;
      lastmod?: string | null;
      changefreq: string;
      priority: string;
    }> = [...staticPages];

    // Map for O(1) episode → anime lookup
    const animeById = new Map<string, any>();
    for (const item of anime) {
      if (item?.id != null) animeById.set(String(item.id), item);
      if (item?.external_id != null) animeById.set(String(item.external_id), item);
    }

    for (const item of anime) {
      try {
        const externalId = item.external_id ?? item.id;
        if (!externalId || !item.title) continue;

        const slug = slugify(item.title);
        if (!slug) continue;

        urls.push({
          url: `${SITE_URL}/anime/${slug}-${externalId}`,
          lastmod: toIso(item.updated_at),
          changefreq: 'daily',
          priority: '0.9',
        });
      } catch {
        // skip bad row
      }
    }

    for (const episode of episodes) {
      try {
        const animeItem =
          animeById.get(String(episode.anime_id)) || null;

        if (!animeItem) continue;

        const externalId = animeItem.external_id ?? animeItem.id;
        if (
          !externalId ||
          !animeItem.title ||
          episode.episode_number === null ||
          episode.episode_number === undefined
        ) {
          continue;
        }

        const slug = slugify(animeItem.title);
        if (!slug) continue;

        urls.push({
          url: `${SITE_URL}/watch/${slug}-${externalId}/ep-${episode.episode_number}`,
          lastmod: toIso(episode.updated_at) || toIso(animeItem.updated_at),
          changefreq: 'weekly',
          priority: '0.7',
        });
      } catch {
        // skip bad row
      }
    }

    const uniqueUrls = Array.from(
      new Map(urls.map((item) => [item.url, item])).values()
    );

    const body = uniqueUrls
      .map((item) => {
        const lastmod = item.lastmod
          ? `\n    <lastmod>${escapeXml(item.lastmod)}</lastmod>`
          : '';
        return `  <url>
    <loc>${escapeXml(item.url)}</loc>${lastmod}
    <changefreq>${escapeXml(item.changefreq)}</changefreq>
    <priority>${escapeXml(item.priority)}</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    );
    return res.status(200).send(xml);
  } catch (error: any) {
    console.error('Sitemap generation error:', error?.message || error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res
      .status(500)
      .send('Failed to generate sitemap: ' + (error?.message || 'unknown'));
  }
}
