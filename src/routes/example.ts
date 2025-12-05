import { Router } from 'express';
import { supabase } from '../config/supabase.js';

const router = Router();

/**
 * Example: Get all records from a table
 * Replace 'your_table_name' with your actual table name
 */
router.get('/example/table', async (req, res) => {
  try {
    // Example query - replace 'your_table_name' with your actual table
    const { data, error } = await supabase
      .from('your_table_name')
      .select('*')
      .limit(10);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data, count: data?.length || 0 });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Example: Insert a record
 */
router.post('/example/table', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('your_table_name')
      .insert(req.body)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

