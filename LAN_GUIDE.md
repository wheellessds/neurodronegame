# 局域網遊玩與連線排除指南

根據系統檢查，您的電腦 IP 地址為：**`192.168.1.106`**

## 📱 手機連線步驟

1. 確保手機與電腦連接在**同一個 Wi-Fi** 下。
2. 在手機瀏覽器輸入：
   ```
   http://192.168.1.106:3000
   ```

---

## 🛠️ 連不上？常見問題排除

### 1. 檢查網路類型 (務必設定為「私用」)
如果您的網路被 Windows 判定為「公用 (Public)」，所有連線都會被擋住。
- 打開「設定」>「網路和網際網路」。
- 點擊「內容」或「狀態」。
- 確保 **「網路設定檔」** 選項是勾選在 **「私用 (Private)」**。

### 2. Windows 防火牆設定
如果還是連不上，請嘗試手動允許端口：
1. 按下 `Win + R`，輸入 `control` 開啟控制台。
2. 前往「系統與安全性」>「Windows Defender 防火牆」。
3. 點擊左側的「允許應用程式或功能通過 Windows Defender 防火牆」。
4. 點擊「變更設定」，找到與 **Node.js** 或 **Vite** 相關的項目。
5. 確保其右側的 **「專用 (Private)」** 欄位已被勾選。

### 3. 進階：解決「電腦連不上手機」 (WebRTC 隱私限制)
現代瀏覽器（特別是電腦端 Chrome）預設會隱藏本地 IP 以保護隱私（mDNS），這常導致跨平台 P2P 失敗。
**解決方案：**
1. 在電腦 Chrome 網址列輸入：`chrome://flags/#enable-webrtc-hide-local-ips-with-mdns`
2. 將該選項設定為 **Disabled**。
3. 重啟 Chrome 後再試。

### 4. 使用管理員權限完全開放 UDP (針對電腦作為房主)
多人連線依賴 **UDP** 協議。如果防火牆只開了 3000 (TCP)，連線仍會失敗。
請以 **管理員身分** 執行此 PowerShell 指令來開放瀏覽器的 P2P 通道：
```powershell
# 開放 Chrome 瀏覽器的 UDP 訪問
New-NetFirewallRule -DisplayName "Neuro Game P2P" -Direction Inbound -Protocol UDP -Action Allow
```

---

## 當前配置
- **IP 地址**: 192.168.1.106
- **連接埠**: 3000
- **開發伺服器**: Vite (已配置允許外部訪問)
