# Badge 設計系統設置指南

## 概述

Badge 設計系統允許您為活動創建自定義標籤（100mm x 62mm，橫向），支持動態變量替換和 QR Code 生成。

## 安裝依賴

系統需要 `canvas` 包來生成圖片。請運行以下命令安裝：

```bash
npm install canvas
```

**注意**: `canvas` 是一個原生模組，可能需要編譯。如果安裝遇到問題，請參考 [node-canvas 文檔](https://github.com/Automattic/node-canvas)。

### macOS 安裝

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
npm install canvas
```

### Linux (Ubuntu/Debian) 安裝

```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install canvas
```

## 功能特點

1. **可視化設計**: 使用 Canvas 在瀏覽器中設計標籤
2. **動態字段**: 從 FormConfig 自動載入所有可用字段
3. **拖放功能**: 可以拖動元素調整位置
4. **動態變量**: 支持 `{{user.name}}`, `{{qrcodeUrl}}` 等變量
5. **測試預覽**: 生成測試圖片預覽效果
6. **實際打印**: 為每個用戶生成實際的 badge 圖片

## 使用流程

### 1. 訪問 Badge 設計頁面

```
http://your-domain.com/events/:eventId/badges
```

例如：`http://localhost:3377/events/507f1f77bcf86cd799439010/badges`

### 2. 設計標籤

1. **添加字段**: 點擊左側的字段列表，將字段添加到 canvas
2. **調整位置**: 點擊並拖動元素調整位置
3. **選擇元素**: 點擊元素進行選擇，可以查看和編輯屬性
4. **保存配置**: 點擊「儲存配置」按鈕保存設計

### 3. 生成測試圖片

點擊「生成測試圖片」按鈕，系統會：
- 使用測試數據生成 badge 圖片
- 顯示預覽
- 保存測試圖片 URL

### 4. 使用動態變量

在設計時可以使用以下變量：

- `{{user.name}}` - 用戶姓名
- `{{user.email}}` - 用戶電子郵件
- `{{user.company}}` - 公司名稱
- `{{user.phone}}` - 電話號碼
- `{{qrcodeUrl}}` - QR Code URL（自動生成）
- `{{user.<fieldName>}}` - 任何 FormConfig 中定義的字段

### 5. 生成實際 Badge

為特定用戶生成 badge：

```
GET /events/:eventId/badges/:userId/image
```

這會返回該用戶的 badge 圖片 URL。

## API 端點

### 獲取 Badge 配置
```
GET /events/:eventId/badges/config
```

### 保存 Badge 配置
```
POST /events/:eventId/badges/config
Content-Type: application/json

{
  "name": "Default Badge",
  "width": 62,
  "height": 100,
  "dpi": 300,
  "elements": [
    {
      "type": "text",
      "content": "{{user.name}}",
      "x": 50,
      "y": 50,
      "fontSize": 16,
      "fontFamily": "Arial",
      "color": "#000000"
    },
    {
      "type": "qrcode",
      "qrData": "{{qrcodeUrl}}",
      "x": 200,
      "y": 200,
      "width": 150,
      "height": 150
    }
  ]
}
```

### 生成測試圖片
```
POST /events/:eventId/badges/test-image
```

### 生成實際 Badge 圖片
```
GET /events/:eventId/badges/:userId/image
```

## 數據結構

### BadgeConfig 模型

```javascript
{
  eventId: ObjectId,
  name: String,
  width: Number,      // 毫米
  height: Number,     // 毫米
  dpi: Number,        // 默認 300
  elements: [
    {
      type: 'text' | 'qrcode' | 'image',
      x: Number,      // 像素座標
      y: Number,      // 像素座標
      width: Number,  // 像素（可選）
      height: Number, // 像素（可選）
      // 文本屬性
      content: String,
      fontSize: Number,
      fontFamily: String,
      fontWeight: String,
      textAlign: 'left' | 'center' | 'right',
      color: String,
      // QR Code 屬性
      qrData: String,
      // 圖片屬性
      imageUrl: String,
      zIndex: Number
    }
  ],
  testImageUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

## 注意事項

1. **Canvas 依賴**: 必須安裝 `canvas` 包才能生成圖片
2. **圖片存儲**: 生成的圖片保存在 `public/badges/` 目錄
3. **尺寸限制**: 標籤尺寸固定為 100mm x 62mm（橫向，約 1181px x 732px @ 300 DPI）
4. **變量替換**: 所有變量在生成圖片時才會被替換
5. **QR Code**: QR Code 會自動生成，包含用戶 ID

## 故障排除

### Canvas 安裝失敗

如果 `npm install canvas` 失敗，請確保已安裝必要的系統依賴（見上方安裝說明）。

### 圖片生成失敗

檢查：
1. `public/badges/` 目錄是否存在且可寫
2. Canvas 包是否正確安裝
3. 服務器日誌中的錯誤信息

### 變量未替換

確保變量格式正確：`{{user.name}}` 而不是 `{user.name}` 或 `{{user.name}`

