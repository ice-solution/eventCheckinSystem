# 標楷體字型下載指南

由於標楷體（DFKai-SB）是專有字型，無法直接下載。本指南提供免費可商用的替代字型下載方式。

## 推薦的替代字型

### 1. cwTeX Q Kai（最推薦 - 最接近標楷體）
- **授權**: GNU GPL v2 或 OFL（可商用）
- **下載連結**: 
  - GitHub: https://github.com/l10n-tw/cwtex-q-fonts
  - 直接下載: https://github.com/l10n-tw/cwtex-q-fonts/releases
- **檔案名稱**: `cwTeXQKai-Medium.ttf`

### 2. 芫荽字體（Iansui Font）
- **授權**: SIL Open Font License（可商用）
- **下載連結**: https://github.com/ButTaiwan/iansui
- **檔案名稱**: `Iansui-Regular.ttf`

### 3. 全字庫正楷體
- **授權**: 政府資料開放授權（可商用）
- **下載連結**: https://www.cns11643.gov.tw
- **檔案名稱**: `TW-Kai-98_1.ttf`

### 4. 教育部楷書字體
- **授權**: 創用 CC（可商用，需標示來源）
- **下載連結**: https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/download.html

## 當前狀態

✅ **已成功下載**: 芫荽字體（Iansui-Regular.ttf）- 9.0MB
- 位置: `public/admin/assets/fonts/kaiti/Iansui-Regular.ttf`
- 已配置在 CSS 中，可以直接使用

## 快速下載方式

### 方法 1: 使用提供的腳本（已執行）
```bash
./download_kaiti_fonts.sh
```

### 方法 2: 手動下載 cwTeX Q Kai（更接近標楷體）

如果您想要更接近標楷體風格的字型，可以手動下載 cwTeX Q Kai：

1. **訪問 GitHub 發布頁面**:
   - https://github.com/l10n-tw/cwtex-q-fonts/releases
   - 下載最新版本的 `cwTeXQKai-Medium.ttf`

2. **或使用 wget/curl**:
   ```bash
   cd public/admin/assets/fonts/kaiti
   # 請從 GitHub releases 頁面獲取實際的下載連結
   # 例如：
   curl -L -o cwTeXQKai-Medium.ttf \
     "https://github.com/l10n-tw/cwtex-q-fonts/releases/download/v1.0/cwTeXQKai-Medium.ttf"
   ```

3. **下載後更新 CSS**:
   下載 cwTeX Q Kai 後，可以修改 `public/admin/assets/css/tinymce-custom-fonts.css`，
   將 `Iansui-Regular.ttf` 替換為 `cwTeXQKai-Medium.ttf`（或同時使用兩者作為備選）

## 安裝後的使用

下載字型後，系統會自動在 TinyMCE 編輯器中識別並使用這些字型。字型檔案應該放在：
```
public/admin/assets/fonts/kaiti/
```

## 注意事項

- 所有推薦的字型都是免費且可商用的
- 下載後請確認檔案格式為 `.ttf` 或 `.otf`
- 如果下載失敗，請檢查網路連線或手動從上述連結下載

