# 幸運抽獎頁面Bug修復

## 修復的問題

### 1. ✅ Banner顯示問題修復
**問題**: Banner顯示很奇怪，需要置中顯示
**解決方案**: 
- 修改banner容器的CSS樣式
- 使用flexbox布局實現置中
- 將 `object-fit: cover` 改為 `object-fit: contain` 保持圖片比例
- 添加淺灰色背景色

**修改前**:
```html
<div id="bannerContainer" style="width: 100%; height: 200px; overflow: hidden; position: relative;">
  <img id="eventBanner" src="/exvent/<%= eventId %>.jpg" alt="Event Banner" style="width: 100%; height: 100%; object-fit: cover;">
</div>
```

**修改後**:
```html
<div id="bannerContainer" style="width: 100%; height: 200px; overflow: hidden; position: relative; display: flex; justify-content: center; align-items: center; background-color: #f0f0f0;">
  <img id="eventBanner" src="/exvent/<%= eventId %>.jpg" alt="Event Banner" style="max-width: 100%; max-height: 100%; object-fit: contain;">
</div>
```

### 2. ✅ 獎品圖片不顯示問題修復
**問題**: 選擇獎品時，產品圖片沒有顯示
**原因**: 字段名稱不匹配
- Prize模型中使用的是 `picture` 字段
- 模板中使用的是 `image` 字段

**解決方案**: 
- 將模板中的 `prize.image` 改為 `prize.picture`

**修改前**:
```html
<option value="<%= prize._id %>" data-name="<%= prize.name %>" data-image="<%= prize.image || '' %>">
```

**修改後**:
```html
<option value="<%= prize._id %>" data-name="<%= prize.name %>" data-image="<%= prize.picture || '' %>">
```

## 測試步驟

### 1. 測試Banner顯示
```
http://localhost:3377/events/68a7f5415b97103e87007a5e/luckydraw
```
- ✅ Banner應該在頁面頂部置中顯示
- ✅ 如果banner圖片存在，應該完整顯示且保持比例
- ✅ 如果沒有banner圖片，banner區域應該隱藏

### 2. 測試獎品圖片顯示
- ✅ 選擇有圖片的獎品時，上方應該顯示對應的產品圖片
- ✅ 圖片應該適當縮放，最大200px寬，150px高
- ✅ 如果獎品沒有圖片，圖片區域應該隱藏

## 技術細節

### Banner置中實現
```css
display: flex;           /* 使用flexbox布局 */
justify-content: center; /* 水平置中 */
align-items: center;     /* 垂直置中 */
object-fit: contain;     /* 保持圖片比例，完整顯示 */
```

### 獎品圖片字段修正
```javascript
// Prize模型字段
picture: { type: String }, // 獎品圖片URL

// 模板中的使用
data-image="<%= prize.picture || '' %>"
```

## 預期效果

1. **Banner顯示**: 頁面頂部的banner圖片應該完美置中，保持原始比例
2. **獎品圖片**: 選擇獎品時應該能正確顯示對應的產品圖片
3. **用戶體驗**: 兩個功能都應該正常工作，提供更好的視覺體驗

## 注意事項

- 確保獎品數據中包含 `picture` 字段
- 確保banner圖片已通過banner管理頁面上傳
- 如果圖片路徑不正確，相關區域會自動隱藏
