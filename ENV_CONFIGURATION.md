# 環境變數配置說明

## 📋 必須設定的環境變數

請在專案根目錄創建 `.env` 文件，並添加以下配置：

---

## 🌐 伺服器配置

### PORT
- **說明**：應用程式運行的端口號
- **範例**：`PORT=3377`
- **預設值**：3377

### DOMAIN ⚠️ **重要**
- **說明**：應用程式的完整域名（包含協議）
- **用途**：用於付款回調與重導向 URL（Wonder callback_url / redirect_url）
- **範例**：
  - 本地開發：`DOMAIN=http://localhost:3377`
  - 生產環境：`DOMAIN=https://demo.brandactivation.hk`
- **注意**：
  - ✅ 必須包含協議（`http://` 或 `https://`）
  - ✅ 不要在結尾加斜線 `/`
  - ✅ 生產環境必須使用 HTTPS

---

## 🗄️ 資料庫配置

### MONGODB_URI
- **說明**：MongoDB 連接字串
- **範例**：
  - 本地：`MONGODB_URI=mongodb://localhost:27017/checkinSystem`
  - MongoDB Atlas：`MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/checkinSystem`

---

## 💳 付款閘道選擇

### PAYMENT_GATEWAY
- **說明**：選擇付款方式，不影響前端（前端仍 POST 到同一 checkout 路徑）
- **可選值**：`wonder` | `stripe`
- **範例**：`PAYMENT_GATEWAY=wonder` 或 `PAYMENT_GATEWAY=stripe`
- **預設**：未設或非 `stripe` 時為 `wonder`
- **效果**：每筆付款記錄（Transaction）會寫入 `paymentGateway` 欄位（`stripe` 或 `wonder`），API 回傳的資料會照常包含該筆記錄

---

## 💳 Wonder Payment 配置（PAYMENT_GATEWAY=wonder 時使用）

### PAYMENT_DEV / payment_dev
- **說明**：是否使用 Wonder 測試環境
- **範例**：`PAYMENT_DEV=true` 或 `payment_dev=true`
- **效果**：
  - `true` → 使用 `https://gateway-stg.wonder.today`
  - `false` / 未設 → 使用 `https://gateway.wonder.today`

### WONDER_APP_ID
- **說明**：Wonder 的 app_id（建立訂單 API 必填，亦用於 Credential 簽名）
- **範例**：`WONDER_APP_ID=00000000-0000-0000-0000-000000000000`

### WONDER_PRIVATE_KEY
- **說明**：Wonder 的 RSA 私鑰（PEM），用於 Wonder-RSA-SHA256 簽名，每次 create order 前會先做認證
- **範例**：將整段 PEM（含 `-----BEGIN RSA PRIVATE KEY-----` 與 `-----END RSA PRIVATE KEY-----`）貼入 .env，換行處可用 `\n` 表示，例如：`WONDER_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"`

### WONDER_CUSTOMER_UUID
- **說明**：Wonder 的 customer_uuid（選填，依 Wonder 文件）
- **範例**：`WONDER_CUSTOMER_UUID=00000000-0000-0000-0000-000000000000`

### WONDER_API_KEY
- **說明**：Wonder API 認證金鑰（選填，若 API 需要 Bearer 或 X-API-Key）
- **範例**：`WONDER_API_KEY=your_api_key`

### 回調 URL
- Wonder 付款完成後會呼叫：`{DOMAIN}/web/webhook/wonder`（請在 Wonder 後台設定此 callback_url）

---

## 💳 Stripe 配置（PAYMENT_GATEWAY=stripe 時使用）

### STRIPE_SECRET_KEY / STRIPE_SECRET
- **說明**：Stripe 私鑰（後端建立 Checkout Session 用）
- **範例**：`STRIPE_SECRET_KEY=sk_live_xxx` 或 `STRIPE_SECRET=sk_live_xxx`

### STRIPE_PK（前端用）
- **說明**：Stripe 公鑰（Publishable key），供前端載入 Stripe.js 用（若前端有使用）
- **範例**：`STRIPE_PK=pk_live_xxx`

