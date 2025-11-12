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

        // 將數據導入到事件的 users 陣列中
        const now = Date.now();
        let importedCount = 0;
        for (const row of dataRows) {
            const newUser = {
                isCheckIn: false,
                create_at: now,
                modified_at: now
            };

            expectedFields.forEach(fieldName => {
                const columnIndex = headerIndexMap.get(fieldName);
                const rawValue = columnIndex !== undefined ? row[columnIndex] : '';
                const value = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';
                newUser[fieldName] = value;
            });

            event.users.push(newUser);
            importedCount += 1;
        }

        await event.save(); // 保存事件

        // 返回導入成功的響應
        res.status(201).send(`
            <html>
                <body>
                    <h1>Import Successful!</h1>
                    <p>${importedCount} user(s) have been imported successfully. Redirecting in 2 seconds...</p>
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

        const titlesRow = fieldDetails.map(field => `${field.fieldName}`);
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
