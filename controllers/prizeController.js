const Prize = require('../model/Prize');
const Event = require('../model/Event');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

// 設置 multer 來處理獎品圖片上傳
const uploadPrizeImage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/prizes/img/'); // 設定上傳路徑
    },
    filename: (req, file, cb) => {
        const eventId = req.params.eventId; // 獲取 eventId
        const prizeId = req.params.prizeId || Date.now(); // 獲取 prizeId 或使用時間戳
        const ext = path.extname(file.originalname); // 獲取文件擴展名
        cb(null, `${eventId}_${prizeId}${ext}`); // 使用 eventId_prizeId 作為文件名
    }
});

const uploadPrizeImageMulter = multer({ 
    storage: uploadPrizeImage,
    limits: {
        fileSize: 1024 * 1024 * 5, // 5MB
    },
    fileFilter: (req, file, cb) => {
        // 只接受圖片
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允許上傳圖片！'), false);
        }
        cb(null, true);
    }
});

// 獲取事件的獎品列表
exports.getPrizesByEvent = async (req, res) => {
    const { eventId } = req.params;
    try {
        const prizes = await Prize.find({ eventId });
        res.json(prizes);
    } catch (error) {
        console.error('Error fetching prizes:', error);
        res.status(500).json({ message: 'Error fetching prizes' });
    }
};

// 創建獎品
exports.createPrize = async (req, res) => {
    const { eventId } = req.params;
    const { name, picture, unit } = req.body;
    
    try {
        let picturePath = picture;
        
        // 如果有上傳的圖片文件
        if (req.file) {
            picturePath = `/prizes/img/${req.file.filename}`;
        }
        
        const newPrize = new Prize({
            eventId,
            name,
            picture: picturePath,
            unit: unit || 1
        });
        
        await newPrize.save();
        res.status(201).json(newPrize);
    } catch (error) {
        console.error('Error creating prize:', error);
        res.status(500).json({ message: 'Error creating prize' });
    }
};

// 更新獎品
exports.updatePrize = async (req, res) => {
    const { prizeId } = req.params;
    const { name, picture, unit } = req.body;
    
    try {
        let picturePath = picture;
        
        // 如果有上傳的圖片文件
        if (req.file) {
            picturePath = `/prizes/img/${req.file.filename}`;
        }
        
        const updatedPrize = await Prize.findByIdAndUpdate(
            prizeId,
            { 
                name, 
                picture: picturePath, 
                unit, 
                modified_at: Date.now() 
            },
            { new: true }
        );
        
        if (!updatedPrize) {
            return res.status(404).json({ message: 'Prize not found' });
        }
        
        res.json(updatedPrize);
    } catch (error) {
        console.error('Error updating prize:', error);
        res.status(500).json({ message: 'Error updating prize' });
    }
};

// 刪除獎品
exports.deletePrize = async (req, res) => {
    const { prizeId } = req.params;
    
    try {
        const deletedPrize = await Prize.findByIdAndDelete(prizeId);
        
        if (!deletedPrize) {
            return res.status(404).json({ message: 'Prize not found' });
        }
        
        res.json({ message: 'Prize deleted successfully' });
    } catch (error) {
        console.error('Error deleting prize:', error);
        res.status(500).json({ message: 'Error deleting prize' });
    }
};

// 渲染獎品管理頁面
exports.renderPrizeList = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        
        const prizes = await Prize.find({ eventId });
        res.render('admin/prize_list', { eventId, prizes, event });
    } catch (error) {
        console.error('Error rendering prize list:', error);
        res.status(500).send('Error rendering prize list');
    }
};

// 渲染創建獎品頁面
exports.renderCreatePrize = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        
        res.render('admin/create_prize', { eventId, event });
    } catch (error) {
        console.error('Error rendering create prize page:', error);
        res.status(500).send('Error rendering create prize page');
    }
};

// 渲染編輯獎品頁面
exports.renderEditPrize = async (req, res) => {
    const { eventId, prizeId } = req.params;
    try {
        const event = await Event.findById(eventId);
        const prize = await Prize.findById(prizeId);
        
        if (!event) {
            return res.status(404).send('Event not found');
        }
        
        if (!prize) {
            return res.status(404).send('Prize not found');
        }
        
        res.render('admin/edit_prize', { eventId, prize, event });
    } catch (error) {
        console.error('Error rendering edit prize page:', error);
        res.status(500).send('Error rendering edit prize page');
    }
};

