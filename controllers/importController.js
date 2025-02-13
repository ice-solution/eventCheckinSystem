const multer = require('multer');
const XLSX = require('xlsx');
const User = require('../model/User'); // 確保引入 User 模型

// 設置 multer 以處理文件上傳
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');

exports.getImportUserPage = async (req, res) => {
    try {
        console.log('test');
        res.render('import');
    } catch (error) {
        res.status(400).send(error);
    }
};

exports.importUsers = async (req, res) => {
    try {
        // 確保 req.file 存在
        if (!req.file) {
            return res.status(400).send('未上傳文件！');
        }

        // 解析 Excel 文件
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        // 將數據導入到數據庫
        for (const row of data) {
            const user = new User({
                email: row.email,
                name: row.name,
                phone_code: row.phone_code,
                phone: row.phone,
                company: row.company
            });
            await user.save();
        }

        res.status(201).send('用戶導入成功！');
    } catch (error) {
        console.error(error);
        res.status(500).send('導入過程中出現錯誤！');
    }
};
