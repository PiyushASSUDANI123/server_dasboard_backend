const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { authMiddleware, requireAdmin } = require('./auth');

// The Jail Directory - Users cannot access anything outside this folder
const BASE_DIR = process.env.JAIL_DIR || path.join(__dirname, '../../user_files');

// Ensure base dir exists
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

// In-memory store for shared links (In a real app, use a DB)
const sharedLinks = {};

// --- PATH TRAVERSAL PROTECTION HELPER ---
const getSafePath = (requestedPath) => {
  const safePath = path.resolve(BASE_DIR, requestedPath || '');
  if (!safePath.startsWith(path.resolve(BASE_DIR))) {
    throw new Error('Path traversal detected');
  }
  return safePath;
};

// --- PUBLIC ROUTE: Download shared file ---
router.get('/share/:uuid', (req, res) => {
  const filePath = sharedLinks[req.params.uuid];
  if (!filePath) {
    return res.status(404).send('Link invalid or expired');
  }
  
  try {
    const absolutePath = getSafePath(filePath);
    if (fs.statSync(absolutePath).isFile()) {
      res.download(absolutePath);
    } else {
      res.status(400).send('Cannot download a directory directly');
    }
  } catch (error) {
    res.status(403).send('Access denied');
  }
});

// All following routes require authentication
router.use(authMiddleware);

// Generate Shareable Link
router.post('/share', (req, res) => {
  try {
    const { targetPath } = req.body;
    getSafePath(targetPath); // Validates path exists in jail
    
    const uuid = crypto.randomUUID();
    sharedLinks[uuid] = targetPath;
    
    const publicUrl = `${req.protocol}://${req.get('host')}/api/files/share/${uuid}`;
    res.json({ success: true, url: publicUrl });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// List Files (Viewer & Admin)
router.get('/list', (req, res) => {
  try {
    const targetDir = req.query.path || '';
    const safePath = getSafePath(targetDir);
    
    const files = fs.readdirSync(safePath, { withFileTypes: true }).map(dirent => ({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
      size: dirent.isDirectory() ? 0 : fs.statSync(path.join(safePath, dirent.name)).size,
      path: path.join(targetDir, dirent.name)
    }));
    
    res.json(files);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// --- ADMIN ONLY ROUTES ---

// Create Folder
router.post('/folder', requireAdmin, (req, res) => {
  try {
    const safePath = getSafePath(req.body.path);
    if (!fs.existsSync(safePath)) {
      fs.mkdirSync(safePath);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Directory already exists' });
    }
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Delete File/Folder
router.delete('/', requireAdmin, (req, res) => {
  try {
    const safePath = getSafePath(req.body.path);
    if (fs.existsSync(safePath)) {
      fs.rmSync(safePath, { recursive: true, force: true });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

module.exports = router;