### STRIPE_WEBHOOK_SECRET / STRIPE_WH_SECRET
- **說明**：Stripe Webhook 簽名密鑰（在 Stripe Dashboard → Developers → Webhooks 建立 endpoint 後取得）
- **範例**：`STRIPE_WEBHOOK_SECRET=whsec_xxx`
- **Webhook URL**：`{DOMAIN}/web/webhook/stripe`（請在 Stripe 後台新增此 URL，事件選 `checkout.session.completed`）

### STRIPE_CURRENCY（選填）
- **說明**：Stripe 金額幣別（小寫），預設 `hkd`
- **範例**：`STRIPE_CURRENCY=hkd`

---

## 📧 郵件配置（選填）

### SendGrid
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com
```

### AWS SES
```env
AWS_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
SENDER_EMAIL=noreply@yourdomain.com
```

## 📱 SMS 配置（選填 - 使用 Twilio）

### Twilio
```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**或者使用舊的環境變數名稱（向後兼容）**：
```env
twiliosid=your_twilio_account_sid
twilioauthtoken=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**獲取方式**：
1. 註冊 [Twilio 帳號](https://www.twilio.com/)
2. 在 Twilio Console Dashboard 獲取 Account SID 和 Auth Token
3. 購買或使用 Twilio 提供的電話號碼作為發送號碼
4. 電話號碼格式必須包含國家代碼（例如：+85212345678）

**注意**：
- `TWILIO_PHONE_NUMBER` 必須是已驗證的 Twilio 號碼
- 電話號碼格式：`+[國家代碼][號碼]`（例如：`+85212345678`）
- 支持使用 `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` 或 `twiliosid`/`twilioauthtoken`（向後兼容）

---

## 🔐 Session 配置

### SESSION_SECRET
- **說明**：Session 加密密鑰
- **範例**：`SESSION_SECRET=your_random_secret_key_here`
- **建議**：使用隨機生成的長字串

---

## 📝 編輯器配置（選填）

### TINYMCE_API_KEY
- **說明**：TinyMCE 富文本編輯器的 API Key
- **範例**：`TINYMCE_API_KEY=0o0ixrpieipnq3fsu3kbsdu9e627qg468y6lpup3gmhx8lz7`
- **用途**：用於電子郵件模板和 SMS 模板的富文本編輯器
- **獲取方式**：[TinyMCE Cloud Dashboard](https://www.tiny.cloud/my-account/dashboard/)
- **注意**：如果不設置，系統會使用默認的 API Key（可能有使用限制）

---

## 📝 完整的 .env 範例

### 本地開發環境

```env
# Server Configuration
PORT=3377
DOMAIN=http://localhost:3377

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/checkinSystem

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Session Secret
SESSION_SECRET=events

# TinyMCE API Key (選填)
TINYMCE_API_KEY=0o0ixrpieipnq3fsu3kbsdu9e627qg468y6lpup3gmhx8lz7
```

### 生產環境

```env
# Server Configuration
PORT=3377
DOMAIN=https://demo.brandactivation.hk

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/checkinSystem

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_51xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Email Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
# 或使用 AWS SES
AWS_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
SENDER_EMAIL=noreply@yourdomain.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Session Secret
SESSION_SECRET=your_production_secret_key_here

