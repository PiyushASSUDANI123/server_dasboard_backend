const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const { router: authRouter } = require('./routes/auth');
const systemRouter = require('./routes/system');
const filesRouter = require('./routes/files');
const dockerRouter = require('./routes/docker');
const cronRouter = require('./routes/cron');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/system', systemRouter);
app.use('/api/files', filesRouter);
app.use('/api/docker', dockerRouter);
app.use('/api/cron', cronRouter);

const { initPtySocket } = require('./ptyService');

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

initPtySocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`ServerOS Backend running on port ${PORT}`);
});
