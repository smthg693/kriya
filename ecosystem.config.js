module.exports = {
  apps: [
    {
      name: 'gram-sahayak-web',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'gram-sahayak-nlu',
      script: 'python',
      args: '-m uvicorn nlu_service.main:app --host 0.0.0.0 --port 8000',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
