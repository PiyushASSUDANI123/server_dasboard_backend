const express = require('express');
const router = express.Router();
const si = require('systeminformation');
const { authMiddleware } = require('./auth');
const { exec } = require('child_process');

router.use(authMiddleware);

// Get real-time system stats (CPU, RAM, Disk)
router.get('/stats', async (req, res) => {
  try {
    const [cpu, mem, os] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.osInfo()
    ]);
    
    res.json({
      cpu: cpu.currentLoad,
      memory: {
        total: mem.total,
        used: mem.active,
        free: mem.free,
        percent: (mem.active / mem.total) * 100
      },
      uptime: os.uptime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active processes
router.get('/processes', async (req, res) => {
  try {
    const processes = await si.processes();
    res.json(processes.list.map(p => ({
      pid: p.pid,
      name: p.name,
      cpu: p.cpu,
      memory: p.mem,
      user: p.user,
      command: p.command,
      started: p.started
    })).sort((a, b) => b.cpu - a.cpu).slice(0, 50)); // Top 50 by CPU
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kill a process
router.post('/processes/kill', (req, res) => {
  const { pid } = req.body;
  
  if (!pid || isNaN(pid)) {
    return res.status(400).json({ error: 'Valid PID is required' });
  }
  
  exec(`kill -9 ${pid}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr || error.message });
    }
    res.json({ success: true, message: `Process ${pid} killed` });
  });
});

module.exports = router;
