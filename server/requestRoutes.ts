import { rateLimit } from './rateLimit.js';
import { supabaseAdmin, isSupabaseConfigured } from './supabase.js';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import type { Express } from 'express';

/**
 * Public anime request endpoints (no login required for POST).
 */
export function registerRequestRoutes(app: Express) {
  app.post('/api/requests', rateLimit(5, 10 * 60_000), async (req: AuthenticatedRequest, res) => {
    try {
      if (!isSupabaseConfigured || !supabaseAdmin) {
        return res.status(503).json({ error: 'Request service is temporarily unavailable.' });
      }

      const title = String(req.body?.title || '').trim();
      const note = String(req.body?.note || '').trim().slice(0, 500) || null;
      const emailRaw = String(req.body?.email || '').trim().toLowerCase();
      const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
      const malId =
        req.body?.mal_id != null && !isNaN(Number(req.body.mal_id)) ? Number(req.body.mal_id) : null;

      if (req.body?.website) {
        return res.json({ success: true, message: 'Thanks! We received your request.' });
      }

      if (!title || title.length < 2) {
        return res.status(400).json({ error: 'Please enter an anime title (at least 2 characters).' });
      }
      if (title.length > 200) {
        return res.status(400).json({ error: 'Title is too long.' });
      }

      const forwarded = req.headers['x-forwarded-for'];
      const ip =
        (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
        req.socket?.remoteAddress ||
        null;

      const { data, error } = await supabaseAdmin
        .from('anime_requests')
        .insert({
          title,
          note,
          email,
          mal_id: malId,
          status: 'pending',
          ip,
        })
        .select('id, title, status, created_at')
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        message: 'Thanks! Your request was submitted. We will review it soon.',
        request: data,
      });
    } catch (err: any) {
      console.error('[requests] insert failed:', err?.message);
      return res.status(500).json({ error: 'Could not save your request. Please try again later.' });
    }
  });

  app.get('/api/admin/requests', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const db = supabaseAdmin || req.supabase;
      const status = String(req.query.status || '').trim();
      let query = db
        .from('anime_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (status && ['pending', 'imported', 'rejected', 'duplicate'].includes(status)) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data || []);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to load requests.' });
    }
  });

  app.patch('/api/admin/requests/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const db = supabaseAdmin || req.supabase;
      const id = req.params.id;
      const status = String(req.body?.status || '').trim();

      if (!['pending', 'imported', 'rejected', 'duplicate'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }

      const { data, error } = await db
        .from('anime_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return res.json({ success: true, request: data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to update request.' });
    }
  });
}
