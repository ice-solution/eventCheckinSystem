# 幸運抽獎頁面更新

## 更新內容

已成功完成以下三項修改：

### 1. ✅ 產品圖片顯示功能
- **位置**: 選擇禮品下拉選單上方
- **功能**: 當選擇獎品時，自動顯示對應的產品圖片
- **實現**: 
  - 在獎品選項中添加 `data-image` 屬性
  - 添加圖片顯示容器
  - JavaScript監聽選擇變化並更新圖片

### 2. ✅ 中獎者顯示次序更改
- **原次序**: name, company, table
- **新次序**: Company, table, name
- **影響範圍**: 
  - 中獎者卡片顯示
  - 當前中獎者顯示
- **實現**: 修改HTML生成邏輯中的顯示順序

### 3. ✅ Banner功能添加
- **位置**: 頁面最上方
- **尺寸**: 寬度100%，高度200px
- **圖片來源**: `/exvent/<%= eventId %>.jpg`
- **功能**: 使用通過banner管理頁面上傳的banner圖片
- **錯誤處理**: 如果沒有banner圖片，自動隱藏banner區域

## 測試步驟

### 1. 訪問幸運抽獎頁面
```
http://localhost:3377/events/68a7f5415b97103e87007a5e/luckydraw
```

### 2. 測試產品圖片顯示
- ✅ 選擇不同獎品時，上方應顯示對應的產品圖片
- ✅ 如果獎品沒有圖片，圖片區域應隱藏
- ✅ 圖片尺寸應適當（最大200px寬，150px高）

### 3. 測試中獎者顯示次序
- ✅ 進行抽獎後，中獎者信息顯示順序應為：Company, table, name
- ✅ 當前中獎者顯示也應遵循相同順序

### 4. 測試Banner功能
- ✅ 頁面頂部應顯示banner圖片
- ✅ Banner尺寸應為全寬，高度200px
- ✅ 如果沒有banner，banner區域應隱藏

## 技術實現詳情

### 產品圖片顯示
```html
<!-- 產品圖片顯示區域 -->
<div id="prizeImageContainer" style="margin-bottom: 10px; text-align: center;">
  <img id="prizeImage" src="" alt="選擇獎品" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 2px solid #fff; display: none;">
</div>
```

### Banner區域
```html
<!-- Banner區域 -->
<div id="bannerContainer" style="width: 100%; height: 200px; overflow: hidden; position: relative;">
  <img id="eventBanner" src="/exvent/<%= eventId %>.jpg" alt="Event Banner" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">
</div>
```

### JavaScript功能
```javascript
// 產品圖片顯示功能
prizeSelect.addEventListener('change', function() {
  const selectedOption = this.options[this.selectedIndex];
  const imagePath = selectedOption.dataset.image;
  
  if (imagePath && imagePath.trim() !== '') {
    prizeImage.src = imagePath;
    prizeImage.style.display = 'block';
    prizeImageContainer.style.display = 'block';
  } else {
    prizeImage.style.display = 'none';
    prizeImageContainer.style.display = 'none';
  }
});
```

## 文件修改

- **主要文件**: `/views/events/luckydraw.ejs`
- **備份文件**: `/views/events/luckydraw.ejs.backup`
- **修改內容**: 
  - 添加產品圖片顯示區域和JavaScript
  - 修改中獎者顯示次序
  - 添加banner區域

## 預期效果

1. **更好的用戶體驗**: 選擇獎品時可以預覽產品圖片
2. **更清晰的信息顯示**: 中獎者信息按照Company, table, name的邏輯順序顯示
3. **品牌一致性**: 頁面頂部顯示活動banner，提升品牌形象

## 注意事項

- 確保獎品數據中包含 `image` 字段
- 確保通過banner管理頁面上傳了對應的banner圖片
- 如果沒有圖片，相關區域會自動隱藏，不會影響頁面功能
