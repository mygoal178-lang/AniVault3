import { createClient } from '@supabase/supabase-js';

function getAdminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic admin gate: require Authorization bearer (same as app middleware expects)
  // Full role check is done via users table below when possible.
  const authHeader = String(req.headers?.authorization || '');
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(503).json({
      error: 'Server admin database client is not configured. Set SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  try {
    // Verify caller is admin using the JWT user id if present
    // (Supabase JWT is validated loosely here; service role is used for reads.)
    const token = authHeader.slice(7).trim();
    let isAdmin = false;
    try {
      const { data: userData, error: userErr } = await db.auth.getUser(token);
      if (!userErr && userData?.user?.id) {
        const { data: profile } = await db
          .from('users')
          .select('role')
          .eq('id', userData.user.id)
          .maybeSingle();
        isAdmin = profile?.role === 'admin';
      }
    } catch {
      isAdmin = false;
    }
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [animeRes, episodesRes, usersRes, commentsRes] = await Promise.all([
      db.from('anime').select('*', { count: 'exact', head: true }),
      db.from('episodes').select('views', { count: 'exact' }),
      db.from('users').select('*', { count: 'exact', head: true }),
      db.from('comments').select('*', { count: 'exact', head: true }),
    ]);

    const totalAnime = animeRes.count ?? 0;
    const totalEpisodes = episodesRes.count ?? 0;
    const totalUsers = usersRes.count ?? 0;
    const totalComments = commentsRes.count ?? 0;

    let totalViews = 0;
    if (episodesRes.data && Array.isArray(episodesRes.data)) {
      totalViews = episodesRes.data.reduce((acc: number, ep: any) => acc + (Number(ep.views) || 0), 0);
    }

    const { data: topEpisodesData } = await db
      .from('episodes')
      .select('id, anime_mal_id, episode_number, title, thumbnail_url, views')
      .order('views', { ascending: false })
      .limit(5);

    const topViewedEpisodes = await Promise.all(
      (topEpisodesData || []).map(async (ep: any) => {
        const { data: animeData } = await db
          .from('anime')
          .select('title, cover_url')
          .eq('external_id', ep.anime_mal_id)
          .maybeSingle();

        return {
          id: ep.id,
          anime_mal_id: ep.anime_mal_id,
          episode_number: ep.episode_number,
          title: ep.title,
          thumbnail_url: ep.thumbnail_url,
          views: ep.views || 0,
          anime_title: animeData?.title || `Anime #${ep.anime_mal_id}`,
          cover_url: animeData?.cover_url || null,
        };
      })
    );

    // Durable top-searched from public.anime.search_count
    const { data: topFromDb } = await db
      .from('anime')
      .select('external_id, title, cover_url, search_count')
      .gt('search_count', 0)
      .order('search_count', { ascending: false })
      .limit(5);

    const topSearchedAnime = (topFromDb || []).map((row: any) => ({
      mal_id: Number(row.external_id),
      title: row.title || `Anime #${row.external_id}`,
      cover_url: row.cover_url || '',
      search_count: Number(row.search_count) || 0,
    }));

    return res.status(200).json({
      total_anime: totalAnime,
      total_episodes: totalEpisodes,
      total_users: totalUsers,
      total_views: totalViews,
      total_comments: totalComments,
      recently_added: totalEpisodes,
      most_viewed_episode: topViewedEpisodes[0] || null,
      top_viewed_episodes: topViewedEpisodes,
      most_searched_anime: topSearchedAnime[0] || null,
      top_searched_anime: topSearchedAnime,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch admin stats from Supabase.' });
  }
}
