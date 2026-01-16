#!/bin/bash

# 標楷體替代字型下載腳本
# 此腳本會下載免費可商用的標楷體替代字型

FONT_DIR="public/admin/assets/fonts/kaiti"
mkdir -p "$FONT_DIR"

echo "正在下載標楷體替代字型..."

# 方法 1: 嘗試從 Google Fonts 下載 Noto Serif CJK (包含楷體風格)
echo "嘗試下載 Noto Serif CJK..."
curl -L -o "$FONT_DIR/NotoSerifCJK-Regular.otf" \
  "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/TraditionalChinese/NotoSansCJK-Regular.otf" \
  2>/dev/null || echo "Noto 字型下載失敗，將嘗試其他來源..."

# 方法 2: 下載 cwTeX Q Kai (最接近標楷體的開源字型)
echo "嘗試下載 cwTeX Q Kai..."
# 從 CTAN 或其他可靠來源下載
curl -L -o "$FONT_DIR/cwTeXQKai-Medium.ttf" \
  "https://ctan.org/tex-archive/fonts/cwtex-q-fonts/ttf/cwTeXQKai-Medium.ttf" \
  2>/dev/null || echo "cwTeX Q Kai 下載失敗"

# 方法 3: 下載芫荽字體 (Iansui) - 開源楷書風格
echo "嘗試下載芫荽字體..."
curl -L -o "$FONT_DIR/Iansui-Regular.ttf" \
  "https://github.com/ButTaiwan/iansui/raw/main/fonts/ttf/Iansui-Regular.ttf" \
  2>/dev/null || echo "芫荽字體下載失敗"

# 檢查下載結果
echo ""
echo "下載完成！檢查字型檔案："
ls -lh "$FONT_DIR"/*.ttf "$FONT_DIR"/*.otf 2>/dev/null | awk '{print $9, "(" $5 ")"}'

echo ""
echo "如果下載失敗，請手動下載以下字型："
echo "1. cwTeX Q Kai: https://github.com/l10n-tw/cwtex-q-fonts"
echo "2. 芫荽字體: https://github.com/ButTaiwan/iansui"
echo "3. 全字庫正楷體: https://www.cns11643.gov.tw"
echo ""
echo "下載後請將 .ttf 或 .otf 檔案放到: $FONT_DIR"

