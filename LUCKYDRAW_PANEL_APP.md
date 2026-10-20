# 外部 LuckyDraw Control App 接駁指南

將現有 Web Panel（`/events/:eventId/luckydraw/panel`）搬到另一個 App 時，請用：

- **Socket.IO**：控制大屏幕動畫／獎品顯示／draw count（唔寫中獎資料）
- **JWT HTTP API**（`/api/ipad/...`）：攞獎品、可抽名單、真正抽獎寫庫

大屏幕（Display）可繼續用現有 luckydraw／Phaser 頁，只需加入同一 room。

---

## 架構總覽

```
[Control App]                    [Server]                    [Display 大屏幕]
     |                              |                              |
     |-- JWT login ---------------->|                              |
     |-- GET prizes --------------->|                              |
     |-- GET available-people ----->|                              |
     |                              |                              |
     |-- Socket join (panel) ------>|--- controller_status ------->|
     |-- Socket prize_selected ---->|--- prize_selected ---------->|
     |-- Socket draw_count -------->|--- draw_count -------------->|
     |-- Socket start ------------->|--- start (動畫) ----------->|
     |                              |                              |
     |-- POST luckydraw / batch --->|--- winner_added ------------>|
     |                              |    (寫 DB + 扣庫存)           |
```

**重點**：Socket **唔會**抽人寫庫；抽獎一定要打 HTTP。成功後 server 會自動 `emit('luckydraw:winner_added')` 給 Display。

---

## 1) 認證

```http
POST /api/ipad/login
Content-Type: application/json

{ "username": "...", "password": "..." }
```

Response：

```json
{
  "token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 604800,
  "user": { "authId": "...", "username": "...", "role": "..." }
}
```

之後所有 HTTP 帶：

```http
Authorization: Bearer <token>
```

---

## 2) Socket 連線（等同現有 Panel）

### 連線

```js
import { io } from 'socket.io-client';

const socket = io('https://your-domain.com', {
  transports: ['websocket', 'polling'],
  // 若跨 domain，server 需開 CORS_ENABLED / CORS_ORIGIN
});

socket.on('connect', () => {
  socket.emit('join_luckydraw', {
    eventId: '<EVENT_ID>',
    type: 'panel', // 必須係 panel，Display 用 'display'
  });
});
```

Room 名稱（server 內部）：`luckydraw:${eventId}`

### Heartbeat（建議保留）

每 15 秒：

```js
socket.emit('luckydraw:heartbeat');
```

聽：

```js
socket.on('luckydraw:heartbeat_ack', () => { /* 更新 lastAck */ });
```

超過約 25 秒冇 ack → `disconnect()` 再 `connect()`，並重新 `join_luckydraw`。

### Panel → Server（你要 emit）

| 事件 | Payload | 作用 |
|------|---------|------|
| `join_luckydraw` | `{ eventId, type: 'panel' }` | 加入 room |
| `luckydraw_panel_prize_selected` | `{ eventId, prizeName, prizeImage }` | 大屏幕顯示所選獎品；清空傳 `null` |
| `luckydraw_panel_draw_count` | `{ eventId, drawCount }` | 同步抽獎數量（會寫入 Game Config） |
| `luckydraw_panel_start` | `{ eventId }` | 通知大屏幕開始動畫 |
| `luckydraw:heartbeat` | （無） | 保活 |

### Server → Panel / Display（你可 listen）

| 事件 | 說明 |
|------|------|
| `luckydraw:controller_status` | `{ status: 'online' \| 'offline' }` |
| `luckydraw:prize_selected` | Display 用；Panel 通常唔使聽 |
| `luckydraw:draw_count` | `{ drawCount }` |
| `luckydraw:start` | Display 開動畫 |
| `luckydraw:winner_added` | `{ winner }`（HTTP 抽獎成功後） |
| `luckydraw:winner_removed` | `{ winnerId }` |
| `luckydraw:all_winners_removed` | 清空 |
| `luckydraw:user_started` | Display 用戶點開始（可選） |
| `luckydraw:heartbeat_ack` | `{ ts }` |

### 建議操作順序（單抽）

1. 用戶選獎 → `luckydraw_panel_prize_selected`
2. （可選）改 draw count → `luckydraw_panel_draw_count`
3. 撳抽獎 → **先** `luckydraw_panel_start`（開動畫）
4. 再 `POST /api/ipad/events/:eventId/luckydraw`（寫中獎）
5. Display 收到 `luckydraw:winner_added` 顯示結果

連抽：步驟 4 改 `POST .../luckydraw/batch`。

