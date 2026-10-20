# iPad API（JWT）呼叫文件

供 iPad / kiosk / 手機 App 使用的 RESTful API。  
文件對照程式：`routes/ipadApi.js`（`phoebe_version`，2026-10）。

## 現有功能一覽

| 分類 | Method | Endpoint | 說明 |
|------|--------|----------|------|
| 認證 | `POST` | `/api/ipad/login` | 後台帳號登入，取得 JWT（7 天） |
| 活動 | `GET` | `/api/ipad/events` | 可存取活動列表（`_id`、`name`） |
| 用戶 | `GET` | `/api/ipad/events/:eventId/users` | 活動下全部用戶 |
| 用戶 | `GET` | `/api/ipad/events/:eventId/users/:userId` | 單一用戶完整資料 |
| 用戶 | `PUT` | `/api/ipad/events/:eventId/users/:userId` | 進場簽到／取消簽到／改個人資料 |
| 用戶 | `POST` | `/api/ipad/events/:eventId/users` | 依 FormConfig 現場新增用戶 |
| 用戶 | `DELETE` | `/api/ipad/events/:eventId/users/:userId` | 刪除用戶 |
| 表單 | `GET` | `/api/ipad/events/:eventId/registration-config` | 報名／現場表單設定（FormConfig） |
| 徽章 | `GET` | `/api/ipad/events/:eventId/badge-config` | 徽章設計設定（不含 `testImageUrl`） |
| 徽章 | `PUT` | `/api/ipad/events/:eventId/badge-config` | 更新徽章設定 |
| 徽章 | `DELETE` | `/api/ipad/events/:eventId/badge-config/elements/:elementId` | 刪除徽章元素 |
| 徽章 | `GET` | `/api/ipad/events/:eventId/users/:userId/badge` | 依用戶資料生成徽章圖 |
| 分站 | `GET` | `/api/ipad/events/:eventId/stations` | 分站列表 |
| 分站 | `GET` | `/api/ipad/events/:eventId/stations/:stationId/checkins` | 某分站簽到記錄 |
| 分站 | `POST` | `/api/ipad/events/:eventId/stations/:stationId/checkin` | 分站簽到 |
| 分站 | `DELETE` | `/api/ipad/events/:eventId/stations/:stationId/checkin/:userId` | 取消分站簽到 |
| 分站 | `POST` | `/api/ipad/events/:eventId/stations/:stationId/uncheck` | 取消分站簽到（body 傳 `userId`） |
| 分站 | `GET` | `/api/ipad/events/:eventId/users/:userId/station-checkins` | 某用戶各分站狀態 |

**不在本 API 內**（請勿假設有這些 JWT 端點）：

- 抽獎／中獎者 CRUD（抽獎用後台頁 + Socket.IO，非 `/api/ipad`）
- 列印硬體控制（見 Printer Bridge）
- 公開報名頁 `/web/.../register`（無需 JWT）

## Postman

專案內：`docs/iPad_API.postman_collection.json`  
匯入後先跑「1) 登入」，把 `token`、`eventId`、`userId`（及分站用的 `stationId`）填入 Collection 變數。

## Base URL

- 本機：`http://localhost:3377`
- 正式：改成你的網域（例如 `https://your-domain.com`）

## 通用規則

### Header

除 `POST /login` 外，全部需要：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### 權限

- `admin`：可存取全部活動
- 非 `admin`：以 Auth 的 **`allowedEvents`** 為準（與後台 `/events/list` 一致）；若活動 `owner` 等於該帳號亦允許（向後相容）
- 無權限：`403 Forbidden`

### 環境變數

- `JWT_SECRET`：JWT 簽名用（正式環境必設強密鑰）
- 未設定時暫用 `'events'`（不建議用於正式環境）

---

## 1) 登入取得 JWT

### URL

`POST /api/ipad/login`

### Body（JSON）

- `username`: 後台帳號（Auth）
- `password`: 後台密碼（Auth）

### curl

```bash
curl -X POST "http://localhost:3377/api/ipad/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin_password"
  }'
```

### Response（成功）

```json
{
  "token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 604800,
  "user": {
    "authId": "...",
    "username": "admin",
    "role": "admin"
  }
}
```

- `expires_in`：秒數（目前 7 天）

---

## 2) 取得活動列表

### URL

`GET /api/ipad/events`

### curl

