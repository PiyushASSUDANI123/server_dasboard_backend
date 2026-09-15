const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { authMiddleware, requireAdmin } = require('./auth');

router.use(authMiddleware);

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const BACKUP_SOURCE = process.env.BACKUP_SOURCE || path.join(__dirname, '../../user_files');

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// In-memory backup history
let backupHistory = [];

// Scheduled backup config (in-memory)
let scheduledBackups = [];

// GET - list all backup snapshots
router.get('/snapshots', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - backup history logs
router.get('/history', (req, res) => {
  res.json(backupHistory.slice(0, 50));
});

// GET - scheduled backup configs
router.get('/scheduled', (req, res) => {
  res.json(scheduledBackups.map(s => ({
    id: s.id,
    name: s.name,
    schedule: s.schedule,
    source: s.source,
    lastRun: s.lastRun,
    nextRun: s.nextRun,
    status: s.status
  })));
});

// POST - trigger manual backup NOW
router.post('/trigger', requireAdmin, (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.tar.gz`;
  const outputPath = path.join(BACKUP_DIR, filename);
  
  const logEntry = {
    id: Date.now().toString(),
    filename,
    startedAt: new Date().toISOString(),
    status: 'running',
    source: BACKUP_SOURCE,
    completedAt: null,
    size: null,
    error: null
  };
  backupHistory.unshift(logEntry);
  
  // Run tar in the background
  const cmd = `tar -czf "${outputPath}" -C "${path.dirname(BACKUP_SOURCE)}" "${path.basename(BACKUP_SOURCE)}" 2>&1`;
  
  exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    const entry = backupHistory.find(h => h.id === logEntry.id);
    if (entry) {
      entry.completedAt = new Date().toISOString();
      if (error) {
        entry.status = 'failed';
        entry.error = stderr || error.message;
      } else {
        entry.status = 'success';
        try {
          entry.size = fs.statSync(outputPath).size;
        } catch (e) {
          entry.size = 0;
        }
      }
    }
  });

  res.json({ success: true, message: 'Backup started', filename });
});

// GET - download a snapshot
router.get('/download/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename); // Prevent traversal
  const filePath = path.join(BACKUP_DIR, safeName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }
  
  res.download(filePath);
});

// DELETE - delete a snapshot
router.delete('/snapshots/:filename', requireAdmin, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(BACKUP_DIR, safeName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }
  
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
