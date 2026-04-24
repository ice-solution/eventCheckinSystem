# EventCheckinSystem - CLAUDE.md

企業級活動簽到與管理系統 (Event Check-in & Management System)

---

## 系統概覽

Node.js + Express + MongoDB 建構的多功能活動管理平台，支援完整活動生命週期：報名、簽到、抽獎、積分、投票、支付、郵件/SMS 通知。

**主要技術棧**
- 後端：Express.js 4.x、MongoDB 8.x (Mongoose)、Socket.IO 4.x
- 前端：EJS 模板、Bootstrap 4、jQuery、DataTables
- 支付：Stripe、Wonder Payment
- 郵件：SendGrid、AWS SES、Nodemailer
- SMS：Twilio、Plivo
- 其他：JWT (iPad API)、bcrypt、QRCode、Canvas、ExcelJS

---

## 目錄結構

```
EventCheckinSystem/
├── app.js                    # 主入口，Express 設定、路由掛載
├── socket.js                 # Socket.IO 初始化與抽獎事件
├── package.json
│
├── controllers/              # 業務邏輯（14 個控制器）
├── model/                    # Mongoose 模型（14 個）
├── routes/                   # API 路由（13 個檔案）
├── middleware/
│   └── permission.js         # 細粒度事件權限控制
├── utils/                    # 工具函式（郵件、支付、JWT）
├── views/                    # EJS 模板（115 個）
│   ├── admin/                # 後台頁面（48 個）
│   └── pages/                # 公開頁面
├── public/                   # 靜態資源
├── template/                 # 郵件模板函式（welcomeEmail.js 等）
├── games/                    # 遊戲子模組（git submodule）
├── luckydraw/                # 抽獎顯示頁面（Vue.js 建構）
│
├── scripts/                  # 一次性與維運工具腳本
│   ├── update-users-remarks-from-xlsx.js
│   ├── sendSms.js
│   └── download_kaiti_fonts.sh
├── printer/                  # Printer Bridge 獨立服務（Python）
│   ├── printer_bridge.py
│   ├── printer_discovery.py
│   └── printer_bridge_requirements.txt
├── tests/                    # 手動測試腳本與測試頁面
│   ├── test_game_api.js
│   ├── test_banner.html
│   ├── test_banner_upload.html
│   └── test_tinymce_images.html
├── docs/                     # API collection 與參考文件
│   └── iPad_API.postman_collection.json
├── data/                     # 範例與一次性匯入資料
│   └── aia.xlsx
├── nodejs/                   # Wonder Payment 簽名工具（獨立原型）
│
# 下列腳本因有 require('./model/...) 相對路徑，必須留在根目錄執行：
├── importData.js             # 批量匯入用戶（依賴 prud.xlsx 在根目錄）
├── list_events_templates.js  # 列出事件與 SMS 模板
├── send_welcome_emails.js    # 批量發送歡迎郵件
├── test_sms_direct.js        # SMS 發送測試
├── test_sms_template.js      # SMS 模板測試
├── test_sms_with_template_content.js
├── test_stripe_webhook.js    # Stripe Webhook 測試
├── prud.xlsx                 # importData.js 依賴此路徑
└── v3.xlsx                   # scripts/update-users-remarks-from-xlsx.js 依賴此路徑
```

---

## 核心模型

### Event（主核心）
單一 Event document 內嵌所有相關資料：
- `users[]` - RSVP 報名用戶（含動態表單欄位）
- `guestList[]` - 預邀來賓名單
- `winners[]` - 抽獎中獎者
- `points[]` - 積分類型定義
- `scanPointUsers[]` - 用戶積分記錄
- `treasureHuntItems[]` - 尋寶項目
- `PaymentTickets[]` - 付費票券
- `emailSettings` - 郵件發送設定
- `attachments[]` - 事件附件

### Auth（認證）
- `role`: admin | staff | reception | user
- `allowedEvents[]` - 可存取的事件 ObjectId
- `eventPermissions[]` - 細粒度功能權限（22 個功能鍵）

### FormConfig（動態表單）
- `sections[]` - 表單分區（含欄位）
- 支援 7 種欄位類型：text, email, tel, select, textarea, checkbox, radio
- 雙語標籤、選項、佔位符（zh/en）

---

## 權限系統

### 角色
- **admin** - 全站管理員，無限制
- **staff** / **reception** - 受限用戶，依 `allowedEvents` 與 `eventPermissions`
- **user** - 一般用戶（前台）

### 22 個事件功能鍵
```
rsvp, guestList, emailTemplate, smsTemplate, badges,
qrcodeLogin, scanPointUsers, treasureHunt,
luckydrawList, luckydrawPanel, luckydrawAward,
luckydrawOpen, luckydrawSetting,
prizes, votes, website, formConfig,
transactions, attachments, scan, import,
banner, report, emailRecords
```

### 中間件
- `permission.refreshUserPermissions` - 無需重登即重載權限
- `permission.requireEventPermission(key)` - 路由層檢查功能鍵

---

## 主要路由

| 路由前綴 | 功能 |
|---------|------|
| `/events/:eventId/*` | 事件、用戶、簽到、抽獎、郵件、附件 |
| `/prizes/:eventId/*` | 獎品管理 |
| `/points/:eventId/*` | 積分系統 |
| `/votes/:eventId/*` | 投票系統 |
| `/formConfig/:eventId/*` | 動態表單配置 |
| `/emailTemplate/*` | 郵件模板 |
| `/awards/:eventId/*` | 中獎者管理 |
| `/auth/*` | 後台用戶管理 |
| `/api/ipad/*` | iPad JWT API |
| `/api/game/*` | 遊戲系統 API |
| `/track/email/*` | 郵件追蹤（公開，無認證） |
| `/web/webhook/*` | Stripe / Wonder Webhook |

