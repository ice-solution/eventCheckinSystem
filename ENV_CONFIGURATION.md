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
- **用途**：用於 Stripe Checkout 的重定向 URL
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

## 💳 Stripe 配置

### STRIPE_SECRET_KEY
- **說明**：Stripe 密鑰
- **範例**：
  - 測試環境：`STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx`
  - 生產環境：`STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx`
- **獲取方式**：[Stripe Dashboard](https://dashboard.stripe.com/apikeys)

### STRIPE_WEBHOOK_SECRET
- **說明**：Stripe Webhook 簽名密鑰
- **範例**：`STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx`
- **獲取方式**：[Stripe Webhooks](https://dashboard.stripe.com/webhooks)
- **設定步驟**：
  1. 在 Stripe Dashboard 創建 Webhook 端點
  2. 端點 URL：`https://yourdomain.com/web/webhook/stripe`
  3. 複製 Signing secret

---

## 📧 郵件配置（選填）

### SendGrid
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
```

### AWS SES
```env
AWS_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
```

---

## 🔐 Session 配置

### SESSION_SECRET
- **說明**：Session 加密密鑰
- **範例**：`SESSION_SECRET=your_random_secret_key_here`
- **建議**：使用隨機生成的長字串

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

# Session Secret
SESSION_SECRET=your_production_secret_key_here
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



