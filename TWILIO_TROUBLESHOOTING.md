# Twilio SMS 發送問題排查

## 錯誤 21612: Message cannot be sent with the current combination

### 問題原因
這個錯誤通常發生在以下情況：
1. **國家/地區不匹配**：發送號碼和接收號碼來自不同國家/地區
2. **未啟用國際 SMS**：Twilio 帳號可能沒有啟用國際 SMS 功能
3. **測試帳號限制**：測試帳號只能發送到已驗證的號碼

### 解決方案

#### 方案 1: 驗證接收號碼（測試帳號）
如果使用測試帳號，需要在 Twilio Console 驗證接收號碼：
1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Phone Numbers** > **Verified Caller IDs**
3. 添加並驗證 `+85256004956`

#### 方案 2: 啟用國際 SMS（正式帳號）
1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Settings** > **General**
3. 啟用 **International SMS**
4. 確認帳號有足夠餘額

#### 方案 3: 購買香港電話號碼
1. 在 Twilio Console 購買一個香港電話號碼（+852）
2. 更新 `.env` 中的 `TWILIO_PHONE_NUMBER` 為新的香港號碼

#### 方案 4: 使用 Messaging Service（推薦）
1. 在 Twilio Console 創建 Messaging Service
2. 添加多個發送號碼（包括香港號碼）
3. 修改代碼使用 Messaging Service SID 而不是直接使用電話號碼

### 檢查清單
- [ ] 確認 Twilio 帳號類型（測試/正式）
- [ ] 確認發送號碼是否支持目標國家/地區
- [ ] 確認已啟用國際 SMS（如需要）
- [ ] 確認帳號有足夠餘額
- [ ] 檢查 Twilio Console 的錯誤日誌

### 測試建議
1. 先測試發送到同一個國家/地區的號碼（例如：美國號碼發送到美國號碼）
2. 確認基本功能正常後，再測試國際 SMS
3. 檢查 Twilio Console 的日誌以獲取詳細錯誤信息

