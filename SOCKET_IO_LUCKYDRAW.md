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
   - 收到 `luckydraw_panel_draw_count` 後，以 `eventId` 找到 room，再：
     - `io.to(room).emit('luckydraw:draw_count', { drawCount })`。
3. **Display（events/luckydraw.ejs 或 Phaser 頁）**
   - 監聽 `luckydraw:draw_count`，更新 `currentDrawCount` 與 `window.luckydrawDrawCount`，供畫面或遊戲使用。

### 前端如何使用 Draw count

- **同頁 script**：使用變數 `currentDrawCount` 或 `window.luckydrawDrawCount`。
- **iframe / 另一頁**：可讀 `window.parent.luckydrawDrawCount`（若同源）。
- **Phaser 獨立頁**：需自行連 Socket 並訂閱 `luckydraw:draw_count`。

---

## 五、小結

- Socket.IO 與 Express 共用同一個 HTTP server，由 `socket.js` 的 `initSocket(server)` 初始化，CORS 與 app 一致。
- LuckyDraw 以 `luckydraw:${eventId}` 為 room，Panel 與 Display 先 join 再收發事件。
- **Draw count 一改動就會透過 `luckydraw_panel_draw_count` → `luckydraw:draw_count` 通知同 room 的前端**，無需重新整理頁面。
