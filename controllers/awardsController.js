const User = require('../model/User'); // 確保引入 User 模型
const AwardUser = require('../model/AwardUser'); // 確保引入 AwardUser 模型
const { getSocket } = require('../socket'); // 確保正確導入 getSocket 函數


exports.startDraw = async (numOfUsers) => {
    const users = await User.find({ isCheckIn: true });
    const selectedUsers = [];

    // 隨機抽取用戶
    for (let i = 0; i < numOfUsers; i++) {
        const randomIndex = Math.floor(Math.random() * users.length);
        const user = users[randomIndex];
        selectedUsers.push(user);

        // 保存到 AwardUser 模型
        const awardUser = new AwardUser({ userId: user._id });
        await awardUser.save();
    }

    // 通知所有連接的客戶端
    const io = getSocket();
    io.emit('draw_result', selectedUsers);
};

// 渲染頁面
exports.renderAdminPage = (req, res) => {
    res.render('awards_admin');
};

exports.renderDisplayPage = (req, res) => {
    res.render('display_awards');
};