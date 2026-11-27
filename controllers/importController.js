const multer = require('multer');
const XLSX = require('xlsx');
const Event = require('../model/Event'); // 確保引入 User 模型
const FormConfig = require('../model/FormConfig');
const formConfigController = require('./formConfigController');
const { ensureUserNameField } = require('../utils/userDisplayName');
const {
    buildFieldOptionIndex,
    resolveFieldDisplayValue,
    optionDisplayLabel,
} = require('../utils/formOptionLabel');

/** Event.users.name 仍為 schema 必填；表單若改用 firstname/lastname 需自動組回 name */
function applyImportDisplayName(userData, expectedFields) {
    const formHasNameField = Array.isArray(expectedFields) && expectedFields.includes('name');
    return ensureUserNameField(userData, { refreshFromParts: !formHasNameField });
}

function fillMissingUserNames(users) {
    let filled = 0;
    (users || []).forEach((user) => {
        if (!user) return;
        const current = user.name != null ? String(user.name).trim() : '';
        if (current) return;
        const obj = typeof user.toObject === 'function'
            ? user.toObject({ minimize: false })
            : { ...user };
        user.name = ensureUserNameField(obj).name;
        filled += 1;
    });
    return filled;
}

// 設置 multer 以處理文件上傳
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');

/**
 * 取得指定活動的表單欄位設定（依照可見欄位）
 * @param {string} eventId
 * @returns {Promise<{fields: string[], fieldDetails: Array<{fieldName: string, label: string}>}>}
 */
