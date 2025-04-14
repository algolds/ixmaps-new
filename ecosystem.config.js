// /wiki/prod/v14/projects/ixmaps/ecosystem.config.js
module.exports = {
    apps: [
      {
        name: 'ixmaps', // Application name displayed in PM2
        cwd: '/wiki/prod/v14/projects/ixmaps', // Set the current working directory
        script: 'npm', // Use npm to run the start script
        args: 'start', // Arguments to pass to the script (npm run start)
        exec_mode: 'cluster', // Enable cluster mode for Node.js apps
        instances: 'max', // Use max available CPUs (or specify a number)
        watch: false, // Do NOT watch for file changes in production
        max_memory_restart: '512M', // Restart if memory exceeds 512MB (adjust as needed)
        log_date_format: 'YYYY-MM-DD HH:mm:ss', // Format for logs
        error_file: './logs/ixmaps-err.log', // Path to error log
        out_file: './logs/ixmaps-out.log', // Path to standard output log
        merge_logs: true, // Merge logs from all instances
        env_production: {
          // Environment variables for production
          NODE_ENV: 'production',
          PORT: 3003, // Default Next.js port, change if your app uses a different one
          // --- IMPORTANT ---
          // Add ALL other required production environment variables here
          // Example:
          // DATABASE_URL: process.env.DATABASE_URL, // Best practice: Load from server env
          // NEXTAUTH_URL: process.env.NEXTAUTH_URL,
          // NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
          // API_KEY: process.env.API_KEY
          // Ensure these variables are actually available in the environment
          // where you run `pm2 start` or define them directly here (less secure for secrets)
        },
      },
    ],
  
    // Optional: Deployment configuration (if using pm2 deploy)
    // deploy : {
    //   production : {
    //     user : 'SSH_USERNAME',
    //     host : 'SSH_HOSTMACHINE',
    //     ref  : 'origin/main',
    //     repo : 'GIT_REPOSITORY',
    //     path : '/wiki/prod/v14/projects/ixmaps', // Destination path on the server
    //     'pre-deploy-local': '',
    //     'post-deploy' : 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    //     'pre-setup': ''
    //   }
    // }
  };
  