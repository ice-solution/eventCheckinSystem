# Brother QL-820NWB Printer Bridge

使用 Flask 建立的打印橋接服務，用於控制 Brother QL-820NWB 標籤打印機。

## 功能特點

- ✅ 透過 HTTP API 控制打印機
- ✅ 支援 62mm x 100mm 標籤尺寸
- ✅ 自動生成 QR Code
- ✅ 支援單張和批量打印
- ✅ 跨域支援 (CORS)
- ✅ 網路/USB 打印支援

## 安裝步驟

### 1. 安裝 Python 依賴

```bash
pip install -r printer_bridge_requirements.txt
```

### 2. 配置環境變量（可選）

創建 `.env` 文件或設置環境變量：

```bash
# 打印機 IP 地址（可選，如果不設置會自動發現）
PRINTER_IP=192.168.1.100

# Flask 服務端口
PRINTER_BRIDGE_PORT=5000

# 調試模式
FLASK_DEBUG=False
```

**注意**: 如果不設置 `PRINTER_IP`，系統會自動嘗試發現打印機！

### 3. 啟動服務

```bash
python printer_bridge.py
```

服務將在 `http://localhost:5000` 啟動，並自動嘗試發現打印機 IP

## API 使用說明

### 健康檢查

```bash
GET http://localhost:5000/health
```

返回當前使用的打印機 IP（可能是自動發現的）

### 發現打印機

#### 發現所有打印機

```bash
GET http://localhost:5000/discover
```

返回所有發現的打印機列表，包括：
- IP 地址
- 端口
- 發現方法（mDNS/CUPS/Network Scan）
- 打印機名稱

#### 專門發現 Brother QL-820NWB

```bash
GET http://localhost:5000/discover/brother
```

自動查找並設置 Brother QL-820NWB 打印機 IP

### 單張打印

```bash
POST http://localhost:5000/print
Content-Type: application/json

{
  "name": "張三",
  "company": "ABC 公司",
  "qrcode": "USER123"  // 可選，默認使用 name
}
```

### 批量打印

```bash
POST http://localhost:5000/print/batch
Content-Type: application/json

[
  {
    "name": "張三",
    "company": "ABC 公司",
    "qrcode": "USER123"
  },
  {
    "name": "李四",
    "company": "XYZ 公司",
    "qrcode": "USER124"
  }
]
```

## 在 Node.js 中調用

在現有的 Node.js 應用中，可以這樣調用：

```javascript
const axios = require('axios');

async function printBadge(name, company, qrcode) {
  try {
    const response = await axios.post('http://localhost:5000/print', {
      name: name,
      company: company,
      qrcode: qrcode || name
    });
    console.log('打印成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('打印失敗:', error.message);
    throw error;
  }
}

// 使用範例
printBadge('張三', 'ABC 公司', 'USER123');
```

## 打印機連接方式

### 方式 1: 自動發現（推薦）✨

系統會自動使用以下方法發現打印機：

1. **mDNS/Bonjour 發現**（最快）
   - Brother 打印機通常支援 mDNS
   - 自動發現同一網路上的打印機
   - 無需手動配置 IP

2. **CUPS 查詢**（Mac/Linux）
   - 查詢系統已安裝的打印機
   - 從 CUPS 配置中獲取 IP

3. **網路掃描**（最全面）
   - 掃描本地網路尋找打印端口（9100, 515, 631）
   - 較慢但最可靠

**使用方式**：
- 不設置 `PRINTER_IP` 環境變量，系統會自動發現
- 或使用 API: `GET /discover/brother` 手動觸發發現

### 方式 2: 手動設置 IP

1. 確保 QL-820NWB 連接到同一網路
2. 在打印機設置中找到 IP 地址
3. 設置 `PRINTER_IP` 環境變量

### 方式 3: USB 連接

1. 連接 USB 線
2. 在系統中添加打印機（Mac: 系統偏好設置 > 打印機）
3. 使用 CUPS 打印（自動檢測）

### 方式 4: 使用 Brother SDK

如果需要更進階的功能，可以安裝 Brother SDK：

```bash
# 下載 Brother SDK (需要從官網下載)
# 然後使用 SDK 的 Python 綁定
```

## 標籤尺寸配置

當前設定為 **62mm x 100mm**，可以在 `printer_bridge.py` 中修改：

```python
LABEL_WIDTH_MM = 62
LABEL_HEIGHT_MM = 100
```

## 動態發現打印機

系統支援多種方法自動發現打印機 IP：

### 測試發現功能

```bash
# 直接運行發現模組
python printer_discovery.py
```

### 在代碼中使用

```python
from printer_discovery import discover_printer_ip, discover_all_printers

# 快速獲取第一個打印機 IP
ip = discover_printer_ip()
print(f"發現打印機: {ip}")

# 獲取所有打印機
all_printers = discover_all_printers()
for printer in all_printers:
    print(f"{printer['name']} - {printer['ip']}")
```

### 透過 API 使用

```javascript
// 發現所有打印機
fetch('http://localhost:5000/discover')
  .then(res => res.json())
  .then(data => {
    console.log('發現的打印機:', data.printers);
  });

// 專門發現 Brother QL-820NWB
fetch('http://localhost:5000/discover/brother')
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      console.log('找到 Brother 打印機:', data.printer);
    }
  });
```

## 故障排除

### 1. 打印機無法連接

- **自動發現失敗**: 嘗試手動設置 `PRINTER_IP` 環境變量
- 檢查打印機 IP 地址是否正確
- 確認打印機和電腦在同一網路
- 檢查防火牆設置
- 使用 `/discover` API 查看是否能發現打印機

### 2. 自動發現功能不工作

- **mDNS 失敗**: 確保打印機支援 Bonjour/mDNS
- **CUPS 失敗**: 確保已安裝 CUPS 並添加打印機
- **網路掃描失敗**: 檢查網路連接，可能需要更長的掃描時間

### 2. CUPS 打印失敗

- Mac: 確保已添加打印機到系統
- Linux: 安裝 CUPS: `sudo apt-get install cups`

### 3. 圖像生成錯誤

- 確保已安裝 Pillow: `pip install Pillow`
- 檢查字體路徑（Mac 使用 `/System/Library/Fonts/`）

## 與現有系統整合

修改 `views/admin/scan_checkin.ejs` 中的 `printLabel()` 函數：

```javascript
function printLabel() {
    const detailsElement = document.getElementById('detailsContent');
    const name = detailsElement.querySelector('h4').textContent;
    const company = detailsElement.querySelector('p:nth-of-type(2)').textContent.replace('Company: ', '');
    
    // 使用 Flask bridge 替代 URL scheme
    fetch('http://localhost:5000/print', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            company: company,
            qrcode: name
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('打印成功:', data);
        alert('標籤已發送到打印機');
    })
    .catch(error => {
        console.error('打印失敗:', error);
        alert('打印失敗，請檢查打印機連接');
    });
}
```

## 注意事項

- 確保 Flask 服務持續運行
- 建議使用 `systemd` (Linux) 或 `launchd` (Mac) 管理服務
- 生產環境建議使用 `gunicorn` 或 `uWSGI` 運行 Flask