async function getImportFieldDefinitions(eventId) {
    let formConfig = await FormConfig.findOne({ eventId });

    if (!formConfig) {
        const defaultConfig = formConfigController.getDefaultFormConfig();
        formConfig = new FormConfig({
            eventId,
            ...defaultConfig
        });
        await formConfig.save();
    }

    const migratedConfig = formConfigController.migrateFormConfig(
        typeof formConfig.toObject === 'function' ? formConfig.toObject() : formConfig
    );

    const language = migratedConfig.defaultLanguage || 'zh';
    // 次序跟註冊表單一致：section.order → field.order（同 report / RSVP）
    const fieldDetails = [];
    const seen = new Set();

    if (migratedConfig.sections) {
        const sections = [...migratedConfig.sections].sort((a, b) => (a.order || 0) - (b.order || 0));
        sections.forEach(section => {
            if (!section || section.visible === false || !Array.isArray(section.fields)) return;
            const fields = [...section.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
            fields.forEach(field => {
                if (!field || field.visible === false || !field.fieldName) return;
                if (field.type === 'display') return; // 顯示用欄位唔匯入
                if (seen.has(field.fieldName)) return;

                let label = '';
                if (typeof field.label === 'string') {
                    label = field.label;
                } else if (field.label && (field.label[language] || field.label.zh || field.label.en)) {
                    label = field.label[language] || field.label.zh || field.label.en;
                } else {
                    label = field.fieldName;
                }

                seen.add(field.fieldName);
                fieldDetails.push({
                    fieldName: field.fieldName,
                    label
                });
            });
        });
    }

    // Thank You Yes/No：import／export 一律帶上（唔論 enabled），方便 bulk 填答
    if (!seen.has('thankYouYesNo')) {
        const ynq = migratedConfig.thankYou && migratedConfig.thankYou.yesNoQuestion;
        const ynqLabel = (ynq && ynq.question && (ynq.question[language] || ynq.question.zh || ynq.question.en))
            || 'Yes/No Question';
        seen.add('thankYouYesNo');
        fieldDetails.push({
            fieldName: 'thankYouYesNo',
            label: String(ynqLabel).trim() || 'Yes/No Question'
        });
    }

    const fields = fieldDetails.map(field => field.fieldName);

    return { fields, fieldDetails, migratedConfig, language };
}

/** Locate：option value → 可讀 label；import 時 label → value */
function buildLocateValueMaps(migratedConfig, language) {
    const fieldIndex = buildFieldOptionIndex(migratedConfig, language);
    /** fieldName -> Map(normalizedLabelOrValue -> storedValue) */
    const labelToValueByField = new Map();

    if (migratedConfig && Array.isArray(migratedConfig.sections)) {
        migratedConfig.sections.forEach((section) => {
            (section.fields || []).forEach((field) => {
                if (!field || !field.fieldName) return;
                if (!['select', 'radio', 'checkbox'].includes(field.type)) return;
                const map = new Map();
                (field.options || []).forEach((opt) => {
                    if (!opt || opt.value == null) return;
                    const stored = String(opt.value);
                    const add = (raw) => {
                        const k = String(raw || '').trim().toLowerCase();
                        if (k && !map.has(k)) map.set(k, stored);
                    };
                    add(stored);
                    add(optionDisplayLabel(opt, language));
                    add(optionDisplayLabel(opt, 'zh'));
                    add(optionDisplayLabel(opt, 'en'));
                    if (opt.label && typeof opt.label === 'object') {
                        add(opt.label.zh);
                        add(opt.label.en);
                    }
                });
                labelToValueByField.set(field.fieldName, map);
            });
        });
    }

    // thankYouYesNo
    const ynq = migratedConfig && migratedConfig.thankYou && migratedConfig.thankYou.yesNoQuestion;
    const ynMap = new Map();
    const addYn = (raw, stored) => {
        const k = String(raw || '').trim().toLowerCase();
        if (k && !ynMap.has(k)) ynMap.set(k, stored);
    };
    ['yes', 'y', 'true', '1', '是'].forEach((k) => addYn(k, 'yes'));
    ['no', 'n', 'false', '0', '否'].forEach((k) => addYn(k, 'no'));
    if (ynq) {
        addYn(ynq.yesLabel && (ynq.yesLabel[language] || ynq.yesLabel.zh || ynq.yesLabel.en), 'yes');
        addYn(ynq.noLabel && (ynq.noLabel[language] || ynq.noLabel.zh || ynq.noLabel.en), 'no');
        addYn(ynq.yesLabel && ynq.yesLabel.zh, 'yes');
        addYn(ynq.yesLabel && ynq.yesLabel.en, 'yes');
        addYn(ynq.noLabel && ynq.noLabel.zh, 'no');
        addYn(ynq.noLabel && ynq.noLabel.en, 'no');
    }
    labelToValueByField.set('thankYouYesNo', ynMap);

    return { fieldIndex, labelToValueByField };
}

function toLocateDisplayValue(rawValue, fieldName, fieldIndex) {
    if (fieldName === 'thankYouYesNo') {
        const raw = rawValue != null ? String(rawValue).trim().toLowerCase() : '';
        if (!raw) return '';
        if (['yes', 'y', 'true', '1', '是'].includes(raw)) return 'Yes';
        if (['no', 'n', 'false', '0', '否'].includes(raw)) return 'No';
        return String(rawValue);
    }
    return resolveFieldDisplayValue(rawValue, fieldName, fieldIndex);
}

function fromLocateInputValue(rawValue, fieldName, labelToValueByField) {
    if (rawValue == null) return '';
    const raw = String(rawValue).trim();
    if (!raw) return '';
    const map = labelToValueByField && labelToValueByField.get(fieldName);
    if (!map) return raw;

    // checkbox 可能係逗號分隔多個 label
    if (raw.includes(',')) {
        return raw.split(',')
            .map((part) => {
                const p = part.trim();
                if (!p) return '';
                const hit = map.get(p.toLowerCase());
                return hit != null ? hit : p;
            })
            .filter(Boolean)
            .join(', ');
    }

    const hit = map.get(raw.toLowerCase());
    return hit != null ? hit : raw;
}

function renderImportResultPage({
    eventId,
    createdCount,
    updatedCount,
    unchangedCount,
    idNotFoundSkippedCount,
    details,
    modeLabel
}) {
    const title = modeLabel ? `${modeLabel} Successful!` : 'Import Successful!';
    return `
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>${title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 960px; margin: 24px auto; padding: 0 16px; color: #1e293b; }
                        h1 { font-size: 1.5rem; }
                        .summary { background: #f1f5f9; border-radius: 8px; padding: 12px 14px; }
                        .table-wrap { max-height: 420px; overflow: auto; border: 1px solid #ddd; padding: 8px; margin-top: 12px; }
                        table { border-collapse: collapse; width: 100%; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                        th { background: #f8fafc; position: sticky; top: 0; }
                        .actions { margin-top: 20px; }
                        .btn-next {
                            display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                            padding: 12px 22px; border-radius: 8px; font-weight: 700;
                        }
                        .hint { margin-top: 8px; color: #666; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <div class="summary">
                        Created: ${createdCount},
                        Updated: ${updatedCount},
                        Unchanged: ${unchangedCount},
                        _id Not Found -> Skipped: ${idNotFoundSkippedCount}
                    </div>
                    <p>Below are import details to help diagnose why a row was not updated.</p>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Excel Row</th>
                                    <th>Action</th>
                                    <th>Guest _id</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.map(d => `
                                    <tr>
                                        <td>${d.row}</td>
                                        <td>${d.action}</td>
                                        <td>${d.userId || '-'}</td>
                                        <td>${d.reason}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p class="hint">If a row shows "unchanged", uploaded values match the database.</p>
                    <div class="actions">
                        <a class="btn-next" href="/events/${eventId}">Next → Back to guest list</a>
                    </div>
                </body>
            </html>
        `;
}

function parseBooleanCell(rawValue) {
    if (typeof rawValue === 'boolean') return rawValue;
    if (typeof rawValue === 'number') return rawValue === 1;
    const v = rawValue !== undefined && rawValue !== null ? String(rawValue).trim().toLowerCase() : '';
    return v === '1' || v === 'true' || v === 'yes' || v === 'y';
}

function normalizeComparableValue(v) {
    if (v === undefined || v === null) return '';
    return String(v).trim();
}

function findUserByIncomingId(users, incomingId) {
    if (!incomingId) return null;
    const normalizedIncoming = String(incomingId).trim().toLowerCase();
    if (!normalizedIncoming) return null;

    // 先走 mongoose subdoc id()（最快）
    const byId = users.id(incomingId);
    if (byId) return byId;

    // 再做字串比對（避免 excel / 格式差異造成 cast 不穩）
    return users.find(u => {
        const currentId = u && u._id ? String(u._id).trim().toLowerCase() : '';
        return currentId === normalizedIncoming;
    }) || null;
}

/** Excel 雙列標題：row1 = fieldName，row2 = label（畀客人睇） */
const SYSTEM_COLUMN_LABELS = {
    _id: 'Guest ID',
    isCheckIn: 'Checked In (1/0)'
};

function buildImportHeaderRows(fieldDetails) {
    const fieldNames = ['_id', ...fieldDetails.map(f => f.fieldName), 'isCheckIn'];
    const labels = [
        SYSTEM_COLUMN_LABELS._id,
        ...fieldDetails.map(f => f.label || f.fieldName),
        SYSTEM_COLUMN_LABELS.isCheckIn
    ];
    return { fieldNames, labels };
}

/**
 * 判斷第 2 列是否 label 列（新格式）；舊檔只有 1 列 fieldName 則資料由第 2 列起。
 */
function detectDataStartIndex(rows, headerIndexMap, fieldDetails) {
    if (!rows || rows.length < 2) return 1;
    const labelRow = rows[1] || [];
    let checked = 0;
    let matches = 0;

    const idIdx = headerIndexMap.get('_id');
    if (idIdx !== undefined) {
        checked += 1;
        const cell = labelRow[idIdx] != null ? String(labelRow[idIdx]).trim() : '';
        if (
            !cell ||
            cell === '_id' ||
            cell === SYSTEM_COLUMN_LABELS._id ||
            /^id$/i.test(cell) ||
            /guest\s*id/i.test(cell) ||
            /賓客/.test(cell)
        ) {
            matches += 1;
        }
    }

    const checkInIdx = headerIndexMap.get('isCheckIn');
    if (checkInIdx !== undefined) {
        checked += 1;
        const cell = labelRow[checkInIdx] != null ? String(labelRow[checkInIdx]).trim() : '';
        if (
            !cell ||
            cell === 'isCheckIn' ||
            cell === SYSTEM_COLUMN_LABELS.isCheckIn ||
            /check.?in/i.test(cell) ||
            /簽到|已簽到/.test(cell)
        ) {
            matches += 1;
        }
    }

    (fieldDetails || []).forEach((fd) => {
        const idx = headerIndexMap.get(fd.fieldName);
        if (idx === undefined) return;
        checked += 1;
        const cell = labelRow[idx] != null ? String(labelRow[idx]).trim() : '';
        if (cell && (cell === fd.label || cell === fd.fieldName)) {
            matches += 1;
        }
    });

    if (checked > 0 && matches / checked >= 0.5) return 2;
    return 1;
}

exports.getImportUserPage = async (req, res) => {
    const { eventId } = req.params; // 從請求參數中獲取 eventId

    try {
        // 查詢事件以檢查是否存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('找不到活動 ID'); // 如果事件不存在，返回 404 錯誤
        }

        const { fieldDetails } = await getImportFieldDefinitions(eventId);

        res.render('admin/import', { event, importFields: fieldDetails }); // 將 eventId 傳遞給視圖
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).send('伺服器錯誤'); // 返回伺服器錯誤
    }
};

async function runUserImport(req, res, { locateMode = false } = {}) {
    const { eventId } = req.params; // 獲取事件 ID

    try {
        // 確保 req.file 存在
        if (!req.file) {
            return res.status(400).send('No file uploaded!');
        }

        // 查詢事件以確保存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        const { fields: expectedFields, fieldDetails, migratedConfig, language } = await getImportFieldDefinitions(eventId);
        if (!expectedFields || expectedFields.length === 0) {
            return res.status(400).send('No form fields available for this event. Please configure the registration form first.');
        }

        const locateMaps = locateMode
            ? buildLocateValueMaps(migratedConfig, language)
            : null;

        // 解析 Excel 文件
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).send('Uploaded file is empty.');
        }

        // Row 1 = fieldName（系統用）；Row 2 = label（可選，畀客人睇）
        const headerRow = rows[0].map(header => (header !== null && header !== undefined ? String(header).trim() : ''));
        const headerIndexMap = new Map();
        headerRow.forEach((header, index) => {
            if (header && !headerIndexMap.has(header)) {
                headerIndexMap.set(header, index);
            }
        });

        const missingColumns = expectedFields.filter(fieldName => !headerIndexMap.has(fieldName));
        if (missingColumns.length > 0) {
            return res.status(400).send(`Missing required column(s): ${missingColumns.join(', ')}`);
        }

        const dataStartIndex = detectDataStartIndex(rows, headerIndexMap, fieldDetails);
        const dataRows = rows.slice(dataStartIndex).filter(row => {
            return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        });

        if (dataRows.length === 0) {
            return res.status(400).send('No data rows found in the uploaded file.');
        }

        // 將數據導入到事件的 users 陣列中：
        // - 有 _id 且可找到現有用戶 -> 更新
        // - 沒有 _id -> 新增
        // - 有 _id 但找不到 -> skipped（不新增）
        const now = Date.now();
        let createdCount = 0;
        let updatedCount = 0;
        const idColumnIndex = headerIndexMap.get('_id');
        const hasCheckInColumn = headerIndexMap.has('isCheckIn');

        let hasAnyUserMutation = false;
        let unchangedCount = 0;
        let idNotFoundSkippedCount = 0;
        const details = [];
        const maxDetailRows = 5000; // 避免回應過大

        for (let i = 0; i < dataRows.length; i += 1) {
            const row = dataRows[i];
            const excelRowNo = i + dataStartIndex + 1; // Excel 1-based（已跳過 header / label 列）
            const incomingId = idColumnIndex !== undefined
                ? (row[idColumnIndex] !== undefined && row[idColumnIndex] !== null ? String(row[idColumnIndex]).trim() : '')
                : '';

            const mappedData = {};
            expectedFields.forEach(fieldName => {
                const columnIndex = headerIndexMap.get(fieldName);
                const rawValue = columnIndex !== undefined ? row[columnIndex] : '';
                let value = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';
                if (locateMode) {
                    value = fromLocateInputValue(value, fieldName, locateMaps.labelToValueByField);
                }
                mappedData[fieldName] = value;
            });

            const existingUser = incomingId ? findUserByIncomingId(event.users, incomingId) : null;
            const existingUserIndex = existingUser
                ? event.users.findIndex(u => String(u._id) === String(existingUser._id))
                : -1;

            if (existingUser) {
                const changedFields = [];
                expectedFields.forEach(fieldName => {
                    const oldVal = normalizeComparableValue(existingUser[fieldName]);
                    const newVal = normalizeComparableValue(mappedData[fieldName]);
                    if (oldVal !== newVal) {
                        changedFields.push(fieldName);
                    }
                    existingUser[fieldName] = mappedData[fieldName];
                });

                let checkInChanged = false;
                if (hasCheckInColumn) {
                    const checkInRaw = row[headerIndexMap.get('isCheckIn')];
                    const nextCheckIn = parseBooleanCell(checkInRaw);
                    if (Boolean(existingUser.isCheckIn) !== Boolean(nextCheckIn)) {
                        checkInChanged = true;
                        changedFields.push('isCheckIn');
                    }
                    existingUser.isCheckIn = nextCheckIn;
                }

                if (changedFields.length > 0 || checkInChanged) {
                    const mergedUser = typeof existingUser.toObject === 'function'
                        ? existingUser.toObject({ minimize: false })
                        : { ...existingUser };
                    expectedFields.forEach(fieldName => {
                        mergedUser[fieldName] = mappedData[fieldName];
                    });
                    if (hasCheckInColumn) {
                        const checkInRaw = row[headerIndexMap.get('isCheckIn')];
                        mergedUser.isCheckIn = parseBooleanCell(checkInRaw);
                    }
                    mergedUser.modified_at = now;
                    const namedUser = applyImportDisplayName(mergedUser, expectedFields);
                    if (existingUserIndex >= 0) {
                        event.users.set(existingUserIndex, namedUser);
                    }
                    updatedCount += 1;
                    hasAnyUserMutation = true;
                    if (details.length < maxDetailRows) {
                        details.push({
                            row: excelRowNo,
                            action: 'updated',
                            userId: incomingId,
                            reason: `Changed fields: ${changedFields.join(', ')}`,
                            changedFields
                        });
                    }
                } else {
                    unchangedCount += 1;
                    if (details.length < maxDetailRows) {
                        details.push({
                            row: excelRowNo,
                            action: 'unchanged',
                            userId: incomingId,
                            reason: 'No value changed (same as existing data).',
                            changedFields: []
                        });
                    }
                }
            } else {
                // 有給 _id 但在該 event 找不到：不自動新增，避免誤以為已更新原 row
                if (incomingId) {
                    idNotFoundSkippedCount += 1;
                    if (details.length < maxDetailRows) {
                        details.push({
                            row: excelRowNo,
                            action: 'skipped',
                            userId: incomingId,
                            reason: 'Given _id not found in this event; skipped (not created).',
                            changedFields: []
                        });
                    }
                    continue;
                }

                const newUser = applyImportDisplayName({
                    ...mappedData,
                    isCheckIn: hasCheckInColumn ? parseBooleanCell(row[headerIndexMap.get('isCheckIn')]) : false,
                    create_at: now,
                    modified_at: now
                }, expectedFields);
                event.users.push(newUser);
                createdCount += 1;
                hasAnyUserMutation = true;
                if (details.length < maxDetailRows) {
                    details.push({
                        row: excelRowNo,
                        action: 'created',
                        userId: '',
                        reason: 'No _id provided; created as new guest.',
                        changedFields: ['_id(empty)']
                    });
                }
            }
        }

        // users 子文件包含 strict:false 的動態欄位；批量更新時顯式標記可避免「計數成功但未落庫」
        // schema 仍要求 name：舊資料或 firstname/lastname 匯入若缺 name，save 會整批失敗
        const backfilledNameCount = fillMissingUserNames(event.users);
        if (hasAnyUserMutation || backfilledNameCount > 0) {
            event.markModified('users');
        }
        await event.save(); // 保存事件

        res.status(201).send(renderImportResultPage({
            eventId,
            createdCount,
            updatedCount,
            unchangedCount,
            idNotFoundSkippedCount,
            details,
            modeLabel: locateMode ? 'Locate Import' : 'Import'
        }));
    } catch (error) {
        console.error(error);
        const detail = error && error.message ? String(error.message) : '';
        res.status(500).send(detail
            ? `Error during import process: ${detail}`
            : 'Error during import process!');
    }
}

exports.importUsers = async (req, res) => runUserImport(req, res, { locateMode: false });
exports.importLocateUsers = async (req, res) => runUserImport(req, res, { locateMode: true });

exports.downloadSampleFile = async (req, res) => {
    const { eventId } = req.params;

    try {
        const { fields, fieldDetails } = await getImportFieldDefinitions(eventId);

        if (!fields || fields.length === 0) {
            return res.status(400).send('No form fields available to generate sample file. Please configure the registration form first.');
        }

        const { fieldNames, labels } = buildImportHeaderRows(fieldDetails);
        const worksheet = XLSX.utils.aoa_to_sheet([fieldNames, labels]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample');

        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename=import_sample_${eventId}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating sample file:', error);
        res.status(500).send('Failed to generate sample file.');
    }
};

async function buildCurrentUsersExportRows(eventId, { locateMode = false } = {}) {
    const event = await Event.findById(eventId);
    if (!event) {
        const err = new Error('Event not found');
        err.status = 404;
        throw err;
    }

    const { fields: expectedFields, fieldDetails, migratedConfig, language } = await getImportFieldDefinitions(eventId);
    if (!expectedFields || expectedFields.length === 0) {
        const err = new Error('No form fields available for this event.');
        err.status = 400;
        throw err;
    }

    const locateMaps = locateMode
        ? buildLocateValueMaps(migratedConfig, language)
        : null;

    const { fieldNames, labels } = buildImportHeaderRows(fieldDetails);
    const rows = [fieldNames, labels];

    (event.users || []).forEach(user => {
        const row = [];
        row.push(user && user._id ? String(user._id) : '');
        expectedFields.forEach(fieldName => {
            const raw = user && user[fieldName] !== undefined && user[fieldName] !== null ? user[fieldName] : '';
            if (locateMode) {
                row.push(toLocateDisplayValue(raw, fieldName, locateMaps.fieldIndex));
            } else {
                row.push(raw !== '' ? String(raw) : '');
            }
        });
        row.push(user && user.isCheckIn ? '1' : '0');
        rows.push(row);
    });

    return { rows, eventId };
}

exports.downloadCurrentUsersFile = async (req, res) => {
    const { eventId } = req.params;

    try {
        const { rows } = await buildCurrentUsersExportRows(eventId, { locateMode: false });
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename=users_export_${eventId}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating users export file:', error);
        const status = error.status || 500;
        res.status(status).send(error.message || 'Failed to generate users export file.');
    }
};

/** 匯出目前賓客：select/radio 等欄位用 Label（Locate 資料，方便客人改） */
exports.downloadLocateUsersFile = async (req, res) => {
    const { eventId } = req.params;

    try {
        const { rows } = await buildCurrentUsersExportRows(eventId, { locateMode: true });
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Locate');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename=users_locate_export_${eventId}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating locate export file:', error);
        const status = error.status || 500;
        res.status(status).send(error.message || 'Failed to generate locate export file.');
    }
};