# TinyMCE API Key (選填)
TINYMCE_API_KEY=your_tinymce_api_key_here
```

---

## 🔄 DOMAIN 變數的使用

### 在 Stripe Checkout 中的使用

```javascript
// controllers/eventsController.js (第 1136-1137 行)
success_url: `${process.env.DOMAIN}/web/${event_id}/register/success?session_id={CHECKOUT_SESSION_ID}`
cancel_url: `${process.env.DOMAIN}/web/${event_id}/register/fail?session_id={CHECKOUT_SESSION_ID}`
```

### 生成的 URL 範例

**本地開發**：
```
success_url: http://localhost:3377/web/68c7be905b97103e87009fb6/register/success?session_id={CHECKOUT_SESSION_ID}
cancel_url: http://localhost:3377/web/68c7be905b97103e87009fb6/register/fail?session_id={CHECKOUT_SESSION_ID}
```

**生產環境**：
```
success_url: https://demo.brandactivation.hk/web/68c7be905b97103e87009fb6/register/success?session_id={CHECKOUT_SESSION_ID}
cancel_url: https://demo.brandactivation.hk/web/68c7be905b97103e87009fb6/register/fail?session_id={CHECKOUT_SESSION_ID}
```

---

## ⚠️ 重要注意事項

### 1. DOMAIN 設定
- ✅ **正確**：`DOMAIN=https://demo.brandactivation.hk`
- ✅ **正確**：`DOMAIN=http://localhost:3377`
- ❌ **錯誤**：`DOMAIN=demo.brandactivation.hk` （缺少協議）
- ❌ **錯誤**：`DOMAIN=https://demo.brandactivation.hk/` （多了斜線）

### 2. 環境切換
切換環境時需要同步修改：
- `.env` 中的 `DOMAIN`
- Stripe Dashboard 中的 Webhook 端點 URL
- Stripe Dashboard 中使用的 API Key（test vs live）

### 3. 安全性
- ⚠️ **絕對不要**將 `.env` 文件提交到 Git
- ⚠️ `.env` 已在 `.gitignore` 中
- ✅ 使用 `.env.example` 作為範例（不含實際密鑰）

### 4. Stripe Webhook 配置
確保 Stripe Webhook 端點 URL 與 `DOMAIN` 一致：
```
Webhook URL: {DOMAIN}/web/webhook/stripe
範例: https://demo.brandactivation.hk/web/webhook/stripe
```

---

## 🧪 測試配置

### 檢查 DOMAIN 是否正確設定

```javascript
// 在 Node.js 中測試
console.log('DOMAIN:', process.env.DOMAIN);
// 應該輸出：DOMAIN: https://demo.brandactivation.hk
```

### 測試 Stripe Checkout

1. 啟動應用程式
2. 訪問註冊頁面並選擇付費票券
3. 點擊支付按鈕
4. 在 Stripe Checkout 頁面查看網址列
5. 支付成功後應該重定向到：`{DOMAIN}/web/{event_id}/register/success`

---

## 📞 問題排查

### 問題 1: Stripe Checkout 重定向失敗

**症狀**：支付成功後沒有重定向或重定向到錯誤頁面

**檢查**：
```bash
# 檢查 .env 中的 DOMAIN
cat .env | grep DOMAIN

# 應該看到類似：
# DOMAIN=https://demo.brandactivation.hk
```

**解決**：確保 `DOMAIN` 設定正確，包含協議且無斜線

### 問題 2: Webhook 簽名驗證失敗

**症狀**：`Webhook signature verification failed`

**檢查**：
1. 確認 `STRIPE_WEBHOOK_SECRET` 正確
2. 確認使用的是對應環境的 Secret（test vs live）

### 問題 3: 無法連接資料庫

**症狀**：`MongooseError: ...`

**檢查**：
```bash
# 檢查 MongoDB URI
cat .env | grep MONGODB_URI
```

---

## 🚀 部署檢查清單

部署到生產環境前，請確認：

- [ ] `DOMAIN` 設定為生產環境域名（`https://...`）
- [ ] `STRIPE_SECRET_KEY` 使用 live key（`sk_live_...`）
- [ ] `STRIPE_WEBHOOK_SECRET` 使用生產環境的 webhook secret
- [ ] Stripe Dashboard 的 Webhook 端點指向生產環境
- [ ] `MONGODB_URI` 指向生產環境資料庫
- [ ] `SESSION_SECRET` 使用強密碼
- [ ] 已設定 SSL 證書（HTTPS）
- [ ] `.env` 文件權限設定正確（不可公開讀取）

---

## 📚 相關文檔

- [Stripe Checkout 文檔](https://stripe.com/docs/payments/checkout)
- [Stripe Webhook 文檔](https://stripe.com/docs/webhooks)
- [環境變數最佳實踐](https://12factor.net/config)



