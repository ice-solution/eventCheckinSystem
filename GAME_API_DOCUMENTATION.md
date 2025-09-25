# 遊戲積分系統 API 文檔

## 概述
此API系統用於管理活動中的遊戲積分功能，允許外部遊戲平台與我們的簽到系統整合。

**重要更新**: gameID現在附屬於event，每個event都有自己的gameIds數組。系統會檢查gameID是否屬於該event，以及用戶是否存在於該event中。

## 基礎URL
```
http://your-domain.com/api/game
```

## API 端點

### 1. 開始遊戲
**POST** `/api/game/:gameId/gamestart`

檢查用戶是否存在於包含該gameId的event中，並返回用戶信息和遊戲記錄。

#### 請求參數
- `gameId` (URL參數): 遊戲ID（必須屬於某個event的gameIds數組中）
- `user` (Body): 事件用戶ID

#### 請求範例
```bash
POST /api/game/game123/gamestart
Content-Type: application/json

{
    "user": "507f1f77bcf86cd799439011"
}
```

#### 成功響應範例
```json
{
    "success": true,
    "event": {
        "id": "507f1f77bcf86cd799439010",
        "name": "2024年會活動"
    },
    "user": {
        "id": "507f1f77bcf86cd799439011",
        "name": "張三",
        "email": "zhang@example.com",
        "company": "ABC公司",
        "currentPoints": 15
    },
    "gameRecord": {
        "gameId": "game123",
        "userId": "507f1f77bcf86cd799439011",
        "point": 5,
        "created_at": "2024-01-15T10:30:00.000Z"
    }
}
```

#### 失敗響應範例
```json
{
    "success": false,
    "message": "不能開啟遊戲原因：找不到用戶"
}
```

或

```json
{
    "success": false,
    "message": "不能開啟遊戲原因：遊戲ID不在該事件中"
}
```

### 2. 結束遊戲
**POST** `/api/game/:gameId/endgame`

記錄遊戲分數並更新用戶積分。同樣會驗證gameId是否屬於該event以及用戶是否存在。

#### 請求參數
- `gameId` (URL參數): 遊戲ID（必須屬於某個event的gameIds數組中）
- `user` (Body): 事件用戶ID
- `point` (Body): 獲得分數

#### 請求範例
```bash
POST /api/game/game123/endgame
Content-Type: application/json

{
    "user": "507f1f77bcf86cd799439011",
    "point": 3
}
```

#### 成功響應範例
```json
{
    "success": true,
    "message": "遊戲結束，積分已更新",
    "event": {
        "id": "507f1f77bcf86cd799439010",
        "name": "2024年會活動"
    },
    "user": {
        "id": "507f1f77bcf86cd799439011",
        "name": "張三",
        "previousPoints": 15,
        "currentPoints": 18,
        "gainedPoints": 3
    },
    "gameHistory": {
        "gameId": "game123",
        "point": 3,
        "timestamp": "2024-01-15T10:35:00.000Z"
    }
}
```

#### 失敗響應範例
```json
{
    "success": false,
    "message": "不能結束遊戲原因：找不到用戶"
}
```

或

```json
{
    "success": false,
    "message": "不能結束遊戲原因：遊戲ID不在該事件中"
}
```

### 3. 獲取用戶遊戲歷史
**GET** `/api/game/:gameId/user/:eventUserId/history`

獲取特定用戶在特定遊戲中的所有記錄。

#### 請求範例
```bash
GET /api/game/game123/user/507f1f77bcf86cd799439011/history
```

#### 響應範例
```json
{
    "success": true,
    "gameHistory": [
        {
            "_id": "507f1f77bcf86cd799439012",
            "gameId": "game123",
            "userId": "507f1f77bcf86cd799439011",
            "point": 5,
            "created_at": "2024-01-15T10:30:00.000Z"
        },
        {
            "_id": "507f1f77bcf86cd799439013",
            "gameId": "game123",
            "userId": "507f1f77bcf86cd799439011",
            "point": 3,
            "created_at": "2024-01-15T10:35:00.000Z"
        }
    ]
}
```

### 4. 獲取遊戲統計
**GET** `/api/game/:gameId/stats`

獲取特定遊戲的統計信息。

#### 請求範例
```bash
GET /api/game/game123/stats
```

