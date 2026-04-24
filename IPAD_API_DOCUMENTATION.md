# iPad API（JWT）呼叫文件

此文件說明 iPad 端要用的 API：登入取得 JWT、取得活動清單、用活動 `_id` 取得 users、更新用戶簽到狀態與**修改客戶個人資料**。

## Postman

專案內含 **`iPad_API.postman_collection.json`**，可匯入 Postman 後直接測試所有 API，包含：

- 1) 登入取得 JWT  
- 2) 取得所有活動  
- 3) 取得活動下的用戶列表  
- 3c) 取得單一用戶詳細資料  
- 4a) 更新用戶 - 簽到 (Check-in)  
- **4b) 更新用戶 - 修改客戶個人資料**  
- 4c) 取消簽到  

匯入後請先執行「1) 登入」取得 token，在 Collection 變數中設定 `token`、`eventId`、`userId` 後即可依序測試。

## Base URL

- 本機（開發）：`http://localhost:3377`
- 正式環境：請改成你的網域（例如 `https://your-domain.com`）

---

## 1) 登入取得 JWT

### URL

`POST /api/ipad/login`

### Body（JSON）

- `username`: 後台帳號（Auth）
- `password`: 後台密碼（Auth）

### curl 範例

```bash
curl -X POST "http://localhost:3377/api/ipad/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin_password"
  }'
```

### Response（成功）

- `token`: JWT 字串
- `token_type`: 固定 `Bearer`
- `expires_in`: 秒數（目前為 7 天）

---

## 2) 取得所有 Event（只回傳 name/_id）

### URL

`GET /api/ipad/events`

### Header

- `Authorization: Bearer <token>`

### 權限規則

- `admin`：回傳全部 events
- 非 `admin`：只回傳該登入帳號所擁有（`owner`）的 events

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
curl "http://localhost:3377/api/ipad/events" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3) 用 Event `_id` 取得該活動的 users

### URL

`GET /api/ipad/events/:eventId/users`

### Header

- `Authorization: Bearer <token>`

### 權限規則

- `admin`：可讀任何 event
- 非 `admin`：只能讀自己擁有（`owner`）的 event

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"

curl "http://localhost:3377/api/ipad/events/$EVENT_ID/users" \
  -H "Authorization: Bearer $TOKEN"
```

### Response 說明

回傳的是該 `Event` document 裡的 `users` 陣列（你系統目前的資料結構就是把 users 嵌在 event 內）。

---

## 3c) 取得單個用戶詳細資料

### URL

`GET /api/ipad/events/:eventId/users/:userId`

### Header

- `Authorization: Bearer <token>`

### 權限規則

- `admin`：可讀任何 event 的用戶
- 非 `admin`：只能讀自己擁有（`owner`）的 event 的用戶

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"
USER_ID="(貼上 user _id)"

curl "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功）

回傳該用戶的完整資料，包括所有動態字段（根據 FormConfig 定義的欄位）：

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
  // ... 其他在 FormConfig 中定義的欄位 ...
}
```

---

## 4) 更新用戶（簽到 / 個人資料）

同一個 `PUT` 端點支援：**簽到狀態** 與 **修改客戶個人資料**（可同時傳多個欄位）。

### URL

`PUT /api/ipad/events/:eventId/users/:userId`

### Header

- `Authorization: Bearer <token>`

### Body（JSON）

可傳以下任一或組合：

| 用途 | 欄位 | 說明 |
|------|------|------|
| 簽到 | `isCheckIn` | `true` 簽到、`false` 取消簽到 |
| 個人資料 | `name` | 姓名 |
| 個人資料 | `email` | 電郵 |
| 個人資料 | `phone_code` | 電話區號（如 `+852`） |
| 個人資料 | `phone` | 電話號碼 |
| 個人資料 | `company` | 公司名稱 |
| 個人資料 | 其他 | FormConfig 中定義的欄位（如 `table`、`saluation`、`industry` 等） |

**注意**：`isCheckIn: true` 時會自動寫入 `checkInAt`；`isCheckIn: false` 時會清除 `checkInAt`。不可透過此 API 修改 `_id`、`create_at`、`checkInAt`（僅能經由 `isCheckIn` 間接更新）。

### 權限規則

- `admin`：可更新任何 event 的用戶
- 非 `admin`：只能更新自己擁有（`owner`）的 event 的用戶

### curl 範例

**僅簽到（Check-in）**：

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"
USER_ID="(貼上 user _id)"

curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isCheckIn": true
  }'
```

**僅取消簽到**：

```bash
curl -X PUT "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isCheckIn": false
  }'
