import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import type { OrderInsert, OrderUpdate } from '../types/database.js';

const router = Router();

/**
 * GET /api/orders
 * Get all orders (requires authentication)
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    // Filter by status if provided
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      orders: orders || [],
      count: orders?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/orders/:id
 * Get order by ID (requires authentication)
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch order',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/orders
 * Create a new order (requires admin)
 */
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const orderData: OrderInsert = {
      customer_name: req.body.customer_name,
      order_details: req.body.order_details,
      location: req.body.location || null,
      phone_number: req.body.phone_number || null,
      pickup_date: req.body.pickup_date || null,
      meta_business_link: req.body.meta_business_link || null,
      image: req.body.image || null,
      status: req.body.status || 'incoming',
      created_by: req.user.id,
    };

    // Validate required fields
    if (!orderData.customer_name || !orderData.order_details) {
      return res.status(400).json({ error: 'customer_name and order_details are required' });
    }

    // Use admin client to bypass RLS since we've already validated admin permissions
    if (!supabaseAdmin) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured. Please contact administrator.'
      });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Order created successfully',
      order,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create order',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/orders/:id
 * Update an order (requires authentication)
 * - Viewers can only update status field
 * - Admins can update all fields
 */
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';

    const updateData: OrderUpdate = {};
    
    // Admins can update all fields
    if (isAdmin) {
      if (req.body.customer_name !== undefined) updateData.customer_name = req.body.customer_name;
      if (req.body.order_details !== undefined) updateData.order_details = req.body.order_details;
      if (req.body.location !== undefined) updateData.location = req.body.location;
      if (req.body.phone_number !== undefined) updateData.phone_number = req.body.phone_number;
      if (req.body.pickup_date !== undefined) updateData.pickup_date = req.body.pickup_date;
      if (req.body.meta_business_link !== undefined) updateData.meta_business_link = req.body.meta_business_link;
      if (req.body.image !== undefined) updateData.image = req.body.image;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.completed_at !== undefined) updateData.completed_at = req.body.completed_at;
    } else {
      // Viewers can only update status
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
      } else {
        return res.status(403).json({ error: 'Viewers can only update order status' });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Use admin client to bypass RLS since we've already validated permissions
    // If service role key is not configured, this will fail - ensure SUPABASE_SERVICE_ROLE_KEY is set
    if (!supabaseAdmin) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured. Order updates may fail due to RLS policies.');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured. Please contact administrator.'
      });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.status(400).json({ 
        error: 'Failed to update order',
        details: error.message 
      });
    }

    res.json({
      message: 'Order updated successfully',
      order,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update order',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/orders/:id
 * Delete an order (requires admin)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Use admin client to bypass RLS since we've already validated admin permissions
    if (!supabaseAdmin) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured. Please contact administrator.'
      });
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete order',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/orders/stats/summary
 * Get order statistics (requires authentication)
 */
router.get('/stats/summary', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get counts by status
    const { data: orders, error } = await supabase
      .from('orders')
      .select('status');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const stats = {
      total: orders?.length || 0,
      incoming: orders?.filter(o => o.status === 'incoming').length || 0,
      pending: orders?.filter(o => o.status === 'pending').length || 0,
      accepted: orders?.filter(o => o.status === 'accepted').length || 0,
      declined: orders?.filter(o => o.status === 'declined').length || 0,
      completed: orders?.filter(o => o.status === 'completed').length || 0,
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

