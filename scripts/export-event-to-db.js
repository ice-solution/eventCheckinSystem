/**
 * 一次性：將單一 Event 及其關聯資料從來源 MongoDB 複製到目標 MongoDB，並可選複製相關靜態檔案。
 *
 * 使用方式（在專案根目錄執行）：
 *
 *   SOURCE_MONGODB_URI="mongodb+srv://..." \
 *   TARGET_MONGODB_URI="mongodb+srv://..." \
 *   EVENT_ID="674a1b2c3d4e5f678901234" \
 *   TARGET_OWNER_AUTH_ID="目標DB後台用戶_id" \
 *   node scripts/export-event-to-db.js
 *
 * 選用環境變數：
 *   COPY_FILES=1              複製 public 內附件/banner/獎品圖（預設 1）
 *   INCLUDE_EMAIL_RECORDS=1   是否複製 emailrecords（預設 1）
 *   OVERWRITE=1               目標 DB 已有同 eventId 時先刪除再寫入（預設 0，有則中止）
 *   DRY_RUN=1                 只列印計畫，不寫入（預設 0）
 *   TARGET_PUBLIC_DIR=path    目標 public 目錄（預設 ./public，用於 COPY_FILES）
 *
 * 注意：
 * - 預設保留原 eventId / 各 document _id，排桌 userIds 等引用才對得上。
 * - 全域郵件模板（eventId: null）不會一併複製。
 * - 請在目標 DB 設定好 Auth 用戶，並用 TARGET_OWNER_AUTH_ID 指定 owner。
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Event = require('../model/Event');
const FormConfig = require('../model/FormConfig');
const EmailTemplate = require('../model/EmailTemplate');
const SmsTemplate = require('../model/SmsTemplate');
const Transaction = require('../model/Transaction');
const Prize = require('../model/Prize');
const Vote = require('../model/Vote');
const BadgeConfig = require('../model/BadgeConfig');
const LuckydrawGameConfig = require('../model/LuckydrawGameConfig');
const EmailRecord = require('../model/EmailRecord');
const Auth = require('../model/Auth');
const GameHistory = require('../model/GameHistory');

const CONFIG = {
    SOURCE_URI: process.env.SOURCE_MONGODB_URI || process.env.MONGODB_URI || '',
    TARGET_URI: process.env.TARGET_MONGODB_URI || '',
    EVENT_ID: process.env.EVENT_ID || '',
    TARGET_OWNER_AUTH_ID: process.env.TARGET_OWNER_AUTH_ID || '',
    COPY_FILES: !['0', 'false', 'no'].includes(String(process.env.COPY_FILES || '1').toLowerCase()),
    INCLUDE_EMAIL_RECORDS: !['0', 'false', 'no'].includes(String(process.env.INCLUDE_EMAIL_RECORDS || '1').toLowerCase()),
    OVERWRITE: ['1', 'true', 'yes'].includes(String(process.env.OVERWRITE || '0').toLowerCase()),
    DRY_RUN: ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN || '0').toLowerCase()),
    SOURCE_PUBLIC_DIR: path.resolve(process.env.SOURCE_PUBLIC_DIR || path.join(__dirname, '../public')),
    TARGET_PUBLIC_DIR: path.resolve(process.env.TARGET_PUBLIC_DIR || path.join(__dirname, '../public')),
};

/** 依 eventId 關聯的 collection（不含 events 主文件） */
const EVENT_SCOPED_MODELS = [
    { name: 'FormConfig', model: FormConfig },
    { name: 'EmailTemplate', model: EmailTemplate },
    { name: 'SmsTemplate', model: SmsTemplate },
    { name: 'Transaction', model: Transaction },
    { name: 'Prize', model: Prize },
    { name: 'Vote', model: Vote },
    { name: 'BadgeConfig', model: BadgeConfig },
    { name: 'LuckydrawGameConfig', model: LuckydrawGameConfig },
];

