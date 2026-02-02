# 🐧 Debian 系統一步一步佈署教學

這份指南將帶領您從零開始，在 Debian 伺服器上架設 **Neuro's Drone Delivery Service**。

> [!IMPORTANT]
> **關於指令輸入說明：**
> - 請複製 **「💻 執行指令」** 框框裡的內容貼入終端機。
> - **不要複製** 框框上方的 ` ```bash ` 或底部的 ` ``` `。
> - 如果看到 `Waiting for cache lock`，表示系統背景正在自動更新，請**等待 1-2 分鐘**後再次嘗試即可。

---

## 第一階段：環境準備 (基礎建設)

### 1. 更新系統與安裝基礎工具
**💻 執行指令：**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx
```

### 2. 安裝 Node.js (核心環境)
我們改用 **Node.js 20 (LTS)** 避免過時警告。
**💻 執行指令：**
```bash
# 加入軟體源 (Node.js 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 開始安裝
sudo apt install -y nodejs
```

### 3. 安裝 PM2 (背景程序管理器)
**💻 執行指令：**
```bash
sudo npm install -g pm2
```

---

## 第二階段：程式碼建置 (準備上路)

### 1. 建立項目目錄
**💻 執行指令：**
```bash
# 建立路徑
sudo mkdir -p /var/www/neuro-drone
sudo chown $USER:$USER /var/www/neuro-drone
```

### 2. 上傳程式碼到伺服器
> [!NOTE]
> **上傳方式選擇：**
> - **方法 A（推薦）**：使用 SFTP/SCP 工具（FileZilla、WinSCP 等）
>   1. 連接到您的 Debian 伺服器
>   2. 將整個 `neuro's-drone-delivery-service-2` 資料夾內的**所有檔案**上傳到 `/var/www/neuro-drone`
>   3. 確保包含：`assets/`、`components/`、`public/`、`utils/`、`server.js`、`package.json` 等所有檔案
> 
> - **方法 B**：使用 Git 克隆
>   **💻 執行指令：**
>   ```bash
>   cd /var/www/neuro-drone
>   git clone https://github.com/wheellessds/neurodronegame.git .
>   ```

### 3. 進入項目目錄
**💻 執行指令：**
```bash
cd /var/www/neuro-drone
```

### 4. 安裝依賴套件
**💻 執行指令：**
```bash
npm install
npm install express
```

### 5. 編譯前端網頁
**💻 執行指令：**
```bash
npm run build
```

> [!WARNING]
> **如果出現 `Could not resolve "./components/XXX"` 錯誤：**
> 
> 這是因為專案需要在本地先修正檔案路徑問題。**建議直接跳過編譯**，使用開發模式運行即可。
> 
> **解決方法：直接跳到第三階段啟動服務即可！**
> 
> <details>
> <summary>📝 進階說明（點擊展開）</summary>
> 
> 這個專案的 `server.js` 會自動處理前端檔案，不需要事先 build。  
> 如果真的需要 production build，需要在本地修正 `App.tsx` 中的 import 路徑後重新推送到 GitHub。
> </details>

---

## 第三階段：啟動服務 (正式運行)

### 1. 啟動後端伺服器
**💻 執行指令：**
```bash
pm2 start server.js --name "neuro-game"
```

### 2. 設置開機自動啟動
**💻 執行指令：**
```bash
pm2 save
pm2 startup
```

---

## 第四階段：Nginx 配置 (讓外界能連接)

### 1. 建立設定檔
**💻 執行指令：**
```bash
sudo nano /etc/nginx/sites-available/neuro-game
```

### 2. 檔案內容
在編輯器中貼上：
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP; 

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 啟用並重啟 Nginx
**💻 執行指令：**
```bash
sudo ln -s /etc/nginx/sites-available/neuro-game /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🎮 第五階段：開始遊戲！

### 訪問您的遊戲
在瀏覽器中輸入：
```
http://您的伺服器IP地址
```

**例如：**
- `http://34.80.123.456`（替換成您實際的 IP）

### 常用管理指令

**查看服務狀態：**
```bash
pm2 status
```

**查看運行日誌：**
```bash
pm2 logs neuro-game
```

**重啟遊戲：**
```bash
pm2 restart neuro-game
```

**停止遊戲：**
```bash
pm2 stop neuro-game
```

---

## 🎉 完成！

您的 **Neuro's Drone Delivery Service** 現在已經上線啦！
