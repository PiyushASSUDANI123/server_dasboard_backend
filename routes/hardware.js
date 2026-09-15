const express = require('express');
const router = express.Router();
const si = require('systeminformation');
const { exec } = require('child_process');
const { authMiddleware } = require('./auth');

router.use(authMiddleware);

// Storage: All partitions with breakdown
router.get('/storage', async (req, res) => {
  try {
    const fsSize = await si.fsSize();
    const disks = fsSize.map(d => ({
      fs: d.fs,
      mount: d.mount,
      type: d.type,
      size: d.size,
      used: d.used,
      available: d.available,
      usePercent: d.use
    }));
    res.json(disks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disk I/O
router.get('/diskio', async (req, res) => {
  try {
    const diskIO = await si.disksIO();
    res.json({
      rIO: diskIO.rIO,
      wIO: diskIO.wIO,
      tIO: diskIO.tIO,
      rIO_sec: diskIO.rIO_sec,
      wIO_sec: diskIO.wIO_sec,
      tIO_sec: diskIO.tIO_sec
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CPU Temperature & Sensors
router.get('/sensors', async (req, res) => {
  try {
    const [cpuTemp, cpuInfo, battery] = await Promise.all([
      si.cpuTemperature(),
      si.cpu(),
      si.battery()
    ]);

    // Try to get fan speed from lm-sensors (Linux)
    let fans = [];
    try {
      const fanData = await new Promise((resolve, reject) => {
        exec('sensors -j 2>/dev/null || echo "{}"', (err, stdout) => {
          if (err) return resolve({});
          try { resolve(JSON.parse(stdout)); } catch (e) { resolve({}); }
        });
      });
      // Parse fan data from sensors JSON output
      for (const chip of Object.values(fanData)) {
        if (typeof chip === 'object') {
          for (const [key, val] of Object.entries(chip)) {
            if (key.toLowerCase().includes('fan') && typeof val === 'object') {
              for (const [fanKey, fanVal] of Object.entries(val)) {
                if (typeof fanVal === 'number') {
                  fans.push({ name: key, rpm: fanVal });
                }
              }
            }
          }
        }
      }
    } catch (e) { /* lm-sensors not available */ }

    res.json({
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        speed: cpuInfo.speed
      },
      temperature: {
        main: cpuTemp.main,
        cores: cpuTemp.cores,
        max: cpuTemp.max
      },
      fans,
      battery: {
        hasBattery: battery.hasBattery,
        percent: battery.percent,
        isCharging: battery.isCharging,
        timeRemaining: battery.timeRemaining
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Network interfaces
router.get('/network', async (req, res) => {
  try {
    const [netInterfaces, netStats] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats()
    ]);
    res.json({
      interfaces: netInterfaces.filter(i => !i.internal).map(i => ({
        iface: i.iface,
        ip4: i.ip4,
        ip6: i.ip6,
        mac: i.mac,
        type: i.type,
        speed: i.speed,
        operstate: i.operstate
      })),
      stats: netStats.map(s => ({
        iface: s.iface,
        rx_bytes: s.rx_bytes,
        tx_bytes: s.tx_bytes,
        rx_sec: s.rx_sec,
        tx_sec: s.tx_sec
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
