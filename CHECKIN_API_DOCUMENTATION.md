# Check-in API 文檔

## 概述

此 API 系統用於管理活動中的用戶簽到（Check-in）功能，允許獲取簽到列表和執行簽到動作。

## 基礎 URL

```
http://your-domain.com/events
```

## API 端點

### 1. 獲取 Check-in 列表

**API URL**: `GET /events/:eventId/users/data`

**說明**: 獲取指定事件的所有用戶列表（包含 check-in 狀態）

**URL 參數**:
- `eventId` (String, 必填) - 事件 ID

**請求範例**:
```bash
GET /events/507f1f77bcf86cd799439010/users/data
```

**成功響應** (200):
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "張三",
    "email": "zhang@example.com",
    "company": "ABC公司",
    "phone": "12345678",
    "isCheckIn": false,
    "checkInAt": null,
    "create_at": "2024-01-15T10:30:00.000Z",
    "modified_at": "2024-01-15T10:30:00.000Z"
  },
  {
    "_id": "507f1f77bcf86cd799439012",
    "name": "李四",
    "email": "li@example.com",
    "company": "XYZ公司",
    "phone": "87654321",
    "isCheckIn": true,
    "checkInAt": "2024-01-15T11:00:00.000Z",
    "create_at": "2024-01-15T10:30:00.000Z",
    "modified_at": "2024-01-15T11:00:00.000Z"
  }
]
```

**響應字段說明**:
- `_id`: 用戶 ID
- `name`: 用戶姓名
- `email`: 用戶電子郵件
- `company`: 公司名稱
- `phone`: 電話號碼
- `isCheckIn`: 是否已簽到（Boolean）
- `checkInAt`: 簽到時間（Date，未簽到時為 null）
- `create_at`: 創建時間
- `modified_at`: 最後修改時間

**錯誤響應**:
- `404`: Event not found
- `500`: Error fetching users

---

### 2. Check-in 動作

有兩種方式可以執行 check-in：

#### 方式 1: 專用 Check-in API（推薦）

**API URL**: `PUT /events/:eventId/users/:userId/checkin`

**說明**: 專門用於 check-in 的 API，會自動設置簽到時間

**URL 參數**:
- `eventId` (String, 必填) - 事件 ID
- `userId` (String, 必填) - 用戶 ID

**請求範例**:
```bash
PUT /events/507f1f77bcf86cd799439010/users/507f1f77bcf86cd799439011/checkin
Content-Type: application/json
```

**注意**: 此 API 不需要 Body 參數

**成功響應** (200):
```json
{
  "message": "Check-in successful",
  "user": {
    "name": "張三",
    "email": "zhang@example.com",
    "checkInAt": "2024-01-15T11:30:00.000Z"
  }
}
```

**錯誤響應**:
- `400`: User has already checked in（用戶已經簽到）
- `404`: Event not found 或 User not found in this event
- `500`: Error checking in user

---

#### 方式 2: 通用更新 API

**API URL**: `PUT /events/:eventId/users/:userId`

**說明**: 通用的用戶更新 API，可以用來更新 check-in 狀態

**URL 參數**:
- `eventId` (String, 必填) - 事件 ID
- `userId` (String, 必填) - 用戶 ID

**Body 參數**:
- `isCheckIn` (Boolean, 必填) - `true` 表示 check-in，`false` 表示取消 check-in

**請求範例**:
```bash
PUT /events/507f1f77bcf86cd799439010/users/507f1f77bcf86cd799439011
Content-Type: application/json

{
  "isCheckIn": true
}
```

**成功響應** (200):
```json
{
  "message": "User updated successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "張三",
    "email": "zhang@example.com",
    "company": "ABC公司",
    "phone": "12345678",
    "isCheckIn": true,
    "checkInAt": "2024-01-15T11:30:00.000Z",
    "modified_at": "2024-01-15T11:30:00.000Z"
  }
}
```

**錯誤響應**:
- `404`: 找不到該事件 ID 或 找不到該用戶
- `500`: Server error

**注意事項**:
- 使用 `isCheckIn: true` 時，系統會自動設置 `checkInAt` 為當前時間
- 使用 `isCheckIn: false` 時，系統會清除 `checkInAt` 時間

---

### 3. 批量 Check-in

**API URL**: `PUT /events/:eventId/users/batch-checkin`

**說明**: 批量 check-in 多個用戶

**URL 參數**:
- `eventId` (String, 必填) - 事件 ID

**Body 參數**:
- `userIds` (Array, 必填) - 用戶 ID 數組

**請求範例**:
```bash
PUT /events/507f1f77bcf86cd799439010/users/batch-checkin
Content-Type: application/json