```

**修改客戶個人資料**（可只傳要改的欄位）：

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

**同時簽到並更新資料**：

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

### Response（成功）

回傳**更新後的完整用戶物件**（含所有欄位，含 `_id`、`name`、`email`、`isCheckIn`、`checkInAt`、`modified_at` 及 FormConfig 定義的欄位）：

```json
{
  "_id": "用戶ID",
  "name": "用戶名稱",
  "email": "用戶email",
  "phone_code": "+852",
  "phone": "12345678",
  "company": "公司名稱",
  "isCheckIn": true,
  "checkInAt": "2026-01-28T10:30:00.000Z",
  "create_at": "2026-01-28T10:30:00.000Z",
  "modified_at": "2026-01-28T12:00:00.000Z"
}
```

### 功能說明

- 簽到：與 `users.ejs` 行為一致；`isCheckIn: true` 會寫入 `checkInAt`，`false` 會清除。
- 修改客戶個人資料：可更新 `name`、`email`、`phone_code`、`phone`、`company` 及 FormConfig 其他欄位，只傳要改的欄位即可。
- 每次更新都會更新 `modified_at`。

---

## 5a) 取得 Badge 設定（包含所有已添加的 elements）

### URL

`GET /api/ipad/events/:eventId/badge-config`

### Header

- `Authorization: Bearer <token>`

### 功能說明

- 回傳指定 `eventId` 的 badge 設計配置
- 包含所有已添加的 elements（文字、QR Code、圖片等）
- 如果該 event 尚未有設定，系統會自動建立一份預設 config（空的 elements 陣列）並回傳

### 權限規則

- `admin`：可讀任何 event 的 badge config
- 非 `admin`：只能讀自己擁有（`owner`）的 event 的 badge config

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"

curl "http://localhost:3377/api/ipad/events/$EVENT_ID/badge-config" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功）

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
      "fontWeight": "normal",
      "textAlign": "center",
      "color": "#000000",
      "zIndex": 0
    },
    {
      "_id": "ELEMENT_ID_2",
      "type": "qrcode",
      "qrData": "{{qrcodeUrl}}",
      "x": 50,
      "y": 50,
      "width": 150,
      "height": 150,
      "zIndex": 1
    }
  ]
}
```

---

## 5b) 刪除 Badge 中的特定元素

### URL

`DELETE /api/ipad/events/:eventId/badge-config/elements/:elementId`

### Header

- `Authorization: Bearer <token>`

### 功能說明

- 從 badge 配置中刪除指定的 element
- `elementId` 是從 `badge-config` API 回傳的 `elements[]._id`

### 權限規則

- `admin`：可刪除任何 event 的 badge 元素
- 非 `admin`：只能刪除自己擁有（`owner`）的 event 的 badge 元素

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"
ELEMENT_ID="(貼上 element _id，從 badge-config API 取得)"

curl -X DELETE "http://localhost:3377/api/ipad/events/$EVENT_ID/badge-config/elements/$ELEMENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功）

```json
{
  "message": "Element deleted successfully",
  "badgeConfig": {
    "_id": "BADGE_CONFIG_ID",
    "eventId": "EVENT_ID",
    "elements": [
      // ... 刪除後的 elements 陣列 ...
    ]
  }
}
```

---

## 5c) 更新 Badge 設定

### URL

`PUT /api/ipad/events/:eventId/badge-config`

### Header

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

### Body（JSON）

可以更新以下欄位（只傳需要更新的欄位即可）：

- `name`: Badge 名稱
- `width`: 寬度（mm）
- `height`: 高度（mm）
- `dpi`: DPI 設定
- `elements`: 整個 elements 陣列（會完全替換現有的 elements）

### 功能說明

- 更新 badge 配置的欄位
- 如果傳送 `elements`，會完全替換現有的 elements 陣列
- 可以用來批量更新或重新排序 elements

### 權限規則

- `admin`：可更新任何 event 的 badge config
- 非 `admin`：只能更新自己擁有（`owner`）的 event 的 badge config

### curl 範例

**更新整個 elements 陣列**：

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"

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

### Response（成功）

```json
{
  "message": "Badge config updated successfully",
  "badgeConfig": {
    "_id": "BADGE_CONFIG_ID",
    "eventId": "EVENT_ID",
    "elements": [
      // ... 更新後的 elements ...
    ]
  }
}
```

---

## 5d) 生成用戶的 Badge 圖片（根據 badge 配置排版）

### URL

`GET /api/ipad/events/:eventId/users/:userId/badge`

### Header

- `Authorization: Bearer <token>`

### 權限規則

- `admin`：可生成任何 event 的用戶 badge
- 非 `admin`：只能生成自己擁有（`owner`）的 event 的用戶 badge

### 功能說明

根據該 event 的 **badge 設計配置**，使用用戶的實際資料生成 badge 圖片。

- 會自動替換 badge 配置中的變量（如 `{{user.name}}`、`{{user.email}}` 等）
- 生成 QR Code（如果 badge 配置中有 QR Code 元素）
- 返回生成的 badge 圖片 URL

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"
USER_ID="(貼上 user _id)"

curl "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID/badge" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功）

