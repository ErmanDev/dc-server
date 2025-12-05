import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/history
 * List history records
 * Query params:
 *  - order_id (optional): filter by order
 *  - date (optional, YYYY-MM-DD): filter by calendar day (created_at)
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { order_id, date, limit = '200', offset = '0' } = req.query;

    let query = supabase
      .from('order_history')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (order_id && typeof order_id === 'string') {
      query = query.eq('order_id', order_id);
    }

    if (date && typeof date === 'string') {
      // Filter by calendar day in server timezone
      query = query.gte('created_at', `${date} 00:00:00`).lt('created_at', `${date} 23:59:59.999+00`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      history: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch order history',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/history
 * Create a history record for an order (admin only)
 */
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { order_id, event_type, old_status, new_status, note } = req.body as {
      order_id?: string;
      event_type?: string;
      old_status?: string | null;
      new_status?: string | null;
      note?: string | null;
    };

    if (!order_id || !event_type) {
      return res.status(400).json({ error: 'order_id and event_type are required' });
    }

    if (!supabaseAdmin) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return res.status(500).json({
        error: 'Server configuration error',
        details: 'Service role key not configured. Please contact administrator.',
      });
    }

    const insertData = {
      order_id,
      user_id: req.user.id,
      event_type,
      old_status: old_status ?? null,
      new_status: new_status ?? null,
      note: note ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from('order_history')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'History record created successfully',
      history: data,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create history record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