#### 響應範例
```json
{
    "success": true,
    "gameId": "game123",
    "stats": {
        "totalGames": 25,
        "totalPoints": 150,
        "averagePoints": 6.0,
        "uniqueUserCount": 15
    }
}
```

### 5. 事件遊戲ID管理

#### 5.1 添加遊戲ID到事件
**POST** `/api/game/event/:eventId/gameId`

為特定事件添加新的遊戲ID。

#### 請求範例
```bash
POST /api/game/event/507f1f77bcf86cd799439010/gameId
Content-Type: application/json

{
    "gameId": "game123"
}
```

#### 響應範例
```json
{
    "success": true,
    "message": "遊戲ID已成功添加到事件",
    "event": {
        "id": "507f1f77bcf86cd799439010",
        "name": "2024年會活動",
        "gameIds": ["game123", "game456", "game789"]
    }
}
```

#### 5.2 從事件移除遊戲ID
**DELETE** `/api/game/event/:eventId/gameId/:gameId`

從特定事件中移除遊戲ID。

#### 請求範例
```bash
DELETE /api/game/event/507f1f77bcf86cd799439010/gameId/game123
```

#### 響應範例
```json
{
    "success": true,
    "message": "遊戲ID已成功從事件中移除",
    "event": {
        "id": "507f1f77bcf86cd799439010",
        "name": "2024年會活動",
        "gameIds": ["game456", "game789"]
    }
}
```

#### 5.3 獲取事件的所有遊戲ID
**GET** `/api/game/event/:eventId/gameIds`

獲取特定事件的所有遊戲ID。

#### 請求範例
```bash
GET /api/game/event/507f1f77bcf86cd799439010/gameIds
```

#### 響應範例
```json
{
    "success": true,
    "event": {
        "id": "507f1f77bcf86cd799439010",
        "name": "2024年會活動",
        "gameIds": ["game123", "game456", "game789"]
    }
}
```

## 錯誤響應

### 400 Bad Request
```json
{
    "success": false,
    "message": "缺少必要參數：用戶ID或分數"
}
```

### 404 Not Found
```json
{
    "success": false,
    "message": "找不到該用戶"
}
```

### 500 Internal Server Error
```json
{
    "success": false,
    "message": "伺服器錯誤"
}
```

## 使用流程

1. **創建遊戲ID和URL**: 
   - 系統返回格式：`abc.com/api/game/:gameId/user/eventuserId`
   - 重定向到：`game.com/:gameId/:eventuserId`

2. **開始遊戲**:
   - 調用 `POST /api/game/:gameId/gamestart`
   - 傳入用戶ID
   - 系統返回用戶信息和現有遊戲記錄

3. **結束遊戲**:
   - 調用 `POST /api/game/:gameId/endgame`
   - 傳入用戶ID和獲得的分數
   - 系統自動更新用戶積分並記錄遊戲歷史

## 數據庫結構

### Event 集合更新
```javascript
{
    _id: ObjectId,
    name: String,        // 事件名稱
    from: Date,          // 事件開始時間
    to: Date,            // 事件結束時間
    owner: ObjectId,     // 事件擁有者
    created_at: Date,    // 創建時間
    modified_at: Date,   // 修改時間
    users: [userSchema], // 用戶數組
    points: [pointSchema], // 點數數組
    winners: [winnerSchema], // 中獎者數組
    gameIds: [String]    // 新增：該事件開放的遊戲ID數組
}
```

### GameHistory 集合
```javascript
{
    _id: ObjectId,
    gameId: String,      // 遊戲ID（必須存在於某個event的gameIds中）
    userId: String,      // 事件用戶ID
    point: Number,       // 獲得的分數
    created_at: Date,    // 創建時間
    gameData: Object     // 額外遊戲數據（可選）
}
```

### Event.users 集合更新
- 用戶的 `point` 字段會自動更新
- 每次遊戲結束後會累加新獲得的分數

## 測試

運行測試腳本：
```bash
node test_game_api.js
```

確保：
1. 伺服器正在運行
2. 將測試腳本中的 `TEST_USER_ID` 替換為實際的用戶ID
3. 該用戶存在於某個事件中

## 注意事項

1. 所有API都是公開的，不需要認證
2. 分數必須是非負數字
3. 系統會自動在所有事件中搜索用戶
4. 遊戲歷史會永久保存
5. 用戶積分會累加，不會重置
