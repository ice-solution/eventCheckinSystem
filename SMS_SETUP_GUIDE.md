# SMS 服務設定指南

支援 Twilio、Plivo、WhatsApp 三種 SMS 服務商。本指南以 Twilio 為主。

---

## 環境變數配置

```env
# Twilio（擇一或兩者同時設定）
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX          # 直接使用號碼
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx   # 或使用 Messaging Service（優先）

# Plivo（如使用 Plivo）
PLIVO_AUTH_ID=xxxxxxxxxx
PLIVO_AUTH_TOKEN=xxxxxxxxxx
PLIVO_PHONE_NUMBER=+1XXXXXXXXXX
```

> 若同時設定 `TWILIO_PHONE_NUMBER` 與 `TWILIO_MESSAGING_SERVICE_SID`，系統優先使用 Messaging Service。

---

## 國際 SMS 發送問題排查

### 常見錯誤：Error 21612

**原因：** 發送號碼與接收號碼的國家/地區組合不被支持，常見於美國號碼（+1）嘗試發送到香港（+852）。

### 解決方案

#### 方案 1：購買目標地區電話號碼（最推薦）⭐

1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Phone Numbers** > **Buy a number**
3. 選擇目標國家/地區（例如 Hong Kong）
4. 購買後更新 `.env`：
   ```env
   TWILIO_PHONE_NUMBER=+852XXXXXXXX
   ```

**費用參考：** 香港號碼約 $1–2 USD/月；每條 SMS 約 $0.05–0.10 USD。

---

#### 方案 2：使用 Messaging Service（彈性管理）⭐

1. 在 Twilio Console 建立 **Messaging Service**
2. 將多個發送號碼（含目標地區號碼）加入 Service
3. 取得 Messaging Service SID（以 `MG` 開頭）
4. 更新 `.env`：
   ```env
   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

系統會自動選擇最適合的號碼發送，適合多國家/地區場景。

---

#### 方案 3：啟用國際 SMS（正式帳號）

1. 登入 [Twilio Console](https://console.twilio.com/)
2. 前往 **Settings** > **General**
3. 確認 **International SMS** 已啟用
4. 確認帳號餘額充足

> 注意：即使啟用，某些號碼組合仍可能不支持，建議搭配方案 1 或 2。

---

#### 方案 4：驗證接收號碼（僅測試帳號）

適用於 Account SID 以 `ACtest` 開頭的測試帳號：

1. 前往 **Phone Numbers** > **Verified Caller IDs**
2. 新增並驗證目標接收號碼
3. 驗證後，可從任何 Twilio 號碼發送到此號碼

> 此方法僅限測試用途，不適合生產環境。

---

## 測試

```bash
# 直接測試 SMS 發送
node test_sms_direct.js

# 使用模板內容測試
node test_sms_with_template_content.js "您的模板內容"
```

---

## 最佳實踐

1. **生產環境**：購買目標地區號碼 + 使用 Messaging Service 管理
2. **多地區發送**：Messaging Service 自動路由，無需手動切換號碼
3. **費用控制**：在 Twilio Console 設定消費上限告警
