# 驗證電話號碼指南

## 關於使用個人電話號碼

### ❌ 不能直接用作發送號碼
- Twilio 的發送號碼必須是從 Twilio 購買的
- 個人電話號碼無法直接用作 Twilio 的發送號碼
- 這是 Twilio 的安全和法規要求

### ✅ 可以驗證為接收號碼（僅測試帳號）

如果您的 Twilio 帳號是**測試帳號**（Account SID 以 `ACtest` 開頭），可以驗證您的電話號碼作為接收號碼。

**優點：**
- 可以從任何 Twilio 號碼發送到這個驗證的號碼
- 適合測試和開發
- 免費

**限制：**
- 僅適用於測試帳號
- 只能發送到已驗證的號碼
- 不適合生產環境

## 如何驗證電話號碼

### 步驟 1: 登入 Twilio Console
1. 前往 [Twilio Console](https://console.twilio.com/)
2. 登入您的帳號

### 步驟 2: 驗證電話號碼
1. 在左側選單中，點擊 **Phone Numbers**
2. 選擇 **Verified Caller IDs**（或 **Manage** > **Verified Caller IDs**）
3. 點擊 **+** 或 **Add a new Caller ID**
4. 輸入您的電話號碼：`+85256004956`
5. 選擇驗證方式：
   - **Call me**：Twilio 會打電話給您，您需要輸入驗證碼
   - **Text me**：Twilio 會發送 SMS 給您，您需要輸入驗證碼
6. 完成驗證後，號碼會出現在 "Verified Caller IDs" 列表中

### 步驟 3: 測試發送
驗證完成後，可以從任何 Twilio 號碼發送到 `+85256004956`。

## 檢查帳號類型

運行以下命令檢查您的帳號類型：

```bash
node -e "require('dotenv').config(); const sid = process.env.TWILIO_ACCOUNT_SID || process.env.twiliosid; console.log('Account SID:', sid); console.log('帳號類型:', sid && sid.startsWith('ACtest') ? '測試帳號 ✅' : '正式帳號 ❌');"
```

## 測試帳號 vs 正式帳號

### 測試帳號（ACtest...）
- ✅ 可以驗證接收號碼
- ✅ 免費測試
- ❌ 只能發送到驗證的號碼
- ❌ 不適合生產環境

### 正式帳號（AC...）
- ❌ 不能驗證接收號碼
- ✅ 可以發送到任何號碼（需要購買對應的發送號碼）
- ✅ 適合生產環境
- 💰 需要付費

## 建議

### 如果您的帳號是測試帳號：
1. 驗證 `+85256004956` 作為接收號碼
2. 使用現有的美國號碼（+19714064629）發送
3. 這樣就可以成功發送到您的香港號碼

### 如果您的帳號是正式帳號：
1. 購買香港電話號碼（推薦）
2. 或使用 Messaging Service（如果已配置）

## 驗證後測試

驗證完成後，運行：
```bash
node test_sms_direct.js
```

應該可以成功發送到 `+85256004956`。

