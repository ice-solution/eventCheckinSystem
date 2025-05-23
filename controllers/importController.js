const multer = require('multer');
const XLSX = require('xlsx');
const Event = require('../model/Event'); // 確保引入 User 模型

// 設置 multer 以處理文件上傳
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');

exports.getImportUserPage = async (req, res) => {
    const { eventId } = req.params; // 從請求參數中獲取 eventId

    try {
        // 查詢事件以檢查是否存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('找不到活動 ID'); // 如果事件不存在，返回 404 錯誤
        }

        res.render('admin/import', { event }); // 將 eventId 傳遞給視圖
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

        // 解析 Excel 文件
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        // 查詢事件以確保存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        // 將數據導入到事件的 users 陣列中
        for (const row of data) {
            const user = {
                email: row.email,
                name: row.name,
                phone_code: row.phone_code,
                phone: row.phone,
                company: row.company,
                saluation: row.saluation,
                industry: row.industry,
                transport: row.transport,
                meal: row.meal,
                remarks: row.remarks,
                isCheckIn: false,
                create_at: Date.now(),
                modified_at: Date.now()
            };

            // 檢查用戶是否已存在
            // temp off email check
            // const userExists = event.users.find(u => u.email === user.email);
            // if (!userExists) {
                event.users.push(user); // 將用戶添加到事件的 users 陣列中
            // }
        }

        await event.save(); // 保存事件

        // 返回導入成功的響應
        res.status(201).send(`
            <html>
                <body>
                    <h1>Import Successful!</h1>
                    <p>Users have been imported successfully. Redirect in 2 sec...</p>
                    <script>
                        setTimeout(function() {
                            window.location.href = '/events/${eventId}';
                        }, 2000); // 5秒後重定向
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error during import process!');
    }
};
