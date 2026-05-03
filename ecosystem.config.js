module.exports = {
  apps: [
    {
      name: "salonista",
      cwd: "/home/ubuntu/salonista",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/home/ubuntu/.pm2/logs/salonista-error.log",
      out_file: "/home/ubuntu/.pm2/logs/salonista-out.log",
      time: true,
    },
  ],
};
