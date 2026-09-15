const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const { authMiddleware, requireAdmin } = require('./auth');

// Automatically connect to docker socket
// On mac, this might be slightly different depending on docker desktop setup, 
// usually /var/run/docker.sock works if symlinked
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

router.use(authMiddleware);

// List containers
router.get('/containers', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const formatted = containers.map(c => ({
      id: c.Id.substring(0, 12),
      names: c.Names.map(n => n.replace('/', '')),
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: c.Ports
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to list containers' });
  }
});

// Admin actions
router.post('/containers/:id/start', requireAdmin, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/containers/:id/stop', requireAdmin, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/containers/:id/restart', requireAdmin, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
