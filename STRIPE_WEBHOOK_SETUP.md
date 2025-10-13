# Stripe Webhook 設定指南

## 📋 目前實現狀態

### ✅ 已完成
1. **Webhook 端點**: `/web/webhook/stripe` (已在 `app.js` 配置)
2. **Webhook 處理函數**: `exports.stripeWebhook` (已優化)
3. **Transaction 模型**: 完整的交易記錄系統
4. **錯誤處理**: 完善的日誌和錯誤處理
5. **重複檢查**: 防止用戶重複添加到 event.users

---

## 🔧 Webhook 功能說明

### 處理的事件類型

#### 1. `checkout.session.completed` (支付成功)
**流程**:
```
1. 驗證 Webhook 簽名
2. 根據 stripeSessionId 查找 Transaction
3. 更新 Transaction status 為 'paid'
4. 查找對應的 Event
5. 檢查用戶是否已存在
   - 如果存在：更新 paymentStatus 為 'paid'
   - 如果不存在：添加新用戶到 event.users
6. 保存 Event
7. 返回成功響應
```

**更新的資料**:
- Transaction: `status` = 'paid', `updatedAt`
- Event.users: 新增或更新用戶
  - `email`, `name`, `company`, `phone_code`, `phone`
  - `paymentStatus` = 'paid'
  - `isCheckIn` = false
  - `role` = 'guests'

#### 2. `checkout.session.expired` (Session 過期)
**流程**:
```
1. 驗證 Webhook 簽名
2. 根據 stripeSessionId 查找 Transaction
3. 更新 Transaction status 為 'failed'
4. 返回成功響應
```

#### 3. `payment_intent.payment_failed` (支付失敗)
**流程**:
```
1. 驗證 Webhook 簽名
2. 記錄日誌
3. 返回成功響應
(未完整實現，需要根據需求添加邏輯)
```

---

## 📝 環境變數設定

確保 `.env` 文件包含以下變數：

```env
# Stripe 配置
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### 如何獲取 Webhook Secret:

1. 登入 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 進入 **Developers > Webhooks**
3. 點擊 **Add endpoint**
4. 設定端點 URL: `https://yourdomain.com/web/webhook/stripe`
5. 選擇要監聽的事件:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed` (可選)
6. 保存後，複製 **Signing secret** 到 `.env` 的 `STRIPE_WEBHOOK_SECRET`

---

## 🧪 測試 Webhook

### 方法 1: 使用 Stripe CLI (推薦)

1. **安裝 Stripe CLI**:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # 其他系統請參考: https://stripe.com/docs/stripe-cli
   ```

2. **登入 Stripe**:
   ```bash
   stripe login
   ```

3. **轉發 Webhook 到本地**:
   ```bash
   stripe listen --forward-to localhost:3377/web/webhook/stripe
   ```
   
   這會顯示一個測試用的 webhook secret，例如:
   ```
   whsec_xxxxxxxxxxxxxxxxxxxxx
   ```
   將這個 secret 暫時設定到 `.env` 的 `STRIPE_WEBHOOK_SECRET`

4. **觸發測試事件**:
   ```bash
   # 測試支付成功
   stripe trigger checkout.session.completed
   
   # 測試 session 過期
   stripe trigger checkout.session.expired
   ```

5. **查看日誌**:
   在你的應用控制台查看日誌輸出

### 方法 2: 使用 Ngrok (測試生產環境)

1. **安裝並啟動 Ngrok**:
   ```bash
   ngrok http 3377
   ```

2. **獲取公開 URL**:
   ```
   https://xxxx-xxxx-xxxx.ngrok.io
   ```

3. **在 Stripe Dashboard 設定 Webhook**:
   - URL: `https://xxxx-xxxx-xxxx.ngrok.io/web/webhook/stripe`
   - 選擇事件並保存

4. **執行真實支付測試**:
   使用 Stripe 測試卡號進行支付測試

### Stripe 測試卡號

```
成功支付: 4242 4242 4242 4242
失敗支付: 4000 0000 0000 0002
需要 3D Secure: 4000 0025 0000 3155

CVC: 任意 3 位數
到期日: 未來任意日期
郵遞區號: 任意數字
```

---

## 🔍 Debug 檢查清單

### 1. 檢查 Webhook 是否收到請求
```bash
# 查看應用日誌
tail -f /path/to/your/log/file

# 應該看到:
# Webhook received: { type: 'checkout.session.completed', timestamp: '...' }
```

### 2. 檢查簽名驗證
```bash
# 如果看到以下錯誤:
# Webhook signature verification failed: ...

# 檢查:
- STRIPE_WEBHOOK_SECRET 是否正確
- 端點路由是否使用 express.raw({type: 'application/json'})
- 是否有其他中間件干擾 req.body
```

### 3. 檢查 Transaction 是否創建
```javascript
// 在 MongoDB 中查詢
db.transactions.find({ status: 'pending' })

// 應該看到創建的 transaction 記錄
```

