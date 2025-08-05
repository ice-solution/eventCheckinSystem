const Prize = require('../model/Prize');
const Event = require('../model/Event');
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