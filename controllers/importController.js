const multer = require('multer');
const XLSX = require('xlsx');
const Event = require('../model/Event'); // 確保引入 User 模型
const FormConfig = require('../model/FormConfig');
const formConfigController = require('./formConfigController');

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
    const fieldMap = new Map();

    if (migratedConfig.sections) {
        migratedConfig.sections.forEach(section => {
            if (!section || section.visible === false || !Array.isArray(section.fields)) return;
            section.fields.forEach(field => {
                if (!field || field.visible === false || !field.fieldName) return;
                if (fieldMap.has(field.fieldName)) return; // 避免重複欄位

                let label = '';
                if (typeof field.label === 'string') {
                    label = field.label;
                } else if (field.label && (field.label[language] || field.label.zh)) {
                    label = field.label[language] || field.label.zh;
                } else {
                    label = field.fieldName;
                }

                fieldMap.set(field.fieldName, {
                    fieldName: field.fieldName,
                    label
                });
            });
        });
    }

    const fieldDetails = Array.from(fieldMap.values());
    const fields = fieldDetails.map(field => field.fieldName);

    return { fields, fieldDetails };
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

exports.importUsers = async (req, res) => {
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

        const { fields: expectedFields } = await getImportFieldDefinitions(eventId);
        if (!expectedFields || expectedFields.length === 0) {
            return res.status(400).send('No form fields available for this event. Please configure the registration form first.');
        }

        // 解析 Excel 文件
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).send('Uploaded file is empty.');
        }

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

        const dataRows = rows.slice(1).filter(row => {
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
            const excelRowNo = i + 2; // 第 1 列是 header
            const incomingId = idColumnIndex !== undefined
                ? (row[idColumnIndex] !== undefined && row[idColumnIndex] !== null ? String(row[idColumnIndex]).trim() : '')
                : '';

            const mappedData = {};
            expectedFields.forEach(fieldName => {
                const columnIndex = headerIndexMap.get(fieldName);
                const rawValue = columnIndex !== undefined ? row[columnIndex] : '';
                const value = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';
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
                    if (existingUserIndex >= 0) {
                        event.users.set(existingUserIndex, mergedUser);
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

                const newUser = {
                    ...mappedData,
                    isCheckIn: hasCheckInColumn ? parseBooleanCell(row[headerIndexMap.get('isCheckIn')]) : false,
                    create_at: now,
                    modified_at: now
                };
                event.users.push(newUser);
                createdCount += 1;
                hasAnyUserMutation = true;
                if (details.length < maxDetailRows) {
                    details.push({
                        row: excelRowNo,
                        action: 'created',
                        userId: '',
                        reason: 'No _id provided; created as new user.',
                        changedFields: ['_id(empty)']
                    });
                }
            }
        }

        // users 子文件包含 strict:false 的動態欄位；批量更新時顯式標記可避免「計數成功但未落庫」
        if (hasAnyUserMutation) {
            event.markModified('users');
        }
        await event.save(); // 保存事件

        // 返回導入成功的響應
        res.status(201).send(`
            <html>
                <body>
                    <h1>Import Successful!</h1>
                    <p>
                        Created: ${createdCount},
                        Updated: ${updatedCount},
                        Unchanged: ${unchangedCount},
                        _id Not Found -> Skipped: ${idNotFoundSkippedCount}
                    </p>
                    <p>Below are import details to help diagnose why a row was not updated.</p>
                    <div style="max-height:420px; overflow:auto; border:1px solid #ddd; padding:8px;">
                        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif; font-size:12px;">
                            <thead>
                                <tr>
                                    <th>Excel Row</th>
                                    <th>Action</th>
                                    <th>User _id</th>
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
                    <p style="margin-top:8px; color:#666;">If a row shows "unchanged", it means uploaded values are identical to current database values.</p>
                    <script>
                        setTimeout(function() {
                            window.location.href = '/events/${eventId}';
                        }, 2000); // 2秒後重定向
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error during import process!');
    }
};

exports.downloadSampleFile = async (req, res) => {
    const { eventId } = req.params;

    try {
        const { fields, fieldDetails } = await getImportFieldDefinitions(eventId);

        if (!fields || fields.length === 0) {
            return res.status(400).send('No form fields available to generate sample file. Please configure the registration form first.');
        }

        const titlesRow = ['_id', ...fieldDetails.map(field => `${field.fieldName}`), 'isCheckIn'];
        const worksheet = XLSX.utils.aoa_to_sheet([titlesRow]);
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

exports.downloadCurrentUsersFile = async (req, res) => {
    const { eventId } = req.params;

    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).send('Event not found');

        const { fields: expectedFields } = await getImportFieldDefinitions(eventId);
        if (!expectedFields || expectedFields.length === 0) {
            return res.status(400).send('No form fields available for this event.');
        }

        const header = ['_id', ...expectedFields, 'isCheckIn'];
        const rows = [header];

        (event.users || []).forEach(user => {
            const row = [];
            row.push(user && user._id ? String(user._id) : '');
            expectedFields.forEach(fieldName => {
                const v = user && user[fieldName] !== undefined && user[fieldName] !== null ? String(user[fieldName]) : '';
                row.push(v);
            });
            row.push(user && user.isCheckIn ? '1' : '0');
            rows.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename=users_export_${eventId}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating users export file:', error);
        res.status(500).send('Failed to generate users export file.');
    }
};
