const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../services/driveService');
const db = require('../services/dbService');
const emailService = require('../services/emailService');

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * POST /api/talent/upload
 * Expected fields: "cv" (file), "name", "email", "expertise" (JSON string)
 */
router.post('/upload', upload.single('cv'), async (req, res) => {
  try {
    const { name, email, expertise } = req.body;
    if (!req.file) return res.status(400).json({ error: 'CV file missing' });

    // Upload CV to Google Drive
    const driveResult = await uploadFile(
      req.file.buffer,
      `${name}_CV_${Date.now()}.${req.file.originalname.split('.').pop()}`,
      req.file.mimetype,
      process.env.DRIVE_ROOT_FOLDER_ID
    );

    // Insert talent record
    const talent = await db.createTalent({
      name,
      email,
      expertise: JSON.parse(expertise || '[]'),
      cv_drive_id: driveResult.id,
      cv_link: driveResult.webViewLink,
      created_at: new Date().toISOString()
    });

    // Send confirmation email
    await emailService.sendTalentWelcome(email, name);

    res.status(201).json({ talent });
  } catch (err) {
    console.error('Talent upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
