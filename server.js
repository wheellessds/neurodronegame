import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 轉發相容性修正：移除可能的子路徑前綴
app.use((req, res, next) => {
    if (req.url.startsWith('/drone/')) {
        req.url = req.url.replace('/drone/', '/');
    }
    next();
});

// 設置 TypeScript 模組的正確 MIME type
app.use((req, res, next) => {
    if (req.path.endsWith('.tsx') || req.path.endsWith('.ts')) {
        res.type('application/javascript');
    }
    next();
});

// 靜態文件託管（優先使用生產環境編譯出的 dist 目錄）
const distPath = path.resolve(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}
app.use(express.static(__dirname));

// --- 房間管理變數 ---
let activeRooms = {};

// --- 用戶數據與認證 ---
const usersPath = path.resolve(__dirname, 'users.json');
let users = {};

// 載入用戶數據
if (fs.existsSync(usersPath)) {
    try {
        users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (e) {
        console.error("Failed to load users.json", e);
        users = {};
    }
}

// 簡單的 Session 管理 (In-memory)
const sessions = new Map();

function saveUsers() {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

const isAdmin = (token) => {
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) return false;
    const user = users[session.username];
    return user && user.role === 'admin';
};

// --- API: 註冊 ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    if (users[username]) return res.status(400).json({ error: 'User already exists' });

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);

    users[username] = {
        hash,
        salt,
        saveData: {
            money: 0,
            diamonds: 0,
            upgrades: {
                engineLevel: 0,
                tankLevel: 0,
                hullLevel: 0,
                cableLevel: 0,
                cargoLevel: 0
            },
            ownedItems: ['NONE'],
            equippedItem: 'NONE'
        },
        joinedAt: Date.now()
    };
    saveUsers();

    const token = generateToken();
    sessions.set(token, { username, expires: Date.now() + 86400000 });
    res.json({ success: true, token, username, saveData: users[username].saveData });
});

// --- API: 登入 ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user) return res.status(400).json({ error: 'User not found' });

    const hash = hashPassword(password, user.salt);
    if (hash !== user.hash) return res.status(400).json({ error: 'Invalid password' });

    const token = generateToken();
    sessions.set(token, { username, expires: Date.now() + 86400000 });
    res.json({ success: true, token, username, saveData: user.saveData, role: user.role || 'user' });
});

// --- API: 儲存進度 ---
app.post('/api/save', (req, res) => {
    const { token, saveData } = req.body;
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Invalid or expired token' });

    const { username } = session;
    if (users[username]) {
        if (typeof saveData.money === 'number') {
            users[username].saveData.money = saveData.money;
            if (typeof saveData.diamonds === 'number') {
                users[username].saveData.diamonds = saveData.diamonds;
            }
            if (saveData.upgrades) {
                users[username].saveData.upgrades = saveData.upgrades;
            }
            if (saveData.ownedItems) {
                users[username].saveData.ownedItems = saveData.ownedItems;
            }
            if (saveData.equippedItem) {
                users[username].saveData.equippedItem = saveData.equippedItem;
            }
            saveUsers();
            res.json({
                success: true,
                savedMoney: users[username].saveData.money,
                savedDiamonds: users[username].saveData.diamonds,
                savedUpgrades: users[username].saveData.upgrades,
                savedOwnedItems: users[username].saveData.ownedItems,
                savedEquippedItem: users[username].saveData.equippedItem
            });
        } else {
            res.status(400).json({ error: 'Invalid money value' });
        }
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// --- API: Token 驗證 ---
app.post('/api/verify-token', (req, res) => {
    const { token } = req.body;
    const session = sessions.get(token);
    if (session && session.expires > Date.now()) {
        const u = users[session.username];
        if (u) {
            res.json({ success: true, username: session.username, saveData: u.saveData, role: u.role || 'user' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } else {
        res.status(401).json({ error: 'Expired or invalid' });
    }
});

// --- API: 邀請碼兌換 ---
app.post('/api/redeem-code', (req, res) => {
    const { token, code } = req.body;
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Unauthorized' });

    if (code === 'AAA0000') {
        users[session.username].role = 'admin';
        saveUsers();
        res.json({ success: true, role: 'admin' });
    } else {
        res.status(400).json({ error: 'Invalid invite code' });
    }
});

// --- API: ADMIN ---
app.post('/api/admin/delete-entry', (req, res) => {
    const { token, entryIndex } = req.body;
    if (!isAdmin(token)) return res.status(403).json({ error: 'Forbidden' });

    const leaderboardPath = path.resolve(__dirname, 'leaderboard.json');
    if (fs.existsSync(leaderboardPath)) {
        let data = JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
        if (entryIndex >= 0 && entryIndex < data.length) {
            data.splice(entryIndex, 1);
            fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2), 'utf8');
            return res.json({ success: true });
        }
    }
    res.status(400).json({ error: 'Invalid index or data' });
});

app.post('/api/admin/list-users', (req, res) => {
    const { token } = req.body;
    if (!isAdmin(token)) return res.status(403).json({ error: 'Forbidden' });
    const userList = Object.keys(users).map(name => ({
        username: name,
        joinedAt: users[name].joinedAt || 0,
        money: users[name].saveData?.money || 0,
        role: users[name].role || 'user'
    }));
    res.json(userList);
});

app.post('/api/admin/delete-user', (req, res) => {
    const { token, username } = req.body;
    if (!isAdmin(token)) return res.status(403).json({ error: 'Forbidden' });
    if (users[username]) {
        delete users[username];
        saveUsers();
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'User not found' });
});

// --- API: 房間列表 ---
app.get('/api/rooms', (req, res) => {
    const now = Date.now();
    const activeList = Object.values(activeRooms).filter((r) => now - r.lastSeen < 10000);
    Object.keys(activeRooms).forEach(key => {
        if (now - activeRooms[key].lastSeen > 10000) delete activeRooms[key];
    });
    res.json(activeList);
});

app.post('/api/rooms', (req, res) => {
    const data = req.body;
    if (data.id) {
        activeRooms[data.id] = { ...data, lastSeen: Date.now() };
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Missing ID' });
    }
});

// --- API: 排行榜 ---
const lbPath = path.resolve(__dirname, 'leaderboard.json');
app.get('/api/leaderboard', (req, res) => {
    let data = [];
    if (fs.existsSync(lbPath)) {
        try {
            data = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
        } catch (e) { data = []; }
    }
    res.json(data);
});

app.post('/api/leaderboard', (req, res) => {
    try {
        const newEntry = req.body;
        let data = [];
        if (fs.existsSync(lbPath)) data = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
        data.push(newEntry);
        data.sort((a, b) => (b.distance !== a.distance) ? (b.distance - a.distance) : (a.time - b.time));
        fs.writeFileSync(lbPath, JSON.stringify(data.slice(0, 100), null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Invalid Data' }); }
});

app.use((req, res) => {
    // 優先指向 dist/index.html
    const prodFile = path.resolve(__dirname, 'dist', 'index.html');
    if (fs.existsSync(prodFile)) {
        res.sendFile(prodFile);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