```json
{
  "imageUrl": "/badges/badge_69567eb57a8bcc3bea41bf45_69568b0b7a8bcc3bea41c3e4_1738067896000.png"
}
```

### 注意事項

1. **需要先配置 Badge 設計**：在生成 badge 之前，必須先在後台的 Badge 設計頁面配置好 badge 的排版
2. **圖片 URL**：返回的 `imageUrl` 是相對路徑，完整 URL 為：`{DOMAIN}{imageUrl}`
3. **QR Code**：如果 badge 配置中包含 QR Code 元素，會自動生成包含用戶 ID 的 QR Code

---

## 6) 取得 Registration Form Config（registration page 用的表單設定）

### URL

`GET /api/ipad/events/:eventId/registration-config`

### Header

- `Authorization: Bearer <token>`

### 功能說明

- 回傳指定 `eventId` 的 registration form 設定（`FormConfig`）
- 如果該 event 尚未有設定，系統會自動建立一份預設 config，並回傳
- 結構與後台 FormConfig 一致（`sections`、`fields`、`required`、`options` 等）

### 權限規則

- `admin`：可讀任何 event 的 config
- 非 `admin`：只能讀自己擁有（`owner`）的 event 的 config

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"

curl "http://localhost:3377/api/ipad/events/$EVENT_ID/registration-config" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功，節錄）

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
            "label": { "zh": "電子郵件", "en": "Email" },
            "placeholder": { "zh": "例如：peterwong@abccompany.com", "en": "e.g. peterwong@abccompany.com" }
          }
          // ... 其他欄位 ...
        ]
      }
    ]
  }
}
```

---

## 7) 根據 Registration Config 建立 Event 用戶

### URL

`POST /api/ipad/events/:eventId/users`

### Header

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

### Body（JSON）

Body 的欄位應該依照 `registration-config` 回傳的 `fields.fieldName` 來填。

**重要**：此 API **完全支援 FormConfig 中定義的所有欄位類型**，包括：

- `text` - 文字欄位
- `email` - 電子郵件
- `tel` - 電話號碼
- `select` - 下拉選單（傳送選中的 `value`）
- `radio` - 單選按鈕（傳送選中的 `value`）
- `checkbox` - 複選框（傳送**陣列**，包含所有選中的 `value`）
- `textarea` - 多行文字

**範例**：

```json
{
  "email": "test@example.com",
  "name": "測試用戶",
  "phone_code": "+852",
  "phone": "12345678",
  "company": "測試公司",
  "role": "Manager",
  "saluation": "Mr.",
  "industry": "Technology",
  "transport": "Taxi",
  "meal": "Vegetarian",
  "interests": ["Technology", "Business", "Networking"],  // checkbox 欄位：傳送陣列
  "remarks": "這是備註文字"
  // ... 其他在 FormConfig 中定義的任何欄位 ...
}
```

### 功能說明

- **完全支援 FormConfig 的所有欄位**：可以傳送 FormConfig 中定義的任何 `fieldName` 及其對應的值
- 會自動：
  - 設定 `create_at`、`modified_at`
  - 沒有提供 `name` 時，用 `email` 或 `company` 作為備用名稱
  - 支援所有動態欄位類型（包括 checkbox 陣列、select/radio 的 value 等）
  - 欄位值可以是字串、數字、布林值、陣列等任何類型

### 權限規則

- `admin`：可為任何 event 新增用戶
- 非 `admin`：只能為自己擁有（`owner`）的 event 新增用戶

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"

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

### Response（成功）

```json
{
  "_id": "NEW_USER_ID",
  "email": "test@example.com",
  "name": "測試用戶",
  "phone_code": "+852",
  "phone": "12345678",
  "company": "測試公司",
  "isCheckIn": false,
  "create_at": "2026-01-28T10:30:00.000Z",
  "modified_at": "2026-01-28T10:30:00.000Z"
}
```

---

## 4c) 刪除用戶

### URL

`DELETE /api/ipad/events/:eventId/users/:userId`

### Header

- `Authorization: Bearer <token>`

### 權限規則

- `admin`：可刪除任何 event 的用戶
- 非 `admin`：只能刪除自己擁有（`owner`）的 event 的用戶

### curl 範例

```bash
TOKEN="(貼上 login 回傳的 token)"
EVENT_ID="(貼上 event _id)"
USER_ID="(貼上 user _id)"

curl -X DELETE "http://localhost:3377/api/ipad/events/$EVENT_ID/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Response（成功）

```json
{
  "message": "User deleted successfully"
}
```

### 注意事項

- 刪除操作不可逆，請確認後再執行
- 刪除後該用戶的所有資料（包括 checkin 記錄）都會被移除

---

## 環境變數（建議）

請在正式環境設定強密鑰：

- `JWT_SECRET`: JWT 簽名用 secret

若未設定，系統會暫用 `'events'`（不建議用在正式環境）。

