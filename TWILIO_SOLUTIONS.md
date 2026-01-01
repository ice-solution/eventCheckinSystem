# Twilio SMS 發送解決方案

## 問題：美國號碼無法發送到香港

**錯誤 21612** 表示當前發送號碼和接收號碼的組合不被支持。

### 原因
- 美國號碼（+1）發送到香港（+852）可能受到 Twilio 的限制
- 某些號碼類型不支持國際 SMS
- 需要符合目標國家/地區的法規要求

## 解決方案

### 方案 1: 購買香港電話號碼（推薦）⭐

**優點：**
- 最可靠的方法
- 符合香港電信規範
- 更高的送達率

**步驟：**
1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Phone Numbers** > **Buy a number**
3. 選擇 **Hong Kong** 作為國家/地區
4. 購買號碼後，更新 `.env`：
   ```env
   TWILIO_PHONE_NUMBER=+852你的香港號碼
   ```

### 方案 2: 使用 Messaging Service（推薦）⭐

**優點：**
- 可以配置多個發送號碼（包括香港號碼）
- Twilio 會自動選擇最合適的號碼
- 更靈活的管理

**步驟：**
1. 在 Twilio Console 創建 **Messaging Service**
2. 添加多個發送號碼（包括香港號碼）
3. 獲取 Messaging Service SID
4. 在 `.env` 中添加：
   ```env
   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. 系統會自動使用 Messaging Service 而不是直接號碼

### 方案 3: 驗證接收號碼（僅測試帳號）

**適用於：**
- 測試帳號（Account SID 以 `ACtest` 開頭）
- 僅用於測試目的

**步驟：**
1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Phone Numbers** > **Verified Caller IDs**
3. 添加並驗證 `+85256004956`
4. 驗證後可以從任何號碼發送到這個驗證的號碼

### 方案 4: 啟用國際 SMS（如果支持）

**檢查：**
1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Settings** > **General**
3. 確認 **International SMS** 已啟用
4. 檢查帳號餘額是否足夠

**注意：** 即使啟用了國際 SMS，某些號碼組合仍可能不被支持。

## 當前代碼支持

代碼已更新支持：
- ✅ 直接使用電話號碼（`TWILIO_PHONE_NUMBER`）
- ✅ 使用 Messaging Service（`TWILIO_MESSAGING_SERVICE_SID`，優先）

如果同時設置了兩者，會優先使用 Messaging Service。

## 建議

**最佳實踐：**
1. 購買目標國家/地區的電話號碼（香港號碼）
2. 使用 Messaging Service 管理多個號碼
3. 這樣可以支持發送到多個國家/地區

## 測試

更新配置後，運行：
```bash
node test_sms_direct.js
```

或使用實際模板內容：
```bash
node test_sms_with_template_content.js "您的模板內容"
```

