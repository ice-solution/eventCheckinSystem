# Socket.IO 與 LuckyDraw 運作說明

## 一、Socket.IO 如何啟動

1. **app.js**
   - 使用 `http.createServer(app)` 建立 HTTP server。
   - 呼叫 `initSocket(server)`，把同一個 server 交給 Socket.IO 綁定。
   - 因此 **HTTP 與 WebSocket 共用同一個 port**（例如 3377），前端連線 `io()` 會連到同一網域。

2. **socket.js**
   - `initSocket(server)` 建立 `socketIo(server, { cors: socketCors })`。
   - **CORS** 與 app.js 一致：由 `.env` 的 `CORS_ENABLED`、`CORS_ORIGIN` 控制，方便跨域（例如 luckydraw 顯示頁在另一 domain）連線。

3. **前端**
   - 引入 `<script src="/socket.io/socket.io.js"></script>`，再 `const socket = io();` 即可連上同一 host 的 Socket.IO。

---

## 二、LuckyDraw 的 Room 機制

- 每個「活動」用一個 **room** 區隔：`luckydraw:${eventId}`。
- **Panel（控制面板）** 與 **Display（顯示頁／Phaser 遊戲）** 都要先 `emit('join_luckydraw', { eventId, type: 'panel' | 'display' })`，服務端會把該 socket 加入對應 room。
- 之後所有與該活動相關的廣播都是 `io.to(room).emit(...)`，只有同一個 eventId 的客戶端會收到。

---

## 三、現有 Socket 事件一覽

| 事件名稱（前端 → 後端） | 發送者 | 說明 |
|------------------------|--------|------|
| `join_luckydraw`       | Panel / Display | 加入 room，並標記 type（panel / display） |
| `luckydraw_panel_start` | Panel | 通知「開始抽獎動畫」 |
| `luckydraw_panel_prize_selected` | Panel | 通知「已選獎品」（含 prizeName、prizeImage） |
| `luckydraw_panel_draw_count` | Panel | 通知「Draw count 變更」（見下節） |
| `luckydraw:user_start_click` | Display | 用戶點擊開始按鈕 |
| `vote_submitted`       | 投票頁 | 投票提交（與 LuckyDraw 無關） |

| 事件名稱（後端 → 前端） | 接收者 | 說明 |
|------------------------|--------|------|
| `luckydraw:controller_status` | 同 room | 控制器上線／離線 |
| `luckydraw:start`      | 同 room（Display） | 開始抽獎動畫 |
| `luckydraw:prize_selected` | 同 room | 獎品已選（含 prizeName、prizeImage） |
| **`luckydraw:draw_count`** | 同 room | **Draw count 變更**（見下節） |
| `luckydraw:user_started` | 同 room（Panel） | 用戶已點開始 |
| `luckydraw:winner_added` 等 | 同 room | 中獎者增刪（由 HTTP API 觸發、後端 emit） |

---

## 四、Draw count 與 Socket 通知

### 流程

1. **Panel（luckydraw_panel.ejs）**
   - Draw count 的 input（`#drawCount`）在 **數值一改動** 時（blur / change / 輸入時 debounce）會：
     - 將值正規化為 ≥1 的整數；
     - `socket.emit('luckydraw_panel_draw_count', { eventId, drawCount: count })`。
2. **後端（socket.js）**
   - 收到 `luckydraw_panel_draw_count` 後：
     - **會先把 `drawCount` 寫入 `LuckydrawGameConfig.config.draw.drawCount`**（與 Game Config API 一致），Phaser 顯示頁若依 config 建槽位，才不會卡在預設 10。
     - 再以 `eventId` 找到 room，`io.to(room).emit('luckydraw:draw_count', { drawCount })`。
   - **Display 加入 room 時** 會依 DB 內目前 `draw.drawCount` 再 `socket.emit('luckydraw:draw_count')` 一次，晚開的畫面也能對齊。
3. **Display（events/luckydraw.ejs 或 Phaser 頁）**
   - 監聽 `luckydraw:draw_count`，更新 `currentDrawCount` 與 `window.luckydrawDrawCount`，供畫面或遊戲使用。

### 前端如何使用 Draw count

- **同頁 script**：使用變數 `currentDrawCount` 或 `window.luckydrawDrawCount`。
- **iframe / 另一頁**：可讀 `window.parent.luckydrawDrawCount`（若同源）。
- **Phaser 獨立頁**：需自行連 Socket 並訂閱 `luckydraw:draw_count`。

---

## 五、Heartbeat 與防靜默斷線

為避免使用者閒置過久導致 **靜默斷線** 或 **僵屍連線**（TCP 已斷但兩端未即時得知），系統做了兩層保活：

### 1. Socket.IO 底層 ping/pong

- 服務端在 `socket.js` 初始化時設定 **pingInterval**（預設 10 秒）、**pingTimeout**（預設 8 秒），比 Socket.IO 預設值更短，可較快偵測到死連線。
- 可選環境變數：`SOCKET_PING_INTERVAL`、`SOCKET_PING_TIMEOUT`（單位 ms），見 `ENV_CONFIGURATION.md`。

### 2. 應用層 heartbeat（LuckyDraw Panel / Display）

- **客戶端**（Panel 與 Display 頁）每約 **15 秒** 發送一次 `luckydraw:heartbeat`。
- **服務端** 收到後立即回傳 `luckydraw:heartbeat_ack`（帶 `ts`）。
- 客戶端若超過 **25 秒** 未收到 ack 且仍自認為已連線，會主動 `disconnect()` 再 `connect()` 以強制重連並重新 `join_luckydraw`。

| 事件（客戶端 → 服務端） | 說明 |
|------------------------|------|
| `luckydraw:heartbeat`  | 客戶端定時發送，用於保活與偵測靜默斷線 |

| 事件（服務端 → 客戶端） | 說明 |
|------------------------|------|
| `luckydraw:heartbeat_ack` | 服務端回應心跳，客戶端據此更新「最後存活時間」 |

---

## 六、小結

- Socket.IO 與 Express 共用同一個 HTTP server，由 `socket.js` 的 `initSocket(server)` 初始化，CORS 與 app 一致。
- LuckyDraw 以 `luckydraw:${eventId}` 為 room，Panel 與 Display 先 join 再收發事件。
- **Draw count 一改動就會透過 `luckydraw_panel_draw_count` → `luckydraw:draw_count` 通知同 room 的前端**，無需重新整理頁面。
- **Heartbeat** 可維持長時間閒置下的連線，並在靜默斷線後自動重連。