---

## Socket.IO 抽獎系統

**房間機制**：每個事件用 `luckydraw:{eventId}` 房間

### 主要事件
| 方向 | 事件名 | 說明 |
|------|--------|------|
| 客戶端→服務端 | `join_luckydraw` | 加入房間 |
| 客戶端→服務端 | `luckydraw_panel_start` | 開始抽獎動畫 |
| 客戶端→服務端 | `luckydraw_panel_prize_selected` | 選定獎品 |
| 客戶端→服務端 | `luckydraw_panel_draw_count` | 更新抽獎數量（自動持久化至 DB） |
| 服務端→客戶端 | `luckydraw:start` | 廣播開始動畫 |
| 服務端→客戶端 | `luckydraw:controller_status` | 控制器上/離線 |

---

## 環境變數

### 必填
```env
MONGODB_URI=          # MongoDB 連線字串
DOMAIN=               # 公開域名（含 http/https，Webhook 回調用）
PORT=3377             # 應用端口（預設 3377）
```

### 郵件（至少一種）
```env
SENDGRID_API_KEY=
SENDER_EMAIL=
# 或 AWS SES
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
```

### SMS（可選）
```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

### 支付（擇一）
```env
PAYMENT_GATEWAY=stripe   # 或 wonder
# Stripe
STRIPE_SECRET_KEY=
STRIPE_PK=
STRIPE_WEBHOOK_SECRET=
# Wonder
WONDER_APP_ID=
WONDER_PRIVATE_KEY=
WONDER_CUSTOMER_UUID=
```

### 其他
```env
TINYMCE_API_KEY=         # 郵件編輯器
CORS_ENABLED=true
CORS_ORIGIN=             # 逗號分隔允許的 origin
SOCKET_PING_INTERVAL=10000
SOCKET_PING_TIMEOUT=8000
```

---

## 開發注意事項

### 用戶欄位為動態結構
`Event.users[].formData` 儲存動態表單資料，讀取時需根據 `FormConfig` 判斷欄位定義。舊有用戶可能使用 `name`, `email`, `phone` 等頂層欄位（向後相容）。

### 郵件模板變量替換
支援的替換變量：`{{user.name}}`, `{{user.email}}`, `{{event.name}}`, `{{qrcodeUrl}}`, `{{checkinLink}}` 等。詳見 `controllers/components/sendWelcomeEmail.js`。

### 徽章生成用 Canvas
`badgeController.js` 使用 Node.js Canvas 生成高清徽章圖片。元素支援：文字、QR Code 圖片嵌入。座標系統以毫米（mm）為單位，配合 DPI 換算像素。

### iPad API 使用 JWT
`/api/ipad/*` 端點需在 `Authorization: Bearer <token>` header 中附帶 JWT。透過 `POST /api/ipad/login` 取得 token。

### Printer Bridge（Python）
`printer_bridge.py` 是獨立 Python 服務，透過 WebSocket 接收列印指令，連接本機印表機。須單獨啟動，非 Node.js 應用的一部分。

---

## 常見操作

### 新增事件功能鍵
1. 在 `middleware/permission.js` 新增檢查函式
2. 在 `model/Auth.js` 的 `eventPermissions.functions` 枚舉中新增
3. 在後台用戶編輯頁面（`views/admin/auth_user_edit.ejs`）新增 checkbox

### 新增郵件模板類型
1. 在 `model/EmailTemplate.js` 的 `type` 枚舉新增
2. 在 `views/admin/create_email_template.ejs` 新增選項
3. 在 `controllers/eventsController.js` 的發送邏輯中處理新類型

### 新增表單欄位類型
1. 在 `model/FormConfig.js` 的 `type` 枚舉新增
2. 在 `views/` 的表單渲染模板新增對應 HTML
3. 在前端 JS 新增驗證邏輯

---

## 相關文件

### API 文件
| 文件 | 說明 |
|------|------|
| `IPAD_API_DOCUMENTATION.md` | iPad JWT API 完整文件 |
| `CHECKIN_API_DOCUMENTATION.md` | Check-in API 文件 |
| `GAME_API_DOCUMENTATION.md` | 遊戲 API 文件 |

### 功能設定
| 文件 | 說明 |
|------|------|
| `ENV_CONFIGURATION.md` | 環境變數詳解 |
| `BADGE_SETUP.md` | 徽章系統設定 |
| `FORM_CONFIG_DOCUMENTATION.md` | 動態表單配置指南 |
| `SMS_SETUP_GUIDE.md` | SMS 服務設定（Twilio / Plivo） |
| `STRIPE_WEBHOOK_SETUP.md` | Stripe Webhook 設定 |
| `WONDER_PAYMENT.md` | Wonder Payment 整合 |
| `PRINTER_BRIDGE_README.md` | 列印橋接服務（Python） |
| `FONT_DOWNLOAD_GUIDE.md` | 徽章字型下載說明 |

### 架構與部署
| 文件 | 說明 |
|------|------|
| `FEATURES_LIST.md` | 完整功能清單（234+ 項） |
| `SOCKET_IO_LUCKYDRAW.md` | Socket.IO 抽獎系統運作說明 |
| `DEPLOY_GAMES_SUBMODULE.md` | Games 子模組 CI/CD 部署指南 |

### 銷售與簡報
| 文件 | 說明 |
|------|------|
| `SALES_OVERVIEW.md` | 銷售賣點與差異化功能（對客戶用） |
| `PPT_PRESENTATION.md` | 簡報幻燈片資料 |