function log(msg) {
    console.log(`[export-event] ${msg}`);
}

function toPlain(doc) {
    if (!doc) return null;
    return doc.toObject ? doc.toObject() : { ...doc };
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFileIfExists(src, dest) {
    if (!fs.existsSync(src)) return false;
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    return true;
}

/** 從 URL 或路徑解析 public 下的相對檔案 */
function publicRelativeFromUrl(urlOrPath) {
    if (!urlOrPath || typeof urlOrPath !== 'string') return null;
    const s = urlOrPath.trim();
    const idx = s.indexOf('/prizes/');
    if (idx >= 0) return s.slice(idx + 1);
    const idx2 = s.indexOf('/badges/');
    if (idx2 >= 0) return s.slice(idx2 + 1);
    const idx3 = s.indexOf('/uploads/');
    if (idx3 >= 0) return s.slice(idx3 + 1);
    if (s.startsWith('public/')) return s.slice('public/'.length);
    return null;
}

async function connectDb(uri, label) {
    const conn = mongoose.createConnection(uri);
    await conn.asPromise();
    log(`已連線 ${label}`);
    return conn;
}

function modelOnConn(conn, Model) {
    return conn.model(Model.modelName, Model.schema);
}

async function fetchEventScoped(conn, Model, eventId) {
    const M = modelOnConn(conn, Model);
    return M.find({ eventId }).lean();
}

async function deleteEventScoped(conn, Model, eventId) {
    const M = modelOnConn(conn, Model);
    const r = await M.deleteMany({ eventId });
    return r.deletedCount || 0;
}

async function insertDocs(conn, Model, docs) {
    if (!docs || docs.length === 0) return 0;
    const M = modelOnConn(conn, Model);
    await M.insertMany(docs, { ordered: false });
    return docs.length;
}

function collectFilesFromEvent(eventDoc, prizes, votes) {
    const files = new Set();
    const eventId = String(eventDoc._id);

    const banner = path.join('exvent', `${eventId}.jpg`);
    files.add(banner);

    (eventDoc.attachments || []).forEach((a) => {
        if (a.storedFilename) {
            files.add(path.join('events', 'attachments', a.storedFilename));
        }
    });

    (prizes || []).forEach((p) => {
        const rel = publicRelativeFromUrl(p.picture);
        if (rel) files.add(rel);
        else if (p.picture && p.picture.startsWith('/prizes/')) {
            files.add(p.picture.replace(/^\//, ''));
        }
    });

    (votes || []).forEach((v) => {
        (v.options || []).forEach((opt) => {
            const rel = publicRelativeFromUrl(opt.image);
            if (rel) files.add(rel);
        });
    });

    return [...files];
}

async function copyPublicFiles(fileRelPaths) {
    let copied = 0;
    let missing = 0;
    for (const rel of fileRelPaths) {
        const src = path.join(CONFIG.SOURCE_PUBLIC_DIR, rel);
        const dest = path.join(CONFIG.TARGET_PUBLIC_DIR, rel);
        if (copyFileIfExists(src, dest)) {
            copied++;
            log(`  檔案: ${rel}`);
        } else {
            missing++;
        }
    }
    return { copied, missing };
}

async function exportGameHistory(sourceConn, targetConn, eventDoc, eventId, dryRun) {
    const userIds = new Set((eventDoc.users || []).map((u) => String(u._id)));
    if (userIds.size === 0) return 0;

    const gameIds = eventDoc.gameIds || [];
    const SourceGH = modelOnConn(sourceConn, GameHistory);
    const query = gameIds.length > 0
        ? { userId: { $in: [...userIds] }, gameId: { $in: gameIds } }
        : { userId: { $in: [...userIds] } };

    const docs = await SourceGH.find(query).lean();
    if (docs.length === 0) return 0;

    if (dryRun) {
        log(`[DRY_RUN] 將複製 GameHistory ${docs.length} 筆`);
        return docs.length;
    }

    const TargetGH = modelOnConn(targetConn, GameHistory);
    // 避免重複：先刪同 userId+gameId 組合（簡化：刪這批 userId）
    await TargetGH.deleteMany({ userId: { $in: [...userIds] } });
    await TargetGH.insertMany(docs, { ordered: false });
    return docs.length;
}

async function updateTargetAuth(targetConn, eventId, ownerAuthId, dryRun) {
    if (!ownerAuthId) {
        log('未設定 TARGET_OWNER_AUTH_ID，略過 Auth 權限更新（請手動加入 allowedEvents）');
        return;
    }

    const TargetAuth = modelOnConn(targetConn, Auth);
    const auth = await TargetAuth.findById(ownerAuthId);
    if (!auth) {
        throw new Error(`目標 DB 找不到 Auth _id: ${ownerAuthId}`);
    }

    const eid = new mongoose.Types.ObjectId(eventId);
    const allowed = (auth.allowedEvents || []).map(String);
    if (!allowed.includes(String(eventId))) {
        if (dryRun) {
            log(`[DRY_RUN] 將把 eventId 加入 Auth(${ownerAuthId}).allowedEvents`);
        } else {
            auth.allowedEvents = auth.allowedEvents || [];
            auth.allowedEvents.push(eid);
            await auth.save();
            log(`已更新 Auth allowedEvents: ${auth.username || ownerAuthId}`);
        }
    } else {
        log(`Auth 已有此 eventId 權限`);
    }
}

async function main() {
    if (!CONFIG.SOURCE_URI || !CONFIG.TARGET_URI || !CONFIG.EVENT_ID) {
        console.error(`
請設定環境變數：
  SOURCE_MONGODB_URI  來源 DB（未設則用 MONGODB_URI）
  TARGET_MONGODB_URI  目標 DB
  EVENT_ID            要匯出的活動 _id

選用：
  TARGET_OWNER_AUTH_ID  目標 DB 後台用戶 _id（設為 event.owner 並加入 allowedEvents）
  OVERWRITE=1           目標已有同 event 時先刪除
  DRY_RUN=1             試跑
  COPY_FILES=0          不複製檔案
`);
        process.exit(1);
    }

    if (!mongoose.Types.ObjectId.isValid(CONFIG.EVENT_ID)) {
        console.error('EVENT_ID 格式無效');
        process.exit(1);
    }

    const eventId = new mongoose.Types.ObjectId(CONFIG.EVENT_ID);

    if (CONFIG.SOURCE_URI === CONFIG.TARGET_URI) {
        console.error('SOURCE 與 TARGET 相同，請使用不同 MONGODB_URI');
        process.exit(1);
    }

    log(`來源: ${CONFIG.SOURCE_URI.replace(/\/\/[^@]+@/, '//***@')}`);
    log(`目標: ${CONFIG.TARGET_URI.replace(/\/\/[^@]+@/, '//***@')}`);
    log(`Event: ${CONFIG.EVENT_ID}`);
    if (CONFIG.DRY_RUN) log('*** DRY RUN 模式，不會寫入 ***');

    const sourceConn = await connectDb(CONFIG.SOURCE_URI, '來源');
    const targetConn = await connectDb(CONFIG.TARGET_URI, '目標');

    try {
        const SourceEvent = modelOnConn(sourceConn, Event);
        const TargetEvent = modelOnConn(targetConn, Event);

        const eventDoc = await SourceEvent.findById(eventId).lean();
        if (!eventDoc) {
            throw new Error(`來源 DB 找不到 Event: ${CONFIG.EVENT_ID}`);
        }

        const existing = await TargetEvent.findById(eventId).lean();
        if (existing && !CONFIG.OVERWRITE) {
            throw new Error('目標 DB 已有同 eventId，請設 OVERWRITE=1 或手動刪除後再跑');
        }

        const bundle = {};
        for (const { name, model } of EVENT_SCOPED_MODELS) {
            bundle[name] = await fetchEventScoped(sourceConn, model, eventId);
            log(`來源 ${name}: ${bundle[name].length} 筆`);
        }

        let emailRecords = [];
        if (CONFIG.INCLUDE_EMAIL_RECORDS) {
            emailRecords = await fetchEventScoped(sourceConn, EmailRecord, eventId);
            log(`來源 EmailRecord: ${emailRecords.length} 筆`);
        }

        const fileList = collectFilesFromEvent(eventDoc, bundle.Prize, bundle.Vote);
        log(`將複製靜態檔案 ${fileList.length} 個（若存在）`);

        if (CONFIG.DRY_RUN) {
            log('[DRY_RUN] 完成預覽');
            await exportGameHistory(sourceConn, targetConn, eventDoc, eventId, true);
            await updateTargetAuth(targetConn, eventId, CONFIG.TARGET_OWNER_AUTH_ID, true);
            return;
        }

        if (existing && CONFIG.OVERWRITE) {
            log('OVERWRITE: 刪除目標 DB 既有資料...');
            await TargetEvent.deleteOne({ _id: eventId });
            for (const { model } of EVENT_SCOPED_MODELS) {
                const n = await deleteEventScoped(targetConn, model, eventId);
                if (n) log(`  已刪 ${model.modelName}: ${n}`);
            }
            if (CONFIG.INCLUDE_EMAIL_RECORDS) {
                const n = await deleteEventScoped(targetConn, EmailRecord, eventId);
                if (n) log(`  已刪 EmailRecord: ${n}`);
            }
        }

        const eventToInsert = { ...eventDoc };
        if (CONFIG.TARGET_OWNER_AUTH_ID) {
            eventToInsert.owner = new mongoose.Types.ObjectId(CONFIG.TARGET_OWNER_AUTH_ID);
        }

        await TargetEvent.create(eventToInsert);
        log('已寫入 Event 主文件');

        for (const { name, model } of EVENT_SCOPED_MODELS) {
            const n = await insertDocs(targetConn, model, bundle[name]);
            if (n) log(`已寫入 ${name}: ${n} 筆`);
        }

        if (CONFIG.INCLUDE_EMAIL_RECORDS && emailRecords.length) {
            await insertDocs(targetConn, EmailRecord, emailRecords);
            log(`已寫入 EmailRecord: ${emailRecords.length} 筆`);
        }

        const ghCount = await exportGameHistory(sourceConn, targetConn, eventDoc, eventId, false);
        if (ghCount) log(`已寫入 GameHistory: ${ghCount} 筆`);

        await updateTargetAuth(targetConn, eventId, CONFIG.TARGET_OWNER_AUTH_ID, false);

        if (CONFIG.COPY_FILES) {
            log('複製靜態檔案...');
            const { copied, missing } = await copyPublicFiles(fileList);
            log(`檔案完成：複製 ${copied}，來源不存在 ${missing}`);
            if (CONFIG.SOURCE_PUBLIC_DIR !== CONFIG.TARGET_PUBLIC_DIR) {
                log(`來源 public: ${CONFIG.SOURCE_PUBLIC_DIR}`);
                log(`目標 public: ${CONFIG.TARGET_PUBLIC_DIR}`);
            }
        }

        log('✅ 匯出完成');
        log(`目標活動 URL 路徑範例: /events/${CONFIG.EVENT_ID}`);
        if (!CONFIG.TARGET_OWNER_AUTH_ID) {
            log('⚠️  請在目標 DB 手動將此 eventId 加入後台用戶的 allowedEvents');
        }
    } finally {
        await sourceConn.close();
        await targetConn.close();
    }
}

main().catch((err) => {
    console.error('[export-event] 失敗:', err.message);
    if (err.writeErrors) {
        err.writeErrors.slice(0, 3).forEach((e) => console.error(' ', e.errmsg || e));
    }
    process.exit(1);
});
