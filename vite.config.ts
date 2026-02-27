import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const leaderboardStoragePlugin = (): Plugin => ({
  name: 'leaderboard-storage',
  configureServer(server) {
    let activeRooms: Record<string, any> = {};
    const usersPath = path.resolve(__dirname, 'users.json');
    let users: Record<string, any> = {};

    if (fs.existsSync(usersPath)) {
      try {
        users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      } catch (e) {
        users = {};
      }
    }

    const sessions = new Map();

    const saveUsers = () => {
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    };

    const hashPassword = (password: string, salt: string) => {
      return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    };

    const generateToken = () => {
      return crypto.randomBytes(32).toString('hex');
    };

    const isAdmin = (token: string) => {
      const session = sessions.get(token);
      if (!session || session.expires < Date.now()) return false;
      const user = users[session.username];
      return user && user.role === 'admin';
    };

    server.middlewares.use(async (req, res, next) => {
      const url = req.url || '';

      // --- AUTH API ---
      if (url === '/api/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { username, password } = JSON.parse(body);
            if (!username || !password) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing fields' }));
              return;
            }
            if (users[username]) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'User already exists' }));
              return;
            }
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = hashPassword(password, salt);
            users[username] = {
              hash,
              salt,
              saveData: { money: 0, diamonds: 0 },
              joinedAt: Date.now()
            };
            saveUsers();
            const token = generateToken();
            sessions.set(token, { username, expires: Date.now() + 86400000 });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, token, username, saveData: users[username].saveData }));
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { username, password } = JSON.parse(body);
            const user = users[username];
            if (!user) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'User not found' }));
              return;
            }
            const hash = hashPassword(password, user.salt);
            if (hash !== user.hash) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid password' }));
              return;
            }
            const token = generateToken();
            sessions.set(token, { username, expires: Date.now() + 86400000 });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, token, username, saveData: user.saveData, role: user.role || 'user' }));
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { token, saveData } = JSON.parse(body);
            const session = sessions.get(token);
            if (!session || session.expires < Date.now()) {
              res.statusCode = 401; res.end(JSON.stringify({ error: 'Invalid or expired token' }));
              return;
            }
            const { username } = session;
            if (users[username]) {
              if (typeof saveData.money === 'number') {
                users[username].saveData.money = saveData.money;
                if (typeof saveData.diamonds === 'number') {
                  users[username].saveData.diamonds = saveData.diamonds;
                }
                saveUsers();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, savedMoney: users[username].saveData.money, savedDiamonds: users[username].saveData.diamonds }));
              } else {
                res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid money value' }));
              }
            } else {
              res.statusCode = 404; res.end(JSON.stringify({ error: 'User not found' }));
            }
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/verify-token' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { token } = JSON.parse(body);
            const session = sessions.get(token);
            if (session && session.expires > Date.now()) {
              const u = users[session.username];
              if (u) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, username: session.username, saveData: u.saveData, role: u.role || 'user' }));
              } else {
                res.statusCode = 404; res.end(JSON.stringify({ error: 'User not found' }));
              }
            } else {
              res.statusCode = 401; res.end(JSON.stringify({ error: 'Session expired or invalid' }));
            }
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/redeem-code' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { token, code } = JSON.parse(body);
            const session = sessions.get(token);
            if (!session || session.expires < Date.now()) {
              res.statusCode = 401; res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }
            if (code === 'AAA0000') {
              users[session.username].role = 'admin';
              saveUsers();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, role: 'admin' }));
            } else {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid invite code' }));
            }
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Bad Request' }));
          }
        });
        return;
      }

      // --- ADMIN API ---
      if (url === '/api/check-name' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { username } = JSON.parse(body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ exists: !!users[username] }));
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/admin/delete-entry' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { token, entryIndex } = JSON.parse(body);
            if (!isAdmin(token)) {
              res.statusCode = 403; res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }
            const dataPath = path.resolve(__dirname, 'leaderboard.json');
            if (fs.existsSync(dataPath)) {
              let data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
              if (entryIndex >= 0 && entryIndex < data.length) {
                data.splice(entryIndex, 1);
                fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
                return;
              }
            }
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid index or data' }));
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/admin/list-users' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { token } = JSON.parse(body);
            if (!isAdmin(token)) {
              res.statusCode = 403; res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }
            const userList = Object.keys(users).map(name => ({
              username: name,
              joinedAt: users[name].joinedAt || 0,
              money: users[name].saveData?.money || 0,
              role: users[name].role || 'user'
            }));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(userList));
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      if (url === '/api/admin/delete-user' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { token, username } = JSON.parse(body);
            if (!isAdmin(token)) {
              res.statusCode = 403; res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }
            if (users[username]) {
              delete users[username];
              saveUsers();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 404; res.end(JSON.stringify({ error: 'User not found' }));
            }
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Request' }));
          }
        });
        return;
      }

      // --- ROOMS API ---
      if (url.startsWith('/api/rooms')) {
        if (req.method === 'GET') {
          const now = Date.now();
          const activeList = Object.values(activeRooms).filter((r: any) => now - r.lastSeen < 10000);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(activeList));
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.id) {
                activeRooms[data.id] = { ...data, lastSeen: Date.now() };
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } else {
                res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing ID' }));
              }
            } catch (e) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }
      }

      // --- LEADERBOARD API ---
      const lbPath = path.resolve(__dirname, 'leaderboard.json');
      if (url.startsWith('/api/leaderboard')) {
        if (req.method === 'GET') {
          let data = [];
          if (fs.existsSync(lbPath)) data = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
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
              if (fs.existsSync(lbPath)) data = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
              data.push(newEntry);
              data.sort((a: any, b: any) => (b.distance !== a.distance) ? (b.distance - a.distance) : (a.time - b.time));
              fs.writeFileSync(lbPath, JSON.stringify(data.slice(0, 100), null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid JSON' }));
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
    base: '/drone/',
    server: { port: 3000, host: '0.0.0.0', allowedHosts: true },
    plugins: [react(), leaderboardStoragePlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
    },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } }
  };
});
// Force restart to reload users.json
