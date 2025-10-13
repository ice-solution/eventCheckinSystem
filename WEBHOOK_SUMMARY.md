# Stripe Webhook 實現總結

## ✅ 系統狀態：完全可用

您的 Stripe Webhook 已經正確實現並可以使用！

---

## 📊 當前實現

### 1. **Webhook 端點配置** ✅
```javascript
// app.js 第 35 行
app.post('/web/webhook/stripe', express.raw({type: 'application/json'}), eventsController.stripeWebhook);
```

**重要**: 這行必須在 `express.json()` 之前，因為 Stripe 需要原始的 request body 來驗證簽名。

**端點 URL**: `https://yourdomain.com/web/webhook/stripe`

---

### 2. **Webhook 處理函數** ✅

**位置**: `/controllers/eventsController.js` 第 1166-1278 行

**功能**:
- ✅ 驗證 Stripe 簽名
- ✅ 處理 `checkout.session.completed` 事件
- ✅ 處理 `checkout.session.expired` 事件
- ✅ 更新 Transaction 狀態
- ✅ 添加用戶到 Event.users
- ✅ 防止重複添加用戶
- ✅ 完整的錯誤處理和日誌

---

### 3. **交易流程** ✅

```
用戶註冊 → 創建 Checkout Session → 創建 Transaction (pending)
                                              ↓
                                        用戶完成支付
                                              ↓
                                    Stripe 發送 Webhook
                                              ↓
                                驗證簽名並處理事件
                                              ↓
                        更新 Transaction (paid) + 添加用戶到 Event
                                              ↓
                                    用戶可以 Check-in
```

---

## 🔧 如何使用

### 環境變數設定

在 `.env` 文件中添加：

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### 在 Stripe Dashboard 設定

1. 前往: https://dashboard.stripe.com/webhooks
2. 點擊 "Add endpoint"
3. 輸入 URL: `https://yourdomain.com/web/webhook/stripe`
4. 選擇事件:
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
5. 複製 "Signing secret" 到 `.env`

---

## 🧪 測試方法

### 方法 1: 使用測試腳本 (推薦)

```bash
# 檢查系統配置
node test_stripe_webhook.js check

# 列出所有 transactions
node test_stripe_webhook.js list

# 測試完整流程
node test_stripe_webhook.js test
```

### 方法 2: 使用 Stripe CLI

```bash
# 安裝 Stripe CLI
brew install stripe/stripe-cli/stripe

# 登入
stripe login

# 轉發 webhook 到本地
stripe listen --forward-to localhost:3377/web/webhook/stripe

# 觸發測試事件
stripe trigger checkout.session.completed
```

### 方法 3: 真實支付測試

使用 Stripe 測試卡號:
- **成功**: 4242 4242 4242 4242
- **失敗**: 4000 0000 0000 0002
- CVC: 任意 3 位數
- 到期日: 未來任意日期

---

## 📋 Webhook 處理的資料

### 支付成功時 (checkout.session.completed)

**更新 Transaction**:
```javascript
{
  status: 'paid',           // 從 'pending' 更新為 'paid'
  updatedAt: Date           // 更新時間
}
```

**添加到 Event.users**:
```javascript
{
  email: transaction.userEmail,
  name: transaction.userName,
  company: session.metadata.company,
  phone_code: session.metadata.phone_code,
  phone: session.metadata.phone,
  paymentStatus: 'paid',    // 付款狀態
  isCheckIn: false,         // 尚未簽到
  role: 'guests',           // 角色
  create_at: Date,
  modified_at: Date
}
```

### Session 過期時 (checkout.session.expired)

**更新 Transaction**:
```javascript
{
  status: 'failed',         // 從 'pending' 更新為 'failed'
  updatedAt: Date
}
```

---

## 🔍 監控和日誌

### 應用日誌

Webhook 會輸出以下日誌:

