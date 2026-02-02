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
