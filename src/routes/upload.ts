import { Router, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for memory storage (we'll upload directly to Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/upload/image
 * Upload an image file to Supabase Storage (requires admin)
 */
router.post('/image', authenticate, requireAdmin, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Service role key not configured. Please contact administrator.'
      });
    }

    // Generate unique filename
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = fileName;

    // Upload to Supabase Storage
    // Note: The 'order-images' bucket must be created in Supabase Storage first
    // Make sure it's set to public or has proper RLS policies
    const { data, error } = await supabaseAdmin.storage
      .from('order-images')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      // Check if bucket doesn't exist
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        return res.status(400).json({ 
          error: 'Storage bucket not found',
          details: 'The "order-images" bucket does not exist in Supabase Storage. Please create it in your Supabase dashboard.',
          hint: 'Go to Storage > Create Bucket > Name it "order-images" and set it to public'
        });
      }
      return res.status(400).json({ 
        error: 'Failed to upload image',
        details: error.message 
      });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('order-images')
      .getPublicUrl(filePath);

    res.json({
      message: 'Image uploaded successfully',
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