```javascript
// 收到 webhook
Webhook received: { type: 'checkout.session.completed', timestamp: '...' }

// 驗證成功
Webhook verified successfully: checkout.session.completed

// 處理流程
Processing checkout.session.completed: cs_test_xxxxx
Transaction updated: 507f1f77bcf86cd799439011
Event updated successfully: 507f1f77bcf86cd799439012

// 或者發現問題
Transaction not found for session: cs_test_xxxxx
Event not found: 507f1f77bcf86cd799439011
User already exists, updating payment status: user@example.com
```

### Stripe Dashboard

在 Stripe Dashboard 的 Webhooks 頁面可以看到:
- ✅ 成功的 webhook (200 response)
- ❌ 失敗的 webhook (可以重新發送)
- 📊 Webhook 統計

---

## ⚠️ 常見問題

### 1. Webhook 簽名驗證失敗

**症狀**: `Webhook signature verification failed`

**原因**:
- `STRIPE_WEBHOOK_SECRET` 錯誤
- Webhook 端點路由配置錯誤

**解決**:
```javascript
// 確保 app.js 中這行在 express.json() 之前
app.post('/web/webhook/stripe', 
  express.raw({type: 'application/json'}), 
  eventsController.stripeWebhook
);
app.use(express.json()); // 這行要在後面
```

### 2. Transaction 找不到

**症狀**: `Transaction not found for session`

**原因**:
- 用戶沒有完成 checkout flow
- Transaction 創建失敗
- Session ID 不匹配

**檢查**:
```bash
# 在 MongoDB 中檢查
db.transactions.find({ stripeSessionId: 'cs_test_xxxxx' })
```

### 3. 用戶重複添加

**已解決**: 程式碼已包含重複檢查
```javascript
const existingUser = eventDoc.users.find(u => u.email === transaction.userEmail);
if (existingUser) {
  // 只更新 payment status，不重複添加
}
```

---

## 🚀 生產環境部署

### 檢查清單

- [ ] 設定正確的 `STRIPE_SECRET_KEY` (live key, 以 `sk_live_` 開頭)
- [ ] 設定正確的 `STRIPE_WEBHOOK_SECRET` (從 Stripe Dashboard 獲取)
- [ ] 確保伺服器使用 HTTPS (Stripe 要求)
- [ ] 在 Stripe Dashboard 設定生產環境 webhook 端點
- [ ] 測試完整的支付流程
- [ ] 監控 webhook 日誌
- [ ] 設定錯誤警報 (可選但推薦)

### 安全建議

1. **不要在日誌中記錄敏感資料**
   - ❌ 不要記錄完整的卡號
   - ❌ 不要記錄 CVV
   - ✅ 可以記錄 session ID
   - ✅ 可以記錄 email

2. **驗證所有 webhook**
   - ✅ 總是驗證 Stripe 簽名
   - ✅ 已實現在程式碼中

3. **冪等性處理**
   - ✅ 檢查用戶是否已存在
   - ✅ 使用 `findOneAndUpdate` 避免重複更新

---

## 📚 相關文檔

- [完整設定指南](./STRIPE_WEBHOOK_SETUP.md)
- [Stripe Webhook 官方文檔](https://stripe.com/docs/webhooks)
- [測試腳本使用方法](./test_stripe_webhook.js)

---

## 📞 支援

如遇到問題:

1. **檢查應用日誌**
   ```bash
   tail -f /path/to/your/log
   ```

2. **檢查 Stripe Dashboard**
   - Webhooks > 查看失敗的 webhook
   - Logs > 查看 API 請求

3. **使用測試腳本**
   ```bash
   node test_stripe_webhook.js check
   ```

4. **查看資料庫**
   ```javascript
   // Transactions
   db.transactions.find().sort({createdAt: -1}).limit(10)
   
   // Events with users
   db.events.findOne({ _id: ObjectId('...') })
   ```

---

## ✨ 總結

您的 Stripe Webhook 實現:

✅ **功能完整** - 支持支付成功、失敗、過期等場景
✅ **錯誤處理** - 完善的錯誤處理和日誌記錄
✅ **安全性** - 驗證 Stripe 簽名
✅ **資料完整性** - 防止重複添加用戶
✅ **可測試** - 提供測試腳本和工具
✅ **可監控** - 詳細的日誌輸出

**準備就緒，可以部署到生產環境！** 🎉

