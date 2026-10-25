import express from 'express';
import cookieParser from 'cookie-parser';
import { anilistApi } from './anilistCache.js';
import { authenticateUser, requireAdmin, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabase.js';
import { rateLimit } from './rateLimit.js';
import { searchLocalAnime, getLocalGenres, getLocalTopAnime, getLocalSeasonAnime } from './catalogFallback.js';
import { registerRequestRoutes } from './requestRoutes.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use((req, _res, next) => {
  const raw = req.url || '/';
  const qIndex = raw.indexOf('?');
  const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';

  if (!pathOnly.startsWith('/api')) {
    const needsPrefix =
      pathOnly === '/' ||
      pathOnly === '' ||
      pathOnly.startsWith('/anime') ||
      pathOnly.startsWith('/episodes') ||
      pathOnly.startsWith('/admin') ||
      pathOnly.startsWith('/health') ||
      pathOnly.startsWith('/db') ||
      pathOnly.startsWith('/anilist') ||
      pathOnly.startsWith('/jikan') ||
      pathOnly.startsWith('/requests');

    if (needsPrefix) {
      const normalizedPath = pathOnly === '/' || pathOnly === '' ? '/api/health' : `/api${pathOnly}`;
      req.url = normalizedPath + query;
    }
  }
  next();
});

app.use('/api/', rateLimit(120, 60_000));
app.use(authenticateUser);

registerRequestRoutes(app);

export { app };
export default app;
