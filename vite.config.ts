import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const leaderboardStoragePlugin = (): Plugin => ({
  name: 'leaderboard-storage',
  configureServer(server) {
    // In-memory room storage for simplicity
    // structure: { id: { name, players, maxPlayers, lastSeen } }
    let activeRooms: Record<string, any> = {};

    server.middlewares.use(async (req, res, next) => {
      const url = req.url || '';

      // --- ROOM LISTING API ---
      if (url.startsWith('/api/rooms')) {
        // GET: List active rooms
        if (req.method === 'GET') {
          const now = Date.now();
          // Filter out rooms not seen in last 10 seconds
          const activeList = Object.values(activeRooms).filter((r: any) => now - r.lastSeen < 10000);

          // Cleanup old rooms
          Object.keys(activeRooms).forEach(key => {
            if (now - activeRooms[key].lastSeen > 10000) delete activeRooms[key];
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(activeList));
          return;
        }

        // POST: Heartbeat / Register
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.id) {
                activeRooms[data.id] = {
                  ...data,
                  lastSeen: Date.now()
                };
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing ID' }));
              }
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }
      }

      // --- LEADERBOARD API ---
      const leaderboardPath = path.resolve(__dirname, 'leaderboard.json');

      if (url.startsWith('/api/leaderboard')) {
        if (req.method === 'GET') {
          let data = [];
          if (fs.existsSync(leaderboardPath)) {
            const content = fs.readFileSync(leaderboardPath, 'utf8');
            try {
              data = JSON.parse(content);
            } catch (e) {
              data = [];
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const newEntry = JSON.parse(body);
              let data = [];
              if (fs.existsSync(leaderboardPath)) {
                data = JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
              }
              data.push(newEntry);
              data.sort((a: any, b: any) => {
                if (b.distance !== a.distance) return b.distance - a.distance;
                return a.time - b.time;
              });
              const limitedData = data.slice(0, 100);
              fs.writeFileSync(leaderboardPath, JSON.stringify(limitedData, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    plugins: [react(), leaderboardStoragePlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