```bash
TOKEN="(login 回傳的 token)"
curl "http://localhost:3377/api/ipad/events" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

```json
[
  { "_id": "EVENT_ID", "name": "活動名稱" }
]
```

---

## 3) 取得活動下全部用戶

### URL

`GET /api/ipad/events/:eventId/users`

### curl

```bash
curl "http://localhost:3377/api/ipad/events/$EVENT_ID/users" \
  -H "Authorization: Bearer $TOKEN"
```

回傳該 Event 內嵌的 `users` 陣列。

---

## 3b) 取得 Registration Form Config

### URL

`GET /api/ipad/events/:eventId/registration-config`

用於 kiosk 動態渲染現場登記表單。若尚無設定會自動建立預設 FormConfig。

### curl

```bash
curl "http://localhost:3377/api/ipad/events/$EVENT_ID/registration-config" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（節錄）

```json
{
  "success": true,
  "formConfig": {
    "_id": "FORM_CONFIG_ID",
    "eventId": "EVENT_ID",
    "defaultLanguage": "zh",
    "sections": [
      {
        "sectionName": "contact_info",
        "sectionTitle": { "zh": "聯絡人資料", "en": "Contact Information" },
        "fields": [
          {
            "fieldName": "email",
            "type": "email",
            "required": true,
            "visible": true,
            "label": { "zh": "電子郵件", "en": "Email" }
          }
        ]
      }
    ]
  }
}
```

---

## 3c) 取得單一用戶

### URL

`GET /api/ipad/events/:eventId/users/:userId`

### curl

```bash
curl "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功）

```json
{
  "_id": "USER_ID",
  "name": "用戶名稱",
  "email": "user@example.com",
  "phone_code": "+852",
  "phone": "12345678",
  "company": "公司名稱",
  "isCheckIn": false,
  "checkInAt": null,
  "create_at": "2026-01-28T10:30:00.000Z",
  "modified_at": "2026-01-28T10:30:00.000Z"
}
```

實際欄位依該活動 FormConfig 而定。

---

## 4) 更新用戶（進場簽到／個人資料）

同一個 `PUT` 支援簽到狀態與修改個人資料（可同時傳）。

### URL

`PUT /api/ipad/events/:eventId/users/:userId`

### Body

| 用途 | 欄位 | 說明 |
|------|------|------|
| 簽到 | `isCheckIn` | `true` 進場簽到、`false` 取消 |
| 個人資料 | `name` / `email` / `phone_code` / `phone` / `company` 等 | FormConfig 定義的欄位 |

**注意**

- `isCheckIn: true` 會寫入 `checkInAt`；`false` 會清除 `checkInAt`
- 不可直接改 `_id`、`create_at`、`checkInAt`、`modified_at`（`checkInAt` 只經由 `isCheckIn` 間接更新）

### curl

**僅簽到：**

```bash
curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isCheckIn": true }'
```

**僅取消簽到：**

```bash
curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isCheckIn": false }'
```

**改個人資料：**

```bash
curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新姓名",
    "email": "new@example.com",
    "phone_code": "+852",
    "phone": "98765432",
    "company": "新公司名稱"
  }'
```

**簽到 + 改資料：**

```bash
curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isCheckIn": true,
    "name": "新姓名",
    "company": "新公司"
  }'
```

### Response

回傳更新後完整用戶物件。

---

## 4b) 依 FormConfig 新增用戶

### URL

`POST /api/ipad/events/:eventId/users`

Body 欄位對應 `registration-config` 的 `fields.fieldName`。支援 `text` / `email` / `tel` / `select` / `radio` / `checkbox`（陣列）/ `textarea` 等。

邏輯重用後台 `addUserToEvent`（含時間戳、名稱後備等）。

### curl

```bash
curl -X POST "http://localhost:3377/api/ipad/events/$EVENT_ID/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "測試用戶",
    "phone_code": "+852",
    "phone": "12345678",
    "company": "測試公司"
  }'
```

---

## 4c) 刪除用戶

### URL

`DELETE /api/ipad/events/:eventId/users/:userId`

### curl

```bash
curl -X DELETE "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

```json
{ "message": "User deleted successfully" }
```

刪除不可逆。

---

## 5a) 取得 Badge 設定

### URL

`GET /api/ipad/events/:eventId/badge-config`

- 尚無設定時會自動建立預設（空 `elements`）
- **不會回傳** `testImageUrl`（後台預覽用）；列印請用 `GET .../users/:userId/badge`

### curl

