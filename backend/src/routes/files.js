const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../services/driveService');

// In‑memory storage for uploaded files
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * POST /api/files/upload
 * Generic file upload endpoint.
 * Expected fields: "file" (multipart file), optional "folderId" to place file in a specific Drive folder.
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const folderId = req.body.folderId || process.env.DRIVE_ROOT_FOLDER_ID;
    const driveResult = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folderId
    );
    res.status(201).json({ fileId: driveResult.id, link: driveResult.webViewLink });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