// 上傳獎品圖片
exports.uploadPrizeImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: '沒有上傳文件或文件格式不正確' });
    }
    
    try {
        const { eventId, prizeId } = req.params;
        
        // 獲取上傳的文件路徑
        const filePath = `/prizes/img/${req.file.filename}`;
        
        // 更新獎品的圖片路徑
        const prize = await Prize.findById(prizeId);
        if (!prize) {
            return res.status(404).json({ message: 'Prize not found' });
        }
        
        prize.picture = filePath;
        await prize.save();
        
        res.json({ 
            message: '圖片上傳成功！',
            picture: filePath
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({ message: 'Error uploading prize image' });
    }
};

// 批量上傳獎品
exports.batchUploadPrizes = async (req, res) => {
    const { eventId } = req.params;
    
    try {
        // 確保 req.file 存在
        if (!req.file) {
            return res.status(400).json({ success: false, message: '沒有上傳文件' });
        }

        // 查詢事件以確保存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // 解析 Excel 文件
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, message: '上傳的檔案是空的' });
        }

        // 第一行是標題行
        const headerRow = rows[0].map(header => (header !== null && header !== undefined ? String(header).trim() : ''));
        const headerIndexMap = new Map();
        headerRow.forEach((header, index) => {
            if (header && !headerIndexMap.has(header)) {
                headerIndexMap.set(header, index);
            }
        });

        // 檢查必填欄位
        const requiredFields = ['name', 'unit'];
        const missingColumns = requiredFields.filter(fieldName => !headerIndexMap.has(fieldName));
        if (missingColumns.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `缺少必填欄位：${missingColumns.join(', ')}` 
            });
        }

        // 處理數據行
        const dataRows = rows.slice(1).filter(row => {
            return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        });

        if (dataRows.length === 0) {
            return res.status(400).json({ success: false, message: '檔案中沒有數據行' });
        }

        // 批量創建獎品
        const now = Date.now();
        let importedCount = 0;
        const errors = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNumber = i + 2; // Excel 行號（從 2 開始，因為第 1 行是標題）

            try {
                // 獲取必填欄位
                const nameIndex = headerIndexMap.get('name');
                const unitIndex = headerIndexMap.get('unit');
                const pictureIndex = headerIndexMap.has('picture') ? headerIndexMap.get('picture') : null;

                const name = nameIndex !== undefined ? String(row[nameIndex] || '').trim() : '';
                const unitStr = unitIndex !== undefined ? String(row[unitIndex] || '').trim() : '';
                const picture = pictureIndex !== null && pictureIndex !== undefined ? String(row[pictureIndex] || '').trim() : '';

                // 驗證必填欄位
                if (!name) {
                    errors.push(`第 ${rowNumber} 行：獎品名稱不能為空`);
                    continue;
                }

                const unit = parseInt(unitStr, 10);
                if (isNaN(unit) || unit < 1) {
                    errors.push(`第 ${rowNumber} 行：數量必須是正整數`);
                    continue;
                }

                // 創建獎品
                const newPrize = new Prize({
                    eventId,
                    name,
                    unit,
                    picture: picture || undefined,
                    created_at: now,
                    modified_at: now
                });

                await newPrize.save();
                importedCount += 1;
            } catch (error) {
                console.error(`Error processing row ${rowNumber}:`, error);
                errors.push(`第 ${rowNumber} 行：處理失敗 - ${error.message}`);
            }
        }

        if (importedCount === 0 && errors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: '沒有成功導入任何獎品',
                errors: errors.slice(0, 10) // 只返回前 10 個錯誤
            });
        }

        res.json({ 
            success: true, 
            importedCount,
            totalRows: dataRows.length,
            errors: errors.length > 0 ? errors.slice(0, 10) : []
        });
    } catch (error) {
        console.error('Error during batch upload:', error);
        res.status(500).json({ success: false, message: '批量上傳過程中發生錯誤：' + error.message });
    }
};

// 下載範本檔案
exports.downloadSampleFile = async (req, res) => {
    const { eventId } = req.params;

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        // 創建範本 Excel 檔案
        const headers = ['name', 'unit', 'picture'];
        const sampleData = [
            ['範例獎品1', 10, '/prizes/img/sample1.jpg'],
            ['範例獎品2', 5, ''],
            ['範例獎品3', 20, '/prizes/img/sample3.jpg']
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '獎品列表');

        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename=prize_import_sample_${eventId}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating sample file:', error);
        res.status(500).send('生成範本檔案失敗');
    }
}; 