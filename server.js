import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 設置 TypeScript 模組的正確 MIME type
app.use((req, res, next) => {
    if (req.path.endsWith('.tsx') || req.path.endsWith('.ts')) {
        res.type('application/javascript');
    }
    next();
});

// 靜態文件託管（根目錄，不是 dist）
app.use(express.static(__dirname));

// --- 房間管理變數 ---
let activeRooms = {};

// --- 用戶數據與認證 ---
import crypto from 'crypto';
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
// Token -> { username, expires }
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
            money: 0 // 初始金幣
        },
        joinedAt: Date.now()
    };
    saveUsers();

    // 自動登入
    const token = generateToken();
    sessions.set(token, { username, expires: Date.now() + 86400000 }); // 24hr

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
    sessions.set(token, { username, expires: Date.now() + 86400000 }); // 24hr

    res.json({ success: true, token, username, saveData: user.saveData });
});

// --- API: 儲存進度 (僅金幣) ---
app.post('/api/save', (req, res) => {
    const { token, saveData } = req.body;
    const session = sessions.get(token);

    if (!session || session.expires < Date.now()) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { username } = session;
    if (users[username]) {
        // 只更新金幣，防止修改其他不可變數據
        if (typeof saveData.money === 'number') {
            users[username].saveData.money = saveData.money;
            saveUsers();
            res.json({ success: true, savedMoney: users[username].saveData.money });
        } else {
            res.status(400).json({ error: 'Invalid money value' });
        }
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});


// --- API: 房間列表 ---
app.get('/api/rooms', (req, res) => {
    const now = Date.now();
    // 過濾 10 秒內有活動的房間
    const activeList = Object.values(activeRooms).filter((r) => now - r.lastSeen < 10000);

    // 清理舊房間
    Object.keys(activeRooms).forEach(key => {
        if (now - activeRooms[key].lastSeen > 10000) delete activeRooms[key];
    });

    res.json(activeList);
});

// --- API: 房間心跳/註冊 ---
app.post('/api/rooms', (req, res) => {
    const data = req.body;
    if (data.id) {
        activeRooms[data.id] = {
            ...data,
            lastSeen: Date.now()
        };
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Missing ID' });
    }
});

// --- API: 排行榜 ---
const leaderboardPath = path.resolve(__dirname, 'leaderboard.json');

app.get('/api/leaderboard', (req, res) => {
    let data = [];
    if (fs.existsSync(leaderboardPath)) {
        try {
            const content = fs.readFileSync(leaderboardPath, 'utf8');
            data = JSON.parse(content);
        } catch (e) {
            data = [];
        }
    }
    res.json(data);
});

app.post('/api/leaderboard', (req, res) => {
    try {
        const newEntry = req.body;
        let data = [];
        if (fs.existsSync(leaderboardPath)) {
            data = JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
        }
        data.push(newEntry);
        data.sort((a, b) => {
            if (b.distance !== a.distance) return b.distance - a.distance;
            return a.time - b.time;
        });
        const limitedData = data.slice(0, 100);
        fs.writeFileSync(leaderboardPath, JSON.stringify(limitedData, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: 'Invalid Data' });
    }
});

// 所有其他請求返回 index.html (SPA 支持)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