### 4. 檢查 Event.users 是否更新
```javascript
// 在 MongoDB 中查詢
db.events.findOne({ _id: ObjectId('...') })

// 檢查 users 陣列是否包含新用戶
// 檢查 paymentStatus 是否為 'paid'
```

---

## 📊 常見問題排查

### 問題 1: Webhook 沒有收到請求
**可能原因**:
- Stripe Webhook 端點 URL 設定錯誤
- 防火牆阻擋 Stripe IP
- 伺服器未運行

**解決方案**:
```bash
# 檢查伺服器是否運行
curl http://localhost:3377/web/webhook/stripe

# 使用 Stripe CLI 測試
stripe listen --forward-to localhost:3377/web/webhook/stripe
```

### 問題 2: 簽名驗證失敗
**可能原因**:
- `STRIPE_WEBHOOK_SECRET` 錯誤
- `req.body` 被其他中間件修改
- 使用錯誤的 Stripe 端點 (test vs live)

**解決方案**:
```javascript
// 確保在 app.js 中 webhook 路由在 express.json() 之前
app.post('/web/webhook/stripe', 
  express.raw({type: 'application/json'}), 
  eventsController.stripeWebhook
);
app.use(express.json()); // 這行要在 webhook 路由之後
```

### 問題 3: Transaction 找不到
**可能原因**:
- Transaction 創建失敗
- `stripeSessionId` 不匹配
- Webhook 比 Transaction 創建先到達 (罕見)

**解決方案**:
```javascript
// 在 stripeCheckout 中添加日誌
console.log('Transaction created:', {
  stripeSessionId: session.id,
  eventId: event_id,
  userEmail: email
});

// 在 webhook 中添加重試邏輯 (可選)
if (!transaction) {
  // 等待 1 秒後重試
  await new Promise(resolve => setTimeout(resolve, 1000));
  transaction = await Transaction.findOne({ stripeSessionId: session.id });
}
```

### 問題 4: 用戶重複添加
**已解決**: 程式碼中已包含重複檢查邏輯
```javascript
const existingUser = eventDoc.users.find(u => u.email === transaction.userEmail);
if (existingUser) {
  // 更新現有用戶
} else {
  // 添加新用戶
}
```

---

## 🚀 部署檢查清單

### 開發環境
- [ ] 安裝 Stripe CLI
- [ ] 設定本地 Webhook Secret
- [ ] 測試支付成功流程
- [ ] 測試支付失敗流程
- [ ] 檢查日誌輸出

### 生產環境
- [ ] 在 Stripe Dashboard 設定 Webhook 端點
- [ ] 複製正確的 Webhook Secret 到生產環境 `.env`
- [ ] 使用 HTTPS (Stripe 要求)
- [ ] 測試端點是否可訪問
- [ ] 執行真實支付測試
- [ ] 監控 Webhook 日誌
- [ ] 設定 Webhook 失敗警報 (可選)

---

## 📚 相關文件

- [Stripe Webhook 文檔](https://stripe.com/docs/webhooks)
- [Stripe CLI 文檔](https://stripe.com/docs/stripe-cli)
- [Stripe 測試卡號](https://stripe.com/docs/testing)
- [Checkout Session 完成事件](https://stripe.com/docs/api/events/types#event_types-checkout.session.completed)

---

## 🔄 完整流程圖

```
用戶註冊並支付
    ↓
stripeCheckout() 創建 Checkout Session
    ↓
創建 Transaction (status: 'pending')
    ↓
重定向到 Stripe Checkout 頁面
    ↓
用戶完成支付
    ↓
Stripe 發送 checkout.session.completed Webhook
    ↓
stripeWebhook() 接收並驗證
    ↓
更新 Transaction (status: 'paid')
    ↓
查找 Event 並添加/更新用戶
    ↓
用戶可以 check-in 參加活動
```

---

## ⚡ 性能優化建議

1. **添加索引**:
```javascript
// 在 Transaction 模型中
transactionSchema.index({ stripeSessionId: 1 });
transactionSchema.index({ eventId: 1, userEmail: 1 });
```

2. **添加 Webhook 日誌記錄**:
```javascript
// 可以創建一個 WebhookLog 模型記錄所有 webhook 事件
const webhookLogSchema = new mongoose.Schema({
  eventType: String,
  sessionId: String,
  status: String,
  error: String,
  receivedAt: Date,
  processedAt: Date
});
```

3. **添加郵件通知** (可選):
```javascript
// 在支付成功後發送確認郵件
if (transaction && eventDoc) {
  await sendPaymentConfirmationEmail(transaction.userEmail, {
    eventName: eventDoc.name,
    ticketTitle: transaction.ticketTitle,
    amount: transaction.ticketPrice
  });
}
```

---

## 📞 支援

如有問題，請檢查:
1. 應用日誌
2. Stripe Dashboard > Webhooks > 查看失敗記錄
3. MongoDB 中的 Transaction 和 Event 數據


