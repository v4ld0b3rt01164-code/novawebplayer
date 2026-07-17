module.exports = {
  apps: [
    {
      name: 'nova-web-player',
      script: './dist/index.js',
      cwd: '/opt/nova-web-player/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '500M',
      watch: false,
      // Reinicia se a saída do healthcheck falhar
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}