{
  "userIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**成功響應** (200):
```json
{
  "message": "Batch check-in successful",
  "checkedInCount": 3,
  "failedCount": 0
}
```

**錯誤響應**:
- `404`: Event not found
- `500`: Error performing batch check-in

---

### 4. 獲取單個用戶信息

**API URL**: `GET /events/:eventId/users/:userId`

**說明**: 根據事件 ID 和用戶 ID 獲取單個用戶的詳細信息

**URL 參數**:
- `eventId` (String, 必填) - 事件 ID
- `userId` (String, 必填) - 用戶 ID

**請求範例**:
```bash
GET /events/507f1f77bcf86cd799439010/users/507f1f77bcf86cd799439011
```

**成功響應** (200):
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "張三",
  "email": "zhang@example.com",
  "company": "ABC公司",
  "phone": "12345678",
  "isCheckIn": true,
  "checkInAt": "2024-01-15T11:30:00.000Z",
  "create_at": "2024-01-15T10:30:00.000Z",
  "modified_at": "2024-01-15T11:30:00.000Z"
}
```

**錯誤響應**:
- `404`: Event not found 或 User not found
- `500`: Server error

---

## API 總結表

| API | 方法 | URL | 用途 | Body 參數 |
|-----|------|-----|------|----------|
| 獲取列表 | GET | `/events/:eventId/users/data` | 獲取所有用戶（含 check-in 狀態） | 無 |
| Check-in（專用） | PUT | `/events/:eventId/users/:userId/checkin` | 單一用戶 check-in | 無 |
| Check-in（通用） | PUT | `/events/:eventId/users/:userId` | 更新用戶（可更新 check-in） | `{ "isCheckIn": true/false }` |
| 批量 Check-in | PUT | `/events/:eventId/users/batch-checkin` | 批量 check-in | `{ "userIds": [...] }` |
| 獲取單個用戶 | GET | `/events/:eventId/users/:userId` | 獲取用戶詳細信息 | 無 |

---

## 使用建議

1. **獲取列表**: 使用 `GET /events/:eventId/users/data` 獲取所有用戶及其 check-in 狀態

2. **執行 Check-in**: 
   - 推薦使用 `PUT /events/:eventId/users/:userId/checkin`（專用 API）
   - 如果需要同時更新其他字段，使用 `PUT /events/:eventId/users/:userId`

3. **批量操作**: 使用 `PUT /events/:eventId/users/batch-checkin` 進行批量 check-in

4. **查詢單個用戶**: 使用 `GET /events/:eventId/users/:userId` 獲取詳細信息

---

## 注意事項

1. **重複 Check-in**: 專用 check-in API (`/checkin`) 會檢查用戶是否已經簽到，如果已經簽到會返回 400 錯誤

2. **自動時間戳**: 
   - 專用 check-in API 會自動設置 `checkInAt` 為當前時間
   - 通用更新 API 在設置 `isCheckIn: true` 時也會自動設置 `checkInAt`

3. **取消 Check-in**: 使用通用更新 API 設置 `isCheckIn: false` 可以取消 check-in，系統會清除 `checkInAt` 時間

4. **錯誤處理**: 所有 API 都使用標準 HTTP 狀態碼，請確保正確處理錯誤響應

---

## 完整請求範例（cURL）

### 獲取 Check-in 列表
```bash
curl -X GET "http://your-domain.com/events/507f1f77bcf86cd799439010/users/data"
```

### Check-in 用戶（專用 API）
```bash
curl -X PUT "http://your-domain.com/events/507f1f77bcf86cd799439010/users/507f1f77bcf86cd799439011/checkin" \
  -H "Content-Type: application/json"
```

### Check-in 用戶（通用 API）
```bash
curl -X PUT "http://your-domain.com/events/507f1f77bcf86cd799439010/users/507f1f77bcf86cd799439011" \
  -H "Content-Type: application/json" \
  -d '{
    "isCheckIn": true
  }'
```

### 批量 Check-in
```bash
curl -X PUT "http://your-domain.com/events/507f1f77bcf86cd799439010/users/batch-checkin" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": [
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
      "507f1f77bcf86cd799439013"
    ]
  }'
```

### 獲取單個用戶
```bash
curl -X GET "http://your-domain.com/events/507f1f77bcf86cd799439010/users/507f1f77bcf86cd799439011"
```

---

## 相關文件

- 事件相關 API: 請參考 `eventsController.js`
- 路由定義: 請參考 `routes/events.js`

