// app.js
require('dotenv').config(); // 加載環境變量
const QRCode = require('qrcode');

const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const session = require('express-session');
const flash = require('connect-flash');
const usersRouter = require('./routes/users');
const websiteRouter = require('./routes/websites');
const eventsRouter = require('./routes/events');
const awardsRouter = require('./routes/awards'); // 引入新的路由
const authRoutes = require('./routes/auth'); // 引入 auth 路由
const emailTemplateRoutes = require('./routes/emailTemplate'); // 引入 emailTemplate 路由
const prizesRouter = require('./routes/prizes'); // 引入獎品路由
const votesRouter = require('./routes/votes'); // 引入投票路由
const gamesRouter = require('./routes/games'); // 引入遊戲路由
const formConfigRouter = require('./routes/formConfig'); // 引入表單配置路由

const eventsController = require('./controllers/eventsController');

const Auth = require('./model/Auth'); // 引入 Auth 模型
const path = require('path'); // 引入 path 模組
const bcrypt = require('bcrypt');
const { render } = require('ejs');
const { initSocket } = require('./socket'); // 引入 socket.js

const app = express();
const PORT = process.env.PORT || 3377;
const server = http.createServer(app);
const io = initSocket(server); // 初始化 Socket.IO

// 中間件
app.post('/web/webhook/stripe', express.raw({type: 'application/json'}), eventsController.stripeWebhook);
app.use(express.json()); // 解析 JSON 請求主體
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'events', // 替換為您的密鑰
    resave: false,
    saveUninitialized: true
}));
app.use(flash());
app.set('view engine', 'ejs'); // 設置 EJS 作為模板引擎
app.set('views', './views'); // 設置視圖文件夾

app.use(express.static(path.join(__dirname, 'public'))); // 提供 public 文件夾中的靜態文件

// 設置全局變量
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// 連接到 MongoDB
mongoose.connect(process.env.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    createAdminUser(); // 創建 admin 用戶
    console.log('MongoDB 連接成功')
})
.catch(err => console.error('MongoDB 連接失敗:', err));
mongoose.set('debug', true);
// 登入路由

app.get('/homepage', async (req, res) => {
    res.render('pages/index');
});
app.get('/event-details', async (req, res) => {
    res.render('pages/event-details');
});
app.get('/about', async (req, res) => {
    res.render('pages/about');
});
app.get('/purpose', async (req, res) => {
    res.render('pages/purpose');
});
app.get('/tc', async (req, res) => {
    res.render('pages/tc');
});
app.get('/rules', async (req, res) => {
    res.render('pages/rules');
});
app.get('/login', async (req, res) => {
    res.render('admin/login');
});
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username); // 日誌登入嘗試

    try {
        const user = await Auth.findOne({ username });
        if (!user) {
            return res.status(401).send(); // 用戶不存在
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = user; // 設置 session
            return res.status(200).send(); // 登入成功
        } else {
            return res.status(401).send(); // 密碼不正確
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).send(); // 伺服器錯誤
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy(); // 銷毀 session
    res.redirect('/login'); // 重定向到登入頁面
});

// 中間件：檢查是否登入
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next(); // 已登入，繼續
    }
    res.redirect('/login'); // 未登入，重定向到登入頁
};

// 設置路由
app.use('/web', websiteRouter);
app.use('/events', eventsRouter);
app.use('/users',isAuthenticated, usersRouter);
app.use('/awards', awardsRouter);
app.use('/auth', authRoutes); // 使用 auth 路由
app.use('/emailTemplate', emailTemplateRoutes); // 使用 emailTemplate 路由
app.use('/prizes', prizesRouter); // 使用獎品路由
app.use('/votes', votesRouter); // 使用投票路由
app.use('/api/game', gamesRouter); // 使用遊戲API路由
app.use('/formConfig', isAuthenticated, formConfigRouter); // 使用表單配置路由（需要認證）

app.get('/demo_website',async function (req, res){
    try {
        res.render('demo_website/index'); // 傳遞用戶資料到 EJS 頁面
    } catch (error) {
        console.log(error)
        res.status(500).send(error);
    }
});
app.get('/demo_website/success',async function (req, res){
    try {
        res.render('demo_website/success'); // 傳遞用戶資料到 EJS 頁面
    } catch (error) {
        console.log(error)
        res.status(500).send(error);
    }
});

app.get('/qrcode', async (req, res) => {
    const { userId } = req.query; // 獲取查詢參數

    if (!userId) {
        return res.status(400).send('缺少必要的查詢參數： userId');
    }

    try {
        // 生成 QR 碼的數據
        const qrCodeData = `userId=${userId}`;
        
        // 生成 QR 碼
        const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

        // 返回 QR 碼的 HTML
        res.send(`
            <img src="${qrCodeUrl}" alt="QR Code" />
        `);
    } catch (error) {
        console.error('生成 QR 碼時出錯:', error);
        res.status(500).send('生成 QR 碼時出錯');
    }
});


app.get('/',isAuthenticated, async function (req, res){
    // res.render('admin/home');

    res.redirect('/events/list');
});
// 啟動伺服器

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('start_draw', async (numOfUsers) => {
        const awardsController = require('./controllers/awardsController');
        await awardsController.startDraw(numOfUsers); // 調用控制器中的 startDraw 方法
    });
});
server.listen(PORT, () => {
    console.log(`伺服器正在運行於 http://localhost:${PORT}`);
});

async function createAdminUser() {
    const adminExists = await Auth.findOne({ username: 'admin' });
    if (!adminExists) {
        // const hashedPassword = await bcrypt.hash('admin_password', 10); // 將 'admin_password' 替換為你想要的密碼
        const adminUser = new Auth({
            username: 'admin',
            password: 'admin_password',
            role: 'admin'
        });
        await adminUser.save();
        console.log('Admin user created');
    } else {
        console.log('Admin user already exists');
    }
}

