const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { enhanceProfilePhotoBuffer } = require('../services/profilePhotoEnhance');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok =
      mime.startsWith('image/')
      || mime === 'application/octet-stream';
    if (!ok) {
      cb(new Error('Only image uploads are allowed (JPG, PNG, HEIC)'));
      return;
    }
    cb(null, true);
  },
});

const enhanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many photo enhancement requests. Try again later.' },
});

/**
 * POST /api/profile/enhance-photo
 * multipart field: photo
 * Returns JPEG 1200×1500 studio-style portrait (Leonardo + sharp frame).
 */
router.post('/enhance-photo', enhanceLimiter, upload.single('photo'), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'Upload a photo field named "photo" (JPG/PNG, max 10MB).' });
  }

  try {
    const { buffer, debug } = await enhanceProfilePhotoBuffer(
      req.file.buffer,
      req.file.mimetype
    );

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store',
      'X-Photo-Sharp': debug.sharp,
      'X-Photo-Leonardo': debug.leonardo,
      'X-Photo-Model': debug.model || '',
      'X-Photo-Heic': debug.heic,
      'X-Photo-Pipeline': debug.pipeline,
      'Access-Control-Expose-Headers':
        'X-Photo-Sharp,X-Photo-Leonardo,X-Photo-Model,X-Photo-Heic,X-Photo-Pipeline',
    });
    return res.send(buffer);
  } catch (err) {
    console.error('[profilePhoto] enhance error:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Could not enhance photo',
    });
  }
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;
