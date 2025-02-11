// app.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session'); // 引入 session
const usersRouter = require('./routes/users');
const Auth = require('./model/Auth'); // 引入 Auth 模型
const path = require('path'); // 引入 path 模組
const bcrypt = require('bcrypt');
const { render } = require('ejs');

const app = express();
const PORT = process.env.PORT || 9000;

// 中間件
app.use(express.json()); // 解析 JSON 請求主體
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'events', // 替換為您的密鑰
    resave: false,
    saveUninitialized: true
}));
app.set('view engine', 'ejs'); // 設置 EJS 作為模板引擎
app.set('views', './views'); // 設置視圖文件夾

app.use(express.static(path.join(__dirname, 'public'))); // 提供 public 文件夾中的靜態文件


// 連接到 MongoDB
mongoose.connect('mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/prud', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    createAdminUser(); // 創建 admin 用戶
    console.log('MongoDB 連接成功')
})
.catch(err => console.error('MongoDB 連接失敗:', err));

// 登入路由
app.get('/login', async (req, res) => {
    res.render('login');
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
            req.session.user = { username }; // 設置 session
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
    res.redirect('login'); // 未登入，重定向到登入頁
};

// 設置路由

app.use('/users',isAuthenticated, usersRouter);
app.get('/scan',isAuthenticated,async function (req, res){
    try {
        res.render('scan'); // 傳遞用戶資料到 EJS 頁面
    } catch (error) {
        console.log(error)
        res.status(500).send(error);
    }
});
app.get('/',isAuthenticated, async function (req, res){
    res.render('home');
});
// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器正在運行於 http://localhost:${PORT}`);
});

async function createAdminUser() {
    const adminExists = await Auth.findOne({ username: 'admin' });
    if (!adminExists) {
        // const hashedPassword = await bcrypt.hash('admin_password', 10); // 將 'admin_password' 替換為你想要的密碼
        const adminUser = new Auth({
            username: 'admin',
            password: 'admin_password'
        });
        await adminUser.save();
        console.log('Admin user created');
    } else {
        console.log('Admin user already exists');
    }
}