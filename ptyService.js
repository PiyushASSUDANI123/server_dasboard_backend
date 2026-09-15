const pty = require('node-pty');
const os = require('os');

const ptyInstances = {};

const initPtySocket = (io) => {
  io.on('connection', (socket) => {
    // Only allow authenticated users to spawn a terminal
    socket.on('spawn_terminal', (token) => {
      // Basic token check (in a real app, verify properly before spawning)
      if (!token) return socket.emit('terminal_error', 'Authentication required');

      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
      
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: process.env
      });

      ptyInstances[socket.id] = ptyProcess;

      ptyProcess.onData((data) => {
        socket.emit('terminal_data', data);
      });

      socket.on('terminal_input', (data) => {
        ptyProcess.write(data);
      });

      socket.on('terminal_resize', (size) => {
        if (size && size.cols && size.rows) {
          try { ptyProcess.resize(size.cols, size.rows); } catch (e) {}
        }
      });

      socket.on('disconnect', () => {
        if (ptyInstances[socket.id]) {
          ptyInstances[socket.id].kill();
          delete ptyInstances[socket.id];
        }
      });
    });
  });
};

module.exports = { initPtySocket };
