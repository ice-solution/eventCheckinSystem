# 批量發送歡迎電郵工具

這是一個獨立的命令行工具，用於批量發送歡迎電郵給指定的用戶。

## 功能特點

✅ 批量發送歡迎電郵給多個用戶  
✅ 包含 QR 碼和 Banner  
✅ 自動使用活動的郵件模板  
✅ 詳細的發送結果報告  
✅ 錯誤處理和重試機制  

## 使用方法

### 基本語法

```bash
node send_welcome_emails.js <eventId> <userId1> [userId2] [userId3] ...
```

### 參數說明

- `eventId`: 活動 ID
- `userId1`, `userId2`, ...: 要發送電郵的用戶 ID（可多個）

### 使用範例

#### 發送給單個用戶

```bash
node send_welcome_emails.js 68faefd3a325b3b73ed12a7e 67a1234567890abcdef12345
```

#### 發送給多個用戶

```bash
node send_welcome_emails.js 68faefd3a325b3b73ed12a7e 67a1234567890abcdef12345 67a9876543210fedcba09876 67a5555555555aaaabbbbbcc
```

## 如何獲取 User ID

### 方法 1：從數據庫獲取

```bash
# 連接到 MongoDB
mongo

# 切換到數據庫
use checkinSystem

# 查找用戶
db.events.findOne(
  { _id: ObjectId("68faefd3a325b3b73ed12a7e") },
  { "users": 1 }
)
```

### 方法 2：從瀏覽器開發者工具獲取

1. 打開用戶列表頁面：`http://localhost:3377/events/68faefd3a325b3b73ed12a7e`
2. 打開瀏覽器開發者工具（F12）
3. 在 Console 中運行：

```javascript
// 查看所有用戶的 ID
$('#usersTable tbody tr').each(function() {
  const userId = $(this).data('id');
  const email = $(this).find('td:eq(1)').text();
  console.log(userId, email);
});
```

### 方法 3：從 HTML 元素獲取

在用戶列表頁面中，每個用戶的行元素有 `data-id` 屬性：

```html
<tr data-id="67a1234567890abcdef12345">
```

## 輸出範例

```
MongoDB 連接成功
✅ 找到事件：測試活動
📧 準備發送 3 封歡迎電郵...

發送電郵給 張三 (zhang@example.com)...
  ✅ 成功發送給 zhang@example.com
發送電郵給 李四 (li@example.com)...
  ✅ 成功發送給 li@example.com
發送電郵給 王五 (wang@example.com)...
  ❌ 發送失敗：Email address is not valid

==================================================
📊 發送結果：
✅ 成功：2 封
❌ 失敗：1 封
==================================================
```

## 常見問題

### 1. MongoDB 連接失敗

確保 `.env` 文件中配置了正確的 MongoDB 連接字符串：

```
mongodb=your_mongodb_connection_string
```

### 2. 找不到用戶

- 檢查 User ID 是否正確
- 確認該用戶是否屬於指定的活動

### 3. 電郵發送失敗

- 檢查 AWS SES 配置（如果是使用 SES）
- 確認收件人郵箱地址有效
- 查看服務器日誌獲取詳細錯誤信息

## 注意事項

⚠️ **請小心使用**：這個工具會實際發送電郵給用戶  
⚠️ **確認收件人**：發送前請確認 User ID 正確無誤  
⚠️ **避免重複發送**：建議記錄已發送的用戶，避免重複發送  

## 技術細節

- 使用現有的 `sendEmail` 函數邏輯
- 支持自定義郵件模板
- 自動生成 QR 碼
- 包含 Banner 圖片
- 錯誤處理和日誌記錄


