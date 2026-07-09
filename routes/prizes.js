const express = require('express');
const router = express.Router();
const prizeController = require('../controllers/prizeController');
const multer = require('multer');
const path = require('path');

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
router.get('/:eventId/prizes', prizeController.getPrizesByEvent);

// 渲染獎品管理頁面
router.get('/:eventId/prizes/list', prizeController.renderPrizeList);

// 渲染創建獎品頁面
router.get('/:eventId/prizes/create', prizeController.renderCreatePrize);

// 創建獎品
router.post('/:eventId/prizes', uploadPrizeImageMulter.single('prizeImage'), prizeController.createPrize);

// 渲染編輯獎品頁面
router.get('/:eventId/prizes/:prizeId/edit', prizeController.renderEditPrize);

// 更新獎品
router.put('/:eventId/prizes/:prizeId', uploadPrizeImageMulter.single('prizeImage'), prizeController.updatePrize);

// 刪除獎品
router.delete('/:eventId/prizes/:prizeId', prizeController.deletePrize);

// 刪除所有獎品
router.delete('/:eventId/prizes', prizeController.deleteAllPrizes);

// 上傳獎品圖片
router.post('/:eventId/prizes/:prizeId/upload-image', uploadPrizeImageMulter.single('prizeImage'), prizeController.uploadPrizeImage);

// 批量上傳獎品（使用 memory storage 處理 Excel 檔案）
const uploadExcel = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 10, // 10MB
    },
    fileFilter: (req, file, cb) => {
        // 只接受 Excel 檔案
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)！'), false);
        }
    }
});

router.post('/:eventId/prizes/batch-upload', uploadExcel.single('file'), prizeController.batchUploadPrizes);

// 下載範本檔案
router.get('/:eventId/prizes/download-sample', prizeController.downloadSampleFile);

module.exports = router; 