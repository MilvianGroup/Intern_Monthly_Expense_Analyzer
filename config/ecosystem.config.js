module.exports = {
  apps: [
    {
      name: 'expense-monitor',
      script: 'src/drive_monitor.js',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
        MONITOR_INTERVAL: '2', // Check every 5 minutes in development
      },
    },
  ],
};
