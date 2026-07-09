# Hidden Menu Items

以下功能已從左邊欄**隱藏顯示**，但路由與後台功能完整保留，可隨時重新開放。

如需重新啟用，在 `views/admin/components/menu.ejs` 將對應項目的 `false &&` 移除即可。

---

## 隱藏清單

| 功能 | Permission Key | 路由 | 狀態 |
|------|---------------|------|------|
| Guest List | `guestList` | `/events/:eventId/guest-list` | 🔴 隱藏中 |
| SMS Template | `smsTemplate` | `/events/:eventId/smsTemplate` | 🔴 隱藏中 |
| QR Code Login Page | `qrcodeLogin` | `/events/:eventId/qrcodeLogin` | 🔴 隱藏中 |
| Scan Point Management | `scanPointUsers` | `/events/:eventId/scan-point-users` | 🔴 隱藏中 |
| Treasure Hunt | `treasureHunt` | `/events/:eventId/treasure-hunt` | 🔴 隱藏中 |

---

## 如何重新啟用

在 `views/admin/components/menu.ejs` 搵到對應 `HIDDEN:` 註解，將 `if (false && can(...))` 改返 `if (can(...))` 即可。

例如重新啟用 Guest List：
```ejs
<%# 改前（隱藏）
<% if (false && can('guestList')) { %>

改後（顯示）
<% if (can('guestList')) { %>
```
