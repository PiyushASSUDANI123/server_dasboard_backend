const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const { authMiddleware, requireAdmin } = require('./auth');

router.use(authMiddleware);

// In-memory store for monitored services and their logs
let monitoredServices = [];
let uptimeLogs = []; // { serviceId, status, timestamp, responseTime }

// Auto-check interval reference
let checkInterval = null;

const performHealthCheck = async (service) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const protocol = service.url.startsWith('https') ? https : http;
    
    const req = protocol.get(service.url, { timeout: 10000 }, (res) => {
      const responseTime = Date.now() - startTime;
      const isUp = res.statusCode >= 200 && res.statusCode < 400;
      resolve({ status: isUp ? 'up' : 'down', responseTime, statusCode: res.statusCode });
    });

    req.on('error', () => {
      const responseTime = Date.now() - startTime;
      resolve({ status: 'down', responseTime, statusCode: 0 });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({ status: 'down', responseTime, statusCode: 0 });
    });
  });
};

const runAllChecks = async () => {
  for (const service of monitoredServices) {
    const result = await performHealthCheck(service);
    
    const prevStatus = service.currentStatus;
    service.currentStatus = result.status;
    service.lastResponseTime = result.responseTime;
    service.lastStatusCode = result.statusCode;
    service.lastChecked = new Date().toISOString();

    // If status changed, record it
    if (prevStatus !== result.status) {
      uptimeLogs.unshift({
        serviceId: service.id,
        serviceName: service.name,
        status: result.status,
        timestamp: new Date().toISOString(),
        responseTime: result.responseTime,
        statusCode: result.statusCode,
        message: result.status === 'up' ? 'Service recovered' : 'Service went down'
      });
    }

    // Update uptime tracking
    if (result.status === 'up') {
      service.uptimeChecks = (service.uptimeChecks || 0) + 1;
    }
    service.totalChecks = (service.totalChecks || 0) + 1;
  }
};

// Start auto-checking every 60 seconds
const startAutoCheck = () => {
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(runAllChecks, 60000);
};
startAutoCheck();

// GET all monitored services
router.get('/services', (req, res) => {
  res.json(monitoredServices.map(s => ({
    id: s.id,
    name: s.name,
    url: s.url,
    currentStatus: s.currentStatus || 'unknown',
    lastResponseTime: s.lastResponseTime || null,
    lastStatusCode: s.lastStatusCode || null,
    lastChecked: s.lastChecked || null,
    uptimePercent: s.totalChecks > 0 ? ((s.uptimeChecks / s.totalChecks) * 100).toFixed(1) : '0.0'
  })));
});

// GET uptime logs
router.get('/logs', (req, res) => {
  res.json(uptimeLogs.slice(0, 100)); // Last 100 logs
});

// POST — add new service to monitor
router.post('/services', requireAdmin, (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

  const id = Date.now().toString();
  monitoredServices.push({
    id,
    name,
    url,
    currentStatus: 'unknown',
    lastResponseTime: null,
    lastStatusCode: null,
    lastChecked: null,
    uptimeChecks: 0,
    totalChecks: 0
  });

  // Immediately check
  performHealthCheck({ url }).then(result => {
    const svc = monitoredServices.find(s => s.id === id);
    if (svc) {
      svc.currentStatus = result.status;
      svc.lastResponseTime = result.responseTime;
      svc.lastStatusCode = result.statusCode;
      svc.lastChecked = new Date().toISOString();
      svc.totalChecks = 1;
      svc.uptimeChecks = result.status === 'up' ? 1 : 0;
    }
  });

  res.json({ success: true, id });
});

// DELETE — remove a service
router.delete('/services/:id', requireAdmin, (req, res) => {
  monitoredServices = monitoredServices.filter(s => s.id !== req.params.id);
  uptimeLogs = uptimeLogs.filter(l => l.serviceId !== req.params.id);
  res.json({ success: true });
});

// POST — trigger manual check for all services
router.post('/check-now', requireAdmin, async (req, res) => {
  await runAllChecks();
  res.json({ success: true, message: 'All services checked' });
});

module.exports = router;
