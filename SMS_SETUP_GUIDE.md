# SMS 發送設置指南 - 最簡單的方法

## 目標
能夠發送 SMS 到香港號碼（+85256004956），不介意發送號碼是什麼。

## 最簡單的解決方案：購買香港電話號碼

### 為什麼需要？
- 美國號碼（+19714064629）無法發送到香港號碼（+85256004956）
- 這是 Twilio 的限制，無法繞過
- **必須**購買香港號碼才能發送到香港

### 步驟（5 分鐘完成）

#### 1. 登入 Twilio Console
前往：https://console.twilio.com/

#### 2. 購買香港號碼
1. 點擊左側選單 **Phone Numbers** > **Buy a number**
2. 在 **Country** 下拉選單中選擇 **Hong Kong (HK)**
3. 點擊 **Search**
4. 選擇一個可用的號碼（通常有幾個選項）
5. 點擊 **Buy** 並確認購買

**費用：** 通常每月約 $1-2 USD（取決於號碼類型）

#### 3. 更新配置
購買完成後，您會看到新號碼（例如：`+85212345678`）

在 `.env` 文件中更新：
```env
TWILIO_PHONE_NUMBER=+852您的新號碼
```

#### 4. 測試
運行測試腳本：
```bash
node test_sms_direct.js
```

應該可以成功發送到 `+85256004956`！

## 替代方案：使用 Messaging Service

如果您已經有香港號碼，可以使用 Messaging Service：

### 步驟
1. 在 Twilio Console 創建 **Messaging Service**
2. 添加您的香港號碼到 Messaging Service
3. 獲取 Messaging Service SID（以 `MG` 開頭）
4. 在 `.env` 中添加：
   ```env
   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

系統會自動使用 Messaging Service，無需指定具體號碼。

## 費用說明

### 購買號碼
- **月費：** 約 $1-2 USD/月
- **一次性設置費：** 通常免費

### 發送 SMS
- **香港本地 SMS：** 約 $0.05-0.10 USD/條
- **國際 SMS：** 價格因國家而異

## 常見問題

### Q: 能否不購買號碼？
**A:** 不能。Twilio 要求發送號碼必須是從 Twilio 購買的。

### Q: 能否使用免費方案？
**A:** 測試帳號可以驗證接收號碼，但您的帳號是正式帳號，無法驗證。

### Q: 購買後可以立即使用嗎？
**A:** 是的，購買後立即可以使用。

### Q: 可以取消號碼嗎？
**A:** 可以，隨時在 Twilio Console 中釋放號碼（停止付費）。

## 總結

**最簡單的方法：**
1. ✅ 購買香港號碼（5 分鐘）
2. ✅ 更新 `.env` 文件
3. ✅ 測試發送

**完成後即可發送 SMS 到任何香港號碼！**