```bash
curl "http://localhost:3377/api/ipad/events/$EVENT_ID/badge-config" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（節錄）

```json
{
  "_id": "BADGE_CONFIG_ID",
  "eventId": "EVENT_ID",
  "name": "Default Badge",
  "width": 100,
  "height": 62,
  "dpi": 300,
  "elements": [
    {
      "_id": "ELEMENT_ID_1",
      "type": "text",
      "content": "{{user.name}}",
      "x": 590,
      "y": 100,
      "width": 300,
      "height": 50,
      "fontSize": 24,
      "fontFamily": "Arial",
      "textAlign": "center",
      "color": "#000000"
    },
    {
      "_id": "ELEMENT_ID_2",
      "type": "qrcode",
      "qrData": "{{qrcodeUrl}}",
      "x": 50,
      "y": 50,
      "width": 150,
      "height": 150
    }
  ]
}
```

---

## 5b) 刪除 Badge 元素

### URL

`DELETE /api/ipad/events/:eventId/badge-config/elements/:elementId`

`elementId` 來自 `badge-config` 回傳的 `elements[]._id`。

### curl

```bash
curl -X DELETE "http://localhost:3377/api/ipad/events/$EVENT_ID/badge-config/elements/$ELEMENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5c) 更新 Badge 設定

### URL

`PUT /api/ipad/events/:eventId/badge-config`

可更新：`name`、`width`、`height`、`dpi`、`elements`（傳 `elements` 會**整份替換**）。

### curl

```bash
curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/badge-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "type": "text",
        "content": "{{user.name}}",
        "x": 590,
        "y": 100,
        "width": 300,
        "height": 50,
        "fontSize": 24,
        "textAlign": "center"
      }
    ]
  }'
```

---

## 5d) 生成用戶 Badge 圖片

### URL

`GET /api/ipad/events/:eventId/users/:userId/badge`

依徽章配置 + 該用戶真實資料即時生成（與後台同一套邏輯）。變數如 `{{user.name}}`、QR Code 等會自動替換。

### curl

```bash
curl "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID/badge" \
  -H "Authorization: Bearer $TOKEN"
```

### Response

```json
{
  "imageUrl": "/badges/badge_....png"
}
```

完整 URL：`{DOMAIN}{imageUrl}`。需先在後台配置 Badge 設計。

---

## 6) Station Check-in（分站簽到）

進場 Check-in（`isCheckIn`）之後，可再針對場內分站分別簽到。

規則：

1. 必須先完成進場簽到
2. 同一用戶在同一分站只能簽一次
3. 若分站有 Section List（`allowedUserIds`），用戶必須在名單內

### 6a) 分站列表

`GET /api/ipad/events/:eventId/stations`

### 6b) 分站簽到記錄

`GET /api/ipad/events/:eventId/stations/:stationId/checkins`

### 6c) 分站簽到

`POST /api/ipad/events/:eventId/stations/:stationId/checkin`

```json
{ "userId": "USER_OBJECT_ID" }
```

常見錯誤碼／訊息：

- `ENTRY_CHECKIN_REQUIRED`：尚未進場簽到
- `ALREADY_CHECKED_IN`：此分站已簽到
- `NOT_IN_STATION_LIST`：不在 Section List
- `NOT_CHECKED_IN`：取消時找不到記錄

### 6c2) 取消分站簽到

`DELETE /api/ipad/events/:eventId/stations/:stationId/checkin/:userId`

或：

`POST /api/ipad/events/:eventId/stations/:stationId/uncheck`

```json
{ "userId": "USER_OBJECT_ID" }
```

### 6d) 用戶各分站狀態

`GET /api/ipad/events/:eventId/users/:userId/station-checkins`

### curl（分站簽到）

```bash
curl -X POST "http://localhost:3377/api/ipad/events/$EVENT_ID/stations/$STATION_ID/checkin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\"}"
```

---

## Kiosk 建議流程（登入／簽到）

1. `POST /login` → 存 JWT  
2. `GET /events` → 選活動  
3. （現場登記）`GET /registration-config` → 渲染表單 → `POST /users`  
4. （掃 QR／搜尋）`GET /users` 或 `GET /users/:userId`  
5. `PUT /users/:userId` `{ "isCheckIn": true }` 進場簽到  
6. （可選）`GET /users/:userId/badge` → 列印徽章  
7. （可選）`GET /stations` → `POST .../checkin` 分站簽到  
