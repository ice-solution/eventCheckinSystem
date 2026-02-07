# Wonder Payment Gateway 整合

本分支以 **Wonder** 取代 Stripe 作為活動報名付費的支付閘道。

## 環境變數（.env）

| 變數 | 必填 | 說明 |
|------|------|------|
| `PAYMENT_DEV` 或 `payment_dev` | 否 | `true` → 使用測試環境 `https://gateway-stg.wonder.today`；否則 `https://gateway.wonder.today` |
| `WONDER_APP_ID` | 是 | Wonder 的 app_id（建立訂單 API 必填） |
| `WONDER_CUSTOMER_UUID` | 否 | Wonder 的 customer_uuid（依 Wonder 文件決定是否填寫） |
| `WONDER_API_KEY` | 否 | 若 Wonder API 需要 Bearer / X-API-Key 認證則填寫 |
| `DOMAIN` | 是 | 本站網域（含協定），用於 callback_url、redirect_url |

## 流程

1. 使用者於報名頁選擇付費票券並送出 → 後端建立 Transaction，呼叫 Wonder **建立訂單** API：`POST /svc/payment/api/v1/openapi/orders`。
2. 後端回傳 Wonder 的付款頁 URL，前端導向該 URL。
3. 使用者於 Wonder 完成付款後：
   - Wonder 會呼叫本站 **callback**：`{DOMAIN}/web/webhook/wonder`（GET 或 POST）。
   - 本站依 `reference_number`（Transaction _id）或 `order_id` 找到 Transaction，更新為已付款並寫入 event.users。
4. 使用者被導回本站成功頁：`/web/:event_id/register/success?session_id=...`。

## 檔案變更摘要

- **utils/wonderPayment.js**：Wonder 基底 URL、建立訂單、讀取 .env 設定。
- **controllers/eventsController.js**：`stripeCheckout` 改為呼叫 Wonder 建立訂單；新增 `wonderWebhook` 處理回調。
- **routes/websites.js**：成功/失敗頁以 `session_id` 查詢 Transaction（支援 stripeSessionId 或 _id）；新增 `GET/POST /webhook/wonder`。
- **app.js**：移除 Stripe webhook 專用路由（改由 Wonder webhook 處理）。
- **ENV_CONFIGURATION.md**：新增 Wonder 相關環境變數說明。

## Wonder 建立訂單 API Body 對應

本站送出之 body 結構與 Wonder 文件一致，其中：

- `app_id` ← `WONDER_APP_ID`
- `customer_uuid` ← `WONDER_CUSTOMER_UUID`（有設定才帶）
- `order.reference_number` ← Transaction 的 `_id`（回調時用來查詢）
- `order.line_items` ← 一筆票券（名稱、金額、數量）
- `order.callback_url` ← `{DOMAIN}/web/webhook/wonder`
- `order.redirect_url` ← `{DOMAIN}/web/:event_id/register/success?session_id={transaction._id}`

若 Wonder 回傳的 `payment_url` 或 `order_id` 欄位名稱與目前程式不同，請在 **utils/wonderPayment.js** 的 `createOrder` 回傳處理處調整對應 key。