---

## 3) 攞 Prize List

```http
GET /api/ipad/events/:eventId/prizes
Authorization: Bearer <token>
```

Response 範例：

```json
[
  {
    "_id": "PRIZE_ID",
    "name": "iPhone",
    "picture": "/prizes/img/....jpg",
    "pictureUrl": "https://your-domain.com/prizes/img/....jpg",
    "unit": 5
  }
]
```

UI 建議：只顯示 `unit > 0` 的獎品。選中後：

```js
socket.emit('luckydraw_panel_prize_selected', {
  eventId,
  prizeName: prize.name,
  prizeImage: prize.pictureUrl || prize.picture || '',
});
```

---

## 4) 攞可抽名單

```http
GET /api/ipad/events/:eventId/luckydraw/available-people
Authorization: Bearer <token>
```

Response：

```json
{
  "count": 12,
  "people": [
    { "_id": "...", "name": "...", "company": "...", "table": "...", "email": "..." }
  ],
  "eligibility": { "enabled": false, "fieldName": "", "value": "" }
}
```

條件（server 已過濾）：

1. `isCheckIn === true`
2. 未在 `event.winners`
3. 若啟用 Page Setting 嘅額外欄位資格 → 欄位值須等於設定值

---

## 5) Draw 功能（HTTP）

### 5a) 單抽／手動指定

```http
POST /api/ipad/events/:eventId/luckydraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "_id": "<userId>",
  "name": "Chan Tai Man",
  "company": "ABC",
  "table": "A1",
  "prizeId": "<prizeId>"
}
```

成功：`201`，body 含 `winner`；並 broadcast `luckydraw:winner_added`。

隨機單抽流程（同現有 Panel）：

1. 從 `available-people` 隨機揀一人
2. `emit luckydraw_panel_start`
3. 打上面 POST
4. 本地名單移除該人、獎品 `unit - 1`

### 5b) 連抽（推薦：由 server 隨機）

```http
POST /api/ipad/events/:eventId/luckydraw/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "count": 3,
  "prizeId": "<prizeId>"
}
```

成功：`201`

```json
{
  "message": "Successfully drew 3 winner(s).",
  "winners": [ /* ... */ ],
  "actualCount": 3,
  "requestedCount": 3
}
```

每個 winner 都會 emit 一次 `luckydraw:winner_added`。

建議先：

```js
socket.emit('luckydraw_panel_start', { eventId });
```

### 5c) 取消中獎

```http
DELETE /api/ipad/events/:eventId/luckydraw
Authorization: Bearer <token>
Content-Type: application/json

{ "_id": "<winnerUserId>" }
```

會還原獎品庫存，並 emit `luckydraw:winner_removed`。

### 5d) 重置 Winner No（可選）

```http
POST /api/ipad/events/:eventId/luckydraw/reset-winner-order
Authorization: Bearer <token>
```

---

## 6) Control App 最小實作清單

1. Login 存 JWT  
2. 選 event（`GET /api/ipad/events`）  
3. Socket connect + `join_luckydraw` type=`panel` + heartbeat  
4. `GET .../prizes` → 下拉選獎 → socket `prize_selected`  
5. `GET .../available-people` → 顯示可抽人數  
6. Draw count input → socket `draw_count`  
7. 抽 1 名／連抽 → socket `start` + HTTP draw/batch  
8. 聽 `winner_added`／更新本地 UI 與庫存  
9. 取消上一名 → HTTP DELETE  

---

## 7) 環境注意

| 項目 | 說明 |
|------|------|
| Base URL | 同後端，例如 `https://your-domain.com` |
| Socket | 同 host；跨域要設 `CORS_ENABLED=true`、`CORS_ORIGIN` |
| JWT | `JWT_SECRET`（正式環境必設） |
| Display | 繼續開現有大屏幕頁即可，唔使改 App |

---

## 8) 同舊 Web Panel 對照

| Web Panel | 外部 App |
|-----------|----------|
| EJS 灌入 `prizes` / `availablePeople` | `GET /api/ipad/.../prizes`、`.../available-people` |
| `socket.io` + `type: 'panel'` | 相同 |
| `POST /events/:id/luckydraw`（session） | `POST /api/ipad/events/:id/luckydraw`（JWT） |
| `POST .../luckydraw/batch` | `POST /api/ipad/events/:id/luckydraw/batch` |
| `DELETE .../luckydraw` | `DELETE /api/ipad/events/:id/luckydraw` |

參考實作：`views/admin/luckydraw_panel.ejs`、`socket.js`、`routes/ipadApi.js`。
