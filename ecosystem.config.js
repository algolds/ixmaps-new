// /wiki/prod/v14/projects/ixmaps/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'ixmaps',
      cwd: '/wiki/prod/v14/projects/ixmaps', // Project root directory
      script: 'node_modules/.bin/next', // More direct path to next executable
      args: 'start -p 3003', // Use '-p' to specify the port
      exec_mode: 'cluster',
      instances: 'max',
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/ixmaps-err.log', // Relative to cwd
      out_file: './logs/ixmaps-out.log', // Relative to cwd
      merge_logs: true,
      env_production: {
        // --- VITAL ---
        NODE_ENV: 'production', // Tells next.config.js to use production settings
        PORT: 3003, // Port Next.js listens on (matches args)

        // --- Production Environment Variables ---
        // Load sensitive variables from the server environment if possible
        // Or define them here (less secure for secrets)
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://ixmapsuser:ghantisghont448@localhost:5432/ixmapsdb?schema=public', // Example: prefer server env

        // --- CRITICAL for Auth ---
        // This MUST be the public URL where your app is accessed
        NEXTAUTH_URL:
          process.env.NEXTAUTH_URL || 'https://ixwiki.com/projects/ixmaps',
        AUTH_SECRET: process.env.AUTH_SECRET, // Load from server env!
        AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID, // Load from server env!
        AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET, // Load from server env!
        AUTH_TRUST_HOST: 'true', // Or configure properly if behind specific proxy

        // --- Clerk Vars (Load from server env!) ---
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
        CLERK_WEBHOOK_SIGNING_SECRET:
          process.env.CLERK_WEBHOOK_SIGNING_SECRET,

        // NEXT_PUBLIC_BASE_PATH is not strictly needed here if next.config.js handles it
      },
    },
  ],
  // deploy section omitted for brevity
};
