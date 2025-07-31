# IxMaps Interactive Mapping System

A modern, full-featured mapping platform for IxWiki, built with React, Next.js, and Leaflet. Includes advanced map editing, custom projections, and robust server management.

---

## 🚀 Features
- Interactive map visualization with Leaflet.js
- Custom coordinate system with grid and prime meridian
- Layer management for different map features
- Distance calculation tools
- Responsive design with SSR support
- API routes for map data
- PostgreSQL/Prisma integration
- Robust process management with PM2

---

## ⚡ Quick Start

### 1. **Navigate to Project & Install**
```bash
cd /ixwiki/public/maps/ixmaps-new
npm install
```

### 2. **Initial Setup**
```bash
node setup.js
```
- Follows prompts to configure database, authentication, and environment variables.
- Automatically starts PostgreSQL with Docker Compose if selected.
- Creates `.env.local` file with your configuration.

### 3. **Configure Environment (Alternative)**
- **Database Setup:** Use the included Docker Compose for PostgreSQL:
  ```bash
  docker compose up -d
  ```
- **Environment Variables:** Set required secrets as environment variables (see ecosystem.config.js):
  ```bash
  export DATABASE_URL="postgresql://ixmapsuser:ghantisghont448@localhost:5432/ixmapsdb?schema=public"
  export AUTH_SECRET="your-auth-secret"
  export AUTH_DISCORD_ID="your-discord-id"
  export AUTH_DISCORD_SECRET="your-discord-secret"
  export CLERK_SECRET_KEY="your-clerk-secret"
  export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
  ```

### 4. **Database Setup**
```bash
npm run prisma:dev
```
- Runs migrations and seeds the database.

### 5. **Build & Start the App (PM2)**
```bash
npm run build
pm2 start ecosystem.config.js --env production
```

**Note:** PM2 runs a single instance (not cluster mode) for optimal resource usage.

---

## 🛠️ Management Commands (PM2)
```bash
pm2 start ecosystem.config.js      # Start app
pm2 stop ixmaps                   # Stop app  
pm2 restart ixmaps                # Restart app
pm2 reload ixmaps                 # Graceful restart
pm2 status                        # Show all processes
pm2 logs ixmaps                   # Live logs
pm2 monit                         # Real-time monitor
```

---

## 🌐 API Endpoints
- **Web App:** `http://localhost:3003` (default port)
- **API Routes:** `/api/*` (see `/src/app/api`)
- **Health Check:** Next.js responds if running (no explicit `/health` endpoint)
- **Default Port:** `3003` (set via `PORT` env var or ecosystem config)

---

## 📁 Important Paths
- **App Directory:** `/ixwiki/public/maps/ixmaps-new/`
- **Config Files:** `ecosystem.config.js`, `next.config.js`
- **PM2 Config:** `/ixwiki/public/maps/ixmaps-new/ecosystem.config.js`
- **Logs:** `/ixwiki/public/maps/ixmaps-new/logs/ixmaps-*.log`
- **Database:** PostgreSQL via Docker Compose

---

## 🧑‍💻 Troubleshooting
```bash
pm2 describe ixmaps               # Detailed info
pm2 logs ixmaps --err             # Error logs only
curl http://localhost:3003        # Test web server
pm2 monit                         # Check memory usage
pm2 restart ixmaps                # Restart if needed
```

- **App not responding?** Check logs and database connection.
- **Database errors?** Ensure PostgreSQL is running: `docker compose ps`
- **Environment errors?** Run `node setup.js` to configure missing variables.
- **Port in use?**
  ```bash
  netstat -tlnp | grep 3003
  lsof -i :3003
  ```
- **Build errors?** Check Node.js version (requires 14.x+)

---

## 🔄 Auto-Startup (One-time setup)
```bash
pm2 startup                        # Generate startup script
# Run the sudo command it shows you
pm2 save                          # Save current processes
```

---

## 🚨 Emergency Commands
```bash
pm2 delete ixmaps                  # Remove from PM2
pm2 start ecosystem.config.js      # Fresh start
pm2 kill                           # Kill PM2 daemon
pm2 resurrect                      # Restore saved processes
```

---

## 🛡️ Security & Contribution
- **Never commit your secrets or environment variables.**
- Database credentials and auth secrets are in `.gitignore` by default.
- For contributions, open a pull request and follow project guidelines.

---

## 📚 Further Reading
- [Next.js Documentation](https://nextjs.org/)
- [Leaflet.js Documentation](https://leafletjs.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)

---

**Maintained by the IxWiki Team.**