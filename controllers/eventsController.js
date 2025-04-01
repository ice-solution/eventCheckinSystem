const Event = require('../model/Event'); // 引入 Event 模型
const Auth = require('../model/Auth'); // 引入 Auth 模型
const sendWhatsAppMessage = require('./components/sendWhatsAppMessage'); // 使用相對路徑
const sendWelcomeEmail = require('./components/sendWelcomeEmail'); // 引入發送郵件的函數
const mongoose = require('mongoose');


// 創建事件
exports.createEvent = async (req, res) => {
    const { name, from, to } = req.body;

    try {
        const newEvent = new Event({
            name,
            from,
            to,
            owner: req.session.user._id, // 使用 session 中的用戶 ID 作為擁有者
            created_at: Date.now(), // 設置創建時間
            modified_at: Date.now(), // 設置修改時間
            
        });

        console.log(newEvent);
        await newEvent.save(); // 保存事件
        res.status(201).json(newEvent); // 返回創建的事件
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Error creating event' });
    }
};

// 獲取用戶的事件
exports.getUserEvents = async (req, res) => {
    try {
        const events = await Event.find({ owner: req.session.user._id }); // 根據擁有者查詢事件
        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
};

// 獲取事件詳細信息
exports.getEventUsersByEventID = async (req, res) => {
    const { eventId } = req.params; // 從請求參數中獲取事件 ID

    try {
        const event = await Event.findById(eventId).populate('users'); // 根據事件 ID 查詢事件並填充用戶信息
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        console.log(event);
        res.render('admin/users', { event }); // 渲染用戶頁面，傳遞事件信息
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Error fetching event' });
    }
};

// 向事件中添加用戶
exports.addUserToEvent = async (req, res) => {
    const { eventId } = req.params; // 從請求參數中獲取事件 ID
    const { email, name, phone_code, phone, company } = req.body; // 從請求中獲取用戶信息

    try {
        const event = await Event.findById(eventId); // 查找事件
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // 創建新的用戶
        const newUser = {
            email,
            name,
            company,
            phone,
            isCheckIn: false // 默認為未登記進場
        };

        event.users.push(newUser); // 將用戶添加到事件中
        await event.save(); // 保存事件

        res.status(201).json({ attendee: newUser }); // 返回新用戶資料
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 渲染用戶登入頁面
exports.renderLoginPage = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    const event = await Event.findById(eventId)
    res.render('events/login', { event }); // 渲染登入頁面，並傳遞事件 ID
};

// 用戶登入
exports.loginUser = async (req, res) => {
    const { eventId, phone } = req.body; // 從請求中獲取事件 ID 和電話號碼

    try {
        const event = await Event.findById(eventId).populate('users'); // 根據事件 ID 查詢事件並填充用戶信息
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        // 查找用戶是否存在
        const user = event.users.find(user => user.phone === phone);
        if (user) {
            // 將用戶資料放入 session
            req.session.user = {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                company: user.company,
                point: user.point,
                isCheckIn: user.isCheckIn
            };
            return res.status(200).json({ message: '登入成功' });
        } else {
            return res.status(404).json({ message: '用戶不存在' });
        }
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 更新事件中的用戶信息
exports.updateUserInEvent = async (req, res) => {
    const { eventId, userEmail } = req.params; // 從請求參數中獲取事件 ID 和用戶電子郵件
    const { name, phone_code, phone, company } = req.body; // 從請求中獲取更新的用戶信息

    try {
        const event = await Event.findById(eventId); // 根據事件 ID 查詢事件
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // 查找用戶
        const user = event.users.find(user => user.email === userEmail);
        if (!user) {
            return res.status(404).json({ message: 'User not found in this event' });
        }

        // 更新用戶信息
        user.name = name || user.name;
        user.phone_code = phone_code || user.phone_code;
        user.phone = phone || user.phone;
        user.company = company || user.company;

        await event.save(); // 保存事件

        res.status(200).json(event);
    } catch (error) {
        console.error('Error updating user in event:', error);
        res.status(500).json({ message: 'Error updating user in event' });
    }
};

// 從事件中移除用戶
exports.removeUserFromEvent = async (req, res) => {
    const { eventId, userEmail } = req.params; // 從請求參數中獲取事件 ID 和用戶電子郵件

    try {
        const event = await Event.findById(eventId); // 根據事件 ID 查詢事件
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // 查找用戶的索引
        const userIndex = event.users.findIndex(user => user.email === userEmail);
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found in this event' });
        }

        // 從用戶數組中移除用戶
        event.users.splice(userIndex, 1);
        await event.save(); // 保存事件

        res.status(200).json(event);
    } catch (error) {
        console.error('Error removing user from event:', error);
        res.status(500).json({ message: 'Error removing user from event' });
    }
};

exports.renderCreateEventPage = async (req, res) => {
    try {
        res.render('admin/create_event'); // 渲染事件列表視圖
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
};
// 獲取當前用戶的事件並渲染事件列表視圖
exports.renderEventsList = async (req, res) => {
    try {
        const events = await Event.find({ owner: req.session.user._id }); // 根據擁有者查詢事件
        res.render('admin/events_list', { events }); // 渲染事件列表視圖
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
};
exports.getUserById = async (req, res) => {
    const { eventId, userId } = req.params; // 從請求參數中獲取事件 ID 和用戶的 _id

    try {
        // 查詢事件以確保存在
        const event = await Event.findById(eventId); // 根據事件 ID 查詢事件
        if (!event) {
            return res.status(404).send('找不到該事件 ID'); // 如果事件不存在，返回 404 錯誤
        }

        // 查找用戶
        const user = event.users.id(userId); // 使用 _id 查找用戶
        if (!user) {
            return res.status(404).send('找不到該用戶'); // 如果用戶不存在，返回 404 錯誤
        }

        // 更新用戶的 isCheckIn 屬性
        user.isCheckIn = true; // 將 isCheckIn 設置為 true
        await event.save(); // 保存事件以更新用戶資料

        res.status(200).send(user); // 返回更新後的用戶資料
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('伺服器錯誤'); // 返回伺服器錯誤
    }
};
exports.updateUser = async (req, res) => {
    const { eventId, userId } = req.params; // 從請求參數中獲取事件 ID 和用戶的 _id
    const { name, phone_code, phone, company,isCheckIn } = req.body; // 從請求中獲取更新的用戶信息

    try {
        // 查詢事件以確保存在
        const event = await Event.findById(eventId); // 根據事件 ID 查詢事件
        if (!event) {
            return res.status(404).send('找不到該事件 ID'); // 如果事件不存在，返回 404 錯誤
        }

        // 查找用戶
        const user = event.users.id(userId); // 使用 _id 查找用戶
        if (!user) {
            return res.status(404).send('找不到該用戶'); // 如果用戶不存在，返回 404 錯誤
        }
        // 更新用戶信息
        user.name = name || user.name;
        user.phone_code = phone_code || user.phone_code;
        user.phone = phone || user.phone;
        user.company = company || user.company;
        user.email = email || user.email;
        user.point = point || user.point;
        user._id = _id || user._id;
        user.isCheckIn = isCheckIn;
        user.modified_at = Date.now(); // 更新修改時間
        await event.save(); // 保存事件以更新用戶資料

        res.status(200).send(user); // 返回更新後的用戶資料
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(400).send('更新用戶時出現錯誤'); // 返回錯誤信息
    }
};
exports.scanEventUsers = async (req, res) => {
    const { eventId } = req.params; // 從請求參數中獲取 eventId

    try {
        // 查詢事件以確保存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('找不到該事件 ID'); // 如果事件不存在，返回 404 錯誤
        }

        res.render('admin/scan_checkin', { event }); // 傳遞事件資料到 EJS 頁面
    } catch (error) {
        console.log(error);
        res.status(500).send('伺服器錯誤');
    }
};

// 根據事件 ID 獲取事件詳細信息並渲染用戶頁面
exports.getEventsUserById = async (req, res) => {
   
};

// 渲染用戶資料頁面
exports.renderProfilePage = (req, res) => {
    const { user } = req.session; // 從 session 中獲取用戶資料
    const eventId = req.params.eventId; // 獲取事件 ID
    if (!user) {
        return res.redirect(`/events/${eventId}/login`); // 如果用戶未登入，重定向到登入頁面
    }
    res.render('events/profile', { user, eventId }); // 渲染用戶資料頁面，並傳遞用戶資料和事件 ID
};

// 添加參展商
exports.addAttendee = async (req, res) => {
    const { eventId } = req.params;
    const { name, location, phone, email, promo_codes } = req.body;

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        const newAttendee = { name, location, phone, email, promo_codes };
        event.attendees.push(newAttendee);
        await event.save();

        res.status(201).json({ message: '參展商添加成功', attendee: newAttendee });
    } catch (error) {
        console.error('Error adding attendee:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 獲取參展商
exports.getAttendee = async (req, res) => {
    const { eventId, attendeeId } = req.params;

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        const attendee = event.attendees.id(attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }

        res.status(200).json(attendee);
    } catch (error) {
        console.error('Error fetching attendee:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 提升參展商的點數
exports.promoteAttendee = async (req, res) => {
    const { eventId, attendeeId } = req.params;
    const { code_name, point } = req.body; // 獲取促銷代碼名稱和點數

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        const attendee = event.attendees.id(attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }

        // 將促銷代碼和點數添加到參展商的促銷代碼列表中
        attendee.promo_codes.push({ code_name, point });

        await event.save(); // 保存更改

        res.status(200).json({ message: '代碼添加成功', attendee });
    } catch (error) {
        console.error('Error promoting attendee:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 獲取參展商的促銷信息
exports.getPromoteInfo = async (req, res) => {
    const { eventId, attendeeId } = req.params;

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        const attendee = event.attendees.id(attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }

        res.status(200).json(attendee.promo_codes);
    } catch (error) {
        console.error('Error fetching promote info:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 渲染添加參展商頁面
exports.renderCreateAttendeePage = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }
        res.render('admin/create_event_attendees', { eventId }); // 渲染添加參展商頁面
    } catch (error) {
        console.error('Error rendering create attendee page:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 渲染參展商列表頁面
exports.renderAttendeesListPage = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }
        res.render('admin/event_attendees_list', { eventId, attendees: event.attendees }); // 返回整個 attendees 列表
    } catch (error) {
        console.error('Error rendering attendees list page:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 渲染添加促銷代碼頁面
exports.renderAddPointPage = async (req, res) => {
    const { eventId, attendeeId } = req.params; // 獲取事件 ID 和參展商 ID
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }
        const attendee = event.attendees.id(attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }
        res.render('admin/event_attendees_add_point', { eventId, attendeeId }); // 渲染添加促銷代碼頁面
    } catch (error) {
        console.error('Error rendering add point page:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 渲染特定參展商的點數列表頁面
exports.renderAttendeePointListPage = async (req, res) => {
    const { eventId, attendeeId } = req.params; // 獲取事件 ID 和參展商 ID
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        const attendee = event.attendees.id(attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }

        res.render('admin/event_attendees_point_list', { eventId, attendee }); // 返回特定參展商的資料
    } catch (error) {
        console.error('Error rendering attendee point list page:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 增加用戶點數
exports.gainPoint = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    const { userId, attendeeId, promo_code_id } = req.body; // 獲取用戶 ID、參展商 ID 和促銷代碼 ID

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        // 檢查用戶是否存在於事件的 users 中
        const user = event.users.id(userId);
        if (!user) {
            return res.status(404).json({ message: '找不到該用戶' });
        }

        // 查找事件中的參展商
        const attendee = event.attendees.id(attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }

        // 檢查促銷代碼是否存在
        console.log(attendee.promo_codes);
        const promo = attendee.promo_codes.find(promo => 
            promo._id.toString() === promo_code_id // 使用 _id 來匹配 promo_code_id
        );

        if (!promo) {
            return res.status(404).json({ message: '找不到參展商分數' });
        }

        // 檢查促銷代碼是否已經使用過
        const promoUsed = user.promos.some(p => 
            p.promo_code_id.toString() === promo_code_id
        );

        if (promoUsed) {
            return res.status(400).json({ message: '分數已經使用過' });
        }

        // 增加用戶的點數
        user.point += promo.point; // 從促銷代碼中獲取點數

        // 將促銷代碼添加到用戶的 promos 中
        user.promos.push({
            event_id: eventId,
            attendee_id: attendeeId, // 使用找到的參展商 ID
            promo_code_id: promo._id // 使用找到的促銷代碼的 _id
        });

        await event.save(); // 保存事件的更改

        res.status(200).json({ message: '點數增加成功', points: user.point });
    } catch (error) {
        console.error('Error gaining points:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 參展商登入頁面
exports.attendeeLoginPage = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    const event = await Event.findById(eventId)
    res.render('events/attendee_login', { event }); // 渲染參展商登入頁面
};

// 參展商登入
exports.attendeeLogin = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    const { phone } = req.body; // 獲取電話號碼

    if (!phone) {
        return res.status(400).json({ message: '請提供電話號碼' });
    }

    try {
        // 查找事件
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        // 查找參展商
        const attendee = event.attendees.find(attendee => attendee.phone === phone);
        if (attendee) {
            // 將參展商資料放入 session
            req.session.attendee = {
                _id: attendee._id,
                name: attendee.name,
                phone: attendee.phone,
                company: attendee.company,
                // 可以根據需要添加其他字段
            };
            return res.status(200).json({ message: '登入成功', attendee });
        } else {
            return res.status(404).json({ message: '找不到該參展商' });
        }
    } catch (error) {
        console.error('登入時出錯:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

// 參展商個人資料頁面
exports.attendeeProfilePage = (req, res) => {
    const { attendee } = req.session; // 從 session 中獲取用戶資料
    const eventId = req.params.eventId; // 獲取事件 ID
    if (!attendee) {
        return res.redirect(`/events/${eventId}/attendees/login`); // 如果用戶未登入，重定向到登入頁面
    }
    res.render('events/attendee_profile', { attendee, eventId }); // 渲染用戶資料頁面，並傳遞用戶資料和事件 ID
};
// exports.attendeeProfilePage = (req, res) => {
//     const { eventId, attendeeId } = req.params; // 獲取事件 ID 和參展商 ID
//     res.render('attendee_profile', { eventId, attendeeId }); // 渲染參展商個人資料頁面
// };

exports.addPoints = async (req, res) => {
    const { eventId, attendeeId } = req.params; // 獲取事件 ID 和參展商 ID
    const { userId, points } = req.body; // 獲取用戶 ID 和分數

    try {
        const event = await Event.findById(eventId); // 查找事件
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        // 查找用戶
        const user = event.users.find(user => user._id.toString() === userId);
        if (!user) {
            return res.status(404).json({ message: '找不到該用戶' });
        }

        // 查找參展商
        const attendee = event.attendees.find(attendee => attendee._id.toString() === attendeeId);
        if (!attendee) {
            return res.status(404).json({ message: '找不到該參展商' });
        }

        // 更新分數
        if (!user.points) {
            user.points = []; // 如果沒有分數數組，則初始化
        }
        user.points.push({ attendee_id: attendeeId, point: points }); // 添加分數

        await event.save(); // 保存事件

        res.status(200).json({ message: '分數已成功添加' });
    } catch (error) {
        console.error('Error adding points:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

exports.getLeaderboard = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID

    try {
        const event = await Event.findById(eventId).populate('users'); // 查找事件並填充用戶信息
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        // 計算每個用戶的總分數
        const usersWithPoints = event.users.map(user => {
            const totalPoints = user.points.reduce((acc, point) => acc + point.point, 0); // 計算總分數
            return {
                name: user.name,
                totalPoints: totalPoints
            };
        });

        // 按分數排序
        usersWithPoints.sort((a, b) => b.totalPoints - a.totalPoints);

        res.render('events/leaderboard', {event, users: usersWithPoints }); // 渲染排行榜頁面
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};