/**
 * 一次性 script：從 v3.xlsx 讀取 ref 和 Remarks，更新 event.users 的 remarks
 *
 * xlsx 結構：
 *   - 欄位 D、E：ref（以 D 為主，D 空則用 E）
 *   - Remarks 欄：要寫入 user.remarks 的值
 *
 * 使用方式：
 *   1. 修改下方 CONFIG 的 EVENT_ID 和 xlsx 路徑
 *   2. MONGODB_URI 建議用環境變數：export MONGODB_URI="mongodb+srv://..."
 *   3. node scripts/update-users-remarks-from-xlsx.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const Event = require('../model/Event');

// ========== CONFIG（請依實際情況修改）==========
const CONFIG = {
  MONGODB_URI: 'mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/tanker',
  EVENT_ID: '6972113e603a17a274f0065e' || '',  // 必填：要更新的 event _id
  XLSX_PATH: path.join(__dirname, '../v3.xlsx'),  // xlsx 檔案路徑
  // 欄位索引（0-based）：A=0, B=1, C=2, D=3, E=4, F=5...
  COL_REF_D: 3,   // Column D
  COL_REF_E: 4,   // Column E
  // Remarks 欄位：可指定索引，或設為 null 讓 script 依標題「Remarks」自動尋找
  COL_REMARKS: null,  // 例如 5 表示 Column F
};

async function main() {
  if (!CONFIG.EVENT_ID) {
    console.error('請設定 EVENT_ID（環境變數或修改 CONFIG）');
    process.exit(1);
  }

  const xlsxPath = CONFIG.XLSX_PATH;
  if (!require('fs').existsSync(xlsxPath)) {
    console.error('找不到 xlsx 檔案:', xlsxPath);
    process.exit(1);
  }

  console.log('讀取 xlsx:', xlsxPath);
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    console.error('xlsx 至少需要標題列與一筆資料列');
    process.exit(1);
  }

  const headers = rows[0];
  const colRemarks = CONFIG.COL_REMARKS !== null
    ? CONFIG.COL_REMARKS
    : headers.findIndex(h => String(h || '').toLowerCase() === 'remarks');

  if (colRemarks < 0) {
    console.error('找不到 Remarks 欄位，請檢查 xlsx 標題或設定 COL_REMARKS');
    process.exit(1);
  }

  // ref -> remarks 對應表
  // D、E 皆視為 ref 來源：若 D 有值則 D->remarks，若 E 有值且不同則 E->remarks
  const refToRemarks = new Map();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const valD = String(row[CONFIG.COL_REF_D] ?? '').trim();
    const valE = String(row[CONFIG.COL_REF_E] ?? '').trim();
    const remarks = String(row[colRemarks] ?? '').trim();
    if (valD) refToRemarks.set(valD, remarks);
    if (valE && valE !== valD) refToRemarks.set(valE, remarks);
  }

  console.log('共讀取到', refToRemarks.size, '筆 ref -> remarks 對應');

  await mongoose.connect(CONFIG.MONGODB_URI);
  console.log('已連線 MongoDB');

  const event = await Event.findById(CONFIG.EVENT_ID);
  if (!event) {
    console.error('找不到 event:', CONFIG.EVENT_ID);
    await mongoose.disconnect();
    process.exit(1);
  }

  let updated = 0;
  let notFound = 0;
  for (let i = 0; i < event.users.length; i++) {
    const user = event.users[i];
    const userRef = user.ref != null ? String(user.ref).trim() : '';
    if (!userRef) continue;

    if (refToRemarks.has(userRef)) {
      const newRemarks = refToRemarks.get(userRef);
      if (user.remarks !== newRemarks) {
        user.remarks = newRemarks;
        user.markModified('remarks');
        updated++;
        console.log(`  更新 user ${user._id} (ref: ${userRef}) remarks`);
      }
    } else {
      notFound++;
    }
  }

  if (updated > 0) {
    event.markModified('users');
    await event.save();
    console.log('已儲存 event，共更新', updated, '位 user 的 remarks');
  } else {
    console.log('無需更新的 user');
  }

  if (notFound > 0) {
    console.log('有', notFound, '位 user 的 ref 在 xlsx 中找不到對應');
  }

  await mongoose.disconnect();
  console.log('完成');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
