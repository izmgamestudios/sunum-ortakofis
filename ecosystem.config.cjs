// ecosystem.config.cjs — PM2 process definition
module.exports = {
  apps: [
    {
      name: 'teknodoz-sunum',
      script: 'dist-server/index.js',
      cwd: __dirname,
      instances: 1, // Socket.IO rooms are in-memory → keep a single process
      exec_mode: 'fork',
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'production',
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || 3001,
      },
    },
  ],
};
