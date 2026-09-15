const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin } = require('./auth');
const cron = require('node-cron');
const { exec } = require('child_process');

router.use(authMiddleware);

// In a real app, you would store these in a database (SQLite/Postgres).
// For this dashboard, we store them in memory and they're lost on restart.
let jobs = [];

router.get('/', (req, res) => {
  res.json(jobs.map(j => ({
    id: j.id,
    name: j.name,
    schedule: j.schedule,
    command: j.command,
    status: j.status,
    lastRun: j.lastRun
  })));
});

router.post('/', requireAdmin, (req, res) => {
  const { name, schedule, command } = req.body;
  
  if (!cron.validate(schedule)) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }

  const id = Date.now().toString();
  
  const task = cron.schedule(schedule, () => {
    const jobIndex = jobs.findIndex(j => j.id === id);
    if (jobIndex > -1) {
      jobs[jobIndex].lastRun = new Date().toISOString();
    }
    
    // Execute the command in the background
    exec(command, (error, stdout, stderr) => {
      if (error) console.error(`Cron error (${name}):`, error);
    });
  });

  jobs.push({
    id,
    name,
    schedule,
    command,
    status: 'running',
    task
  });

  res.json({ success: true, id });
});

router.post('/:id/stop', requireAdmin, (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (job) {
    job.task.stop();
    job.status = 'stopped';
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

router.post('/:id/start', requireAdmin, (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (job) {
    job.task.start();
    job.status = 'running';
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  const jobIndex = jobs.findIndex(j => j.id === req.params.id);
  if (jobIndex > -1) {
    jobs[jobIndex].task.stop();
    jobs.splice(jobIndex, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

module.exports = router;
