const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-12345';

const users = {
  [process.env.ADMIN_USERNAME || 'admin']: { password: process.env.ADMIN_PASSWORD || 'admin', role: 'admin' },
  'guest': { password: 'guest', role: 'viewer' }
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users[username];
  if (user && user.password === password) {
    const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, role: user.role });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({ success: false });

  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ success: false });
  }
});

// Middleware to protect routes
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains { username, role }
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  }
};

module.exports = { router, authMiddleware, requireAdmin, JWT_SECRET };
