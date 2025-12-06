import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { limit = '50', offset = '0', unread_only = 'false' } = req.query;

    // Use admin client to bypass RLS, but filter by user_id for security
    // This ensures we can fetch notifications even if RLS policies have issues
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured'
      });
    }

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    // Filter by read status if requested
    if (unread_only === 'true') {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('[GET /notifications] Error fetching notifications:', error);
      console.error('[GET /notifications] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return res.status(400).json({ 
        error: error.message || 'Failed to fetch notifications',
        details: error.details || error.hint || 'Unknown error',
      });
    }

    console.log(`[GET /notifications] Successfully fetched ${notifications?.length || 0} notification(s) for user ${req.user.id}`);

    res.json({
      notifications: notifications || [],
      count: notifications?.length || 0,
    });
  } catch (error) {
    console.error('[GET /notifications] Unexpected error:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Use admin client to bypass RLS, but filter by user_id for security
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured'
      });
    }

    const { data, error, count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      count: count || 0,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch unread count',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    // Use admin client to bypass RLS, but filter by user_id for security
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured'
      });
    }

    // First verify the notification belongs to the user
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Update the notification
    const { data: updatedNotification, error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Notification marked as read',
      notification: updatedNotification,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to mark notification as read',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    // Use admin client to bypass RLS, but filter by user_id for security
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured'
      });
    }

    // Verify the notification belongs to the user before deleting
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/notifications
 * Create a notification (admin only, typically called by server)
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only admins can create notifications (or service role)
    if (req.user.role !== 'admin' && req.user.role !== 'service_role') {
      return res.status(403).json({ error: 'Only admins can create notifications' });
    }

    const { user_id, title, message, type = 'info', order_id } = req.body;

    if (!user_id || !title || !message) {
      return res.status(400).json({ error: 'user_id, title, and message are required' });
    }

    // Use admin client to bypass RLS
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured'
      });
    }

    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type,
        order_id: order_id || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Notification created successfully',
      notification,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/notifications/notify-admin-ready
 * Notify all admins that an order is ready for pickup (viewers can call this)
 */
router.post('/notify-admin-ready', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    console.log(`[NOTIFY-ADMIN] Viewer ${req.user.id} requesting to notify admins about order ${order_id}`);

    // Use admin client to bypass RLS
    if (!supabaseAdmin) {
      console.error('[NOTIFY-ADMIN] Service role key not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured'
      });
    }

    // Get order details for the notification message
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, customer_name, order_details')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[NOTIFY-ADMIN] Order not found:', orderError?.message);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`[NOTIFY-ADMIN] Order found: ${order.customer_name}`);

    // Get all admin users
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, role')
      .eq('role', 'admin');

    if (adminError) {
      console.error('[NOTIFY-ADMIN] Failed to fetch admin users:', adminError.message);
      return res.status(500).json({ 
        error: 'Failed to fetch admin users',
        details: adminError.message 
      });
    }

    console.log(`[NOTIFY-ADMIN] Found ${adminUsers?.length || 0} admin user(s)`);
    if (adminUsers && adminUsers.length > 0) {
      console.log('[NOTIFY-ADMIN] Admin IDs:', adminUsers.map(u => u.id).join(', '));
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.warn('[NOTIFY-ADMIN] No admin users found in database');
      return res.status(404).json({ error: 'No admin users found' });
    }

    // Create notifications for all admins
    const notifications = adminUsers.map(admin => ({
      user_id: admin.id,
      title: 'Cake Ready for Pickup',
      message: `Order for ${order.customer_name} is ready for pickup. ${order.order_details ? `Details: ${order.order_details}` : ''}`,
      type: 'order' as const,
      order_id: order_id,
    }));

    console.log(`[NOTIFY-ADMIN] Creating ${notifications.length} notification(s)...`);

    const { data: createdNotifications, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)
      .select();

    if (insertError) {
      console.error('[NOTIFY-ADMIN] Failed to create notifications:', insertError.message);
      return res.status(400).json({ 
        error: 'Failed to create notifications',
        details: insertError.message 
      });
    }

    console.log(`[NOTIFY-ADMIN] Successfully created ${createdNotifications?.length || 0} notification(s)`);

    res.status(201).json({
      message: `Notifications sent to ${adminUsers.length} admin(s)`,
      notifications: createdNotifications,
      count: createdNotifications?.length || 0,
    });
  } catch (error) {
    console.error('[NOTIFY-ADMIN] Unexpected error:', error);
    res.status(500).json({
      error: 'Failed to notify admins',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

