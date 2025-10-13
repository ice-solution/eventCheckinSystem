const Event = require('../model/Event'); // 引入 Event 模型
const Auth = require('../model/Auth'); // 引入 Auth 模型
const sendWhatsAppMessage = require('./components/sendWhatsAppMessage'); // 使用相對路徑
const sendWelcomeEmail = require('./components/sendWelcomeEmail'); // 引入發送郵件的函數
const mongoose = require('mongoose');
const QRCode = require('qrcode'); // 引入 QRCode 庫
const nodemailer = require('nodemailer');
const sendGrid = require("../utils/sendGrid");
const ses = require("../utils/ses");
const path = require('path');
const User = require('../model/User'); // 假設您有一個 User 模型
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../model/Transaction');
const ExcelJS = require('exceljs');
const { getWelcomeEmailTemplate } = require('../template/welcomeEmail'); // 引入歡迎郵件模板
const emailTemplate = require('./emailTemplateController');
const EmailTemplate = require('../model/EmailTemplate'); // 引入 EmailTemplate 模型
const multer = require('multer');
const fs = require('fs');

// 創建事件
exports.createEvent = async (req, res) => {
    const { name, from, to } = req.body;

    try {
        // 檢查是否有用戶數據
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.status(401).json({ message: '未授權：請先登入' });
        }

        const newEvent = new Event({
            name,
            from,
            to,
            owner: req.session.user._id, // 使用 session 中的用戶 ID 作為擁有者
            created_at: Date.now(), // 設置創建時間
            modified_at: Date.now(), // 設置修改時間
            
        });

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
        // 檢查是否有用戶數據
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.status(401).json({ message: '未授權：請先登入' });
        }
        
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
        res.render('admin/users', { event }); // 渲染用戶頁面，傳遞事件信息
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Error fetching event' });
    }
};

exports.fetchUsersByEvent = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId); // 獲取事件數據
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        console.log('Fetched event users:', event.users); // Debug log
        res.json(event.users);
    } catch (error) {
        console.error('Error fetching users by event:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};


// 向事件中添加用戶
exports.addUserToEvent = async (req, res) => {
    const { eventId } = req.params; // 獲取事件 ID
    const { email, name, company, table, phone, role, saluation, industry, transport, meal, remarks, isCheckIn } = req.body; // 獲取用戶資料

    try {
        const event = await Event.findById(eventId); // 查找事件
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        // 創建新的用戶
        const newUser = {
            email,
            name,
            table,
            company,
            phone,
            role, // 添加角色
            saluation, // 添加稱謂
            industry, // 添加行業
            transport, // 添加交通方式
            meal, // 添加餐飲選擇
            remarks, // 添加備註
            isCheckIn // 默認為未登記進場
        };

        // 將用戶添加到事件中
        event.users.push(newUser); // 將用戶添加到事件中
        await event.save(); // 保存事件

        // 獲取新用戶的 _id
        const savedUser = event.users[event.users.length - 1]; // 獲取剛剛添加的用戶
        newUser._id = savedUser._id; // 將 _id 添加到 newUser 對象中

        // 發送郵件
        if(newUser.role !== 'guest'){
            await this.sendEmail(newUser, event); // 傳遞 newUser（現在包含 _id）和事件
        }
        res.status(201).json({ attendee: newUser }); // 返回新用戶資料
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};

exports.sendEmail = async (user, event) => {
    try {
        // 生成 QR 碼
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=250x250`;
        
        // 查找對應事件的歡迎郵件模板
        let emailTemplate = await EmailTemplate.findOne({ 
            eventId: event._id, 
            type: 'welcome' 
        });
        
        // 如果沒有找到模板，使用默認的歡迎郵件模板
        if (!emailTemplate) {
            emailTemplate = await EmailTemplate.findOne({ 
                eventId: null, 
                type: 'welcome' 
            });
        }
        
        let subject = '歡迎加入我們的活動';
        let messageBody = getWelcomeEmailTemplate(user, event, qrCodeUrl); // 使用默認模板
        
        // 如果找到了郵件模板，使用模板的內容
        if (emailTemplate) {
            subject = emailTemplate.subject;
            messageBody = emailTemplate.content
                .replace(/\{\{user\.name\}\}/g, user.name)
                .replace(/\{\{user\.email\}\}/g, user.email)
                .replace(/\{\{user\.company\}\}/g, user.company || '')
                .replace(/\{\{event\.name\}\}/g, event.name)
                .replace(/\{\{qrCodeUrl\}\}/g, qrCodeUrl);
        }
        
        // 發送郵件
        ses.sendEmail(user.email, subject, messageBody);
        
    } catch (error) {
        console.error('Error sending welcome email:', error);
        // 如果出現錯誤，使用默認的歡迎郵件
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=250x250`;
        const messageBody = getWelcomeEmailTemplate(user, event, qrCodeUrl);
        ses.sendEmail(user.email, '歡迎加入我們的活動', messageBody);
    }
}
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
    const { eventId, userId } = req.params; // 從請求參數中獲取事件 ID 和用戶 ID

    try {
        const event = await Event.findById(eventId); // 根據事件 ID 查詢事件
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // 查找用戶的索引
        const userIndex = event.users.findIndex(user => user._id.toString() === userId);
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
        // 檢查是否有用戶數據
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.redirect('/login');
        }
        
        res.render('admin/create_event'); // 渲染事件列表視圖
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
};
// 獲取當前用戶的事件並渲染事件列表視圖
exports.renderEventsList = async (req, res) => {
    try {
        // 檢查是否有用戶數據
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.redirect('/login');
        }
        
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
        if (!user.isCheckIn && req.body.isCheckIn === true) {
            user.isCheckIn = true;
            user.checkInAt = new Date();
            console.log('User check-in updated:', user.name, 'isCheckIn:', user.isCheckIn); // Debug log
        } else if (req.body.isCheckIn === false) {
            user.isCheckIn = false;
            user.checkInAt = undefined;
        }
        await event.save(); // 保存事件以更新用戶資料

        res.status(200).json(user); // 返回更新後的用戶資料
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('伺服器錯誤'); // 返回伺服器錯誤
    }
};
exports.updateUser = async (req, res) => {
    const { eventId, userId } = req.params; // 從請求參數中獲取事件 ID 和用戶的 _id
    const { 
        name, 
        email,
        phone_code, 
        phone, 
        company, 
        table,
        role,
        saluation,
        industry,
        transport,
        meal,
        remarks,
        isCheckIn 
    } = req.body; // 從請求中獲取更新的用戶信息

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
        if (typeof isCheckIn !== 'undefined') {
            if (!user.isCheckIn && isCheckIn === true) {
                user.isCheckIn = true;
                user.checkInAt = new Date();
            } else if (isCheckIn === false) {
                user.isCheckIn = false;
                user.checkInAt = undefined;
            }
        }
        
        // 更新所有欄位
        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (phone_code !== undefined) user.phone_code = phone_code;
        if (phone !== undefined) user.phone = phone;
        if (company !== undefined) user.company = company;
        if (table !== undefined) user.table = table;
        if (role !== undefined) user.role = role;
        if (saluation !== undefined) user.saluation = saluation;
        if (industry !== undefined) user.industry = industry;
        if (transport !== undefined) user.transport = transport;
        if (meal !== undefined) user.meal = meal;
        if (remarks !== undefined) user.remarks = remarks;
        
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
    const { name, location, phone, email, promo_codes, description } = req.body;

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: '找不到該事件' });
        }

        const newAttendee = { name, location, phone, email, promo_codes,description };
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

// 創建新的 points
exports.createPoint = async (req, res) => {
    const { eventId } = req.params;
    const { point } = req.body;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        const newPoint = { point };
        event.points.push(newPoint);
        await event.save();
        res.status(201).json(newPoint);
    } catch (error) {
        console.error('Error creating point:', error);
        res.status(500).send('Error creating point.');
    }
};

// 獲取所有 points
exports.getPoints = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }
        res.status(200).json(event.points);
    } catch (error) {
        console.error('Error fetching points:', error);
        res.status(500).send('Error fetching points.');
    }
};

// 獲取單個 point
exports.getPointById = async (req, res) => {
    const { eventId, pointId } = req.params;
    console.log('hihi');
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        const point = event.points.id(pointId);
        if (!point) {
            return res.status(404).send('Point not found.');
        }
        res.status(200).json(point);
    } catch (error) {
        console.error('Error fetching point:', error);
        res.status(500).send('Error fetching point.');
    }
};

// 更新 point
exports.updatePoint = async (req, res) => {
    const { eventId, pointId } = req.params;
    const { point } = req.body;

    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        const pointToUpdate = event.points.id(pointId);
        if (!pointToUpdate) {
            return res.status(404).send('Point not found.');
        }

        pointToUpdate.point = point;
        await event.save();
        res.status(200).json(pointToUpdate);
    } catch (error) {
        console.error('Error updating point:', error);
        res.status(500).send('Error updating point.');
    }
};

// 刪除中獎者
exports.removeLuckydrawUser = async (req, res) => {
    const { _id } = req.body; // 獲取要刪除的中獎者 ID
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        // 使用 mongoose.Types.ObjectId 進行比較
        const winnerIndex = event.winners.findIndex(winner => 
            winner._id.equals(new mongoose.Types.ObjectId(_id)) // 使用 new 來實例化 ObjectId
        );

        if (winnerIndex === -1) {
            return res.status(404).send('Winner not found.');
        }

        // 獲取要刪除的中獎者信息
        const winnerToDelete = event.winners[winnerIndex];
        
        // 如果中獎者有指定獎品，需要還原獎品數量
        if (winnerToDelete.prizeId) {
            const Prize = require('../model/Prize');
            const prize = await Prize.findById(winnerToDelete.prizeId);
            if (prize) {
                prize.unit += 1; // 還原獎品數量
                await prize.save();
                console.log(`已還原獎品 ${prize.name} 的數量，當前數量: ${prize.unit}`);
            }
        }

        // 刪除中獎者
        event.winners.splice(winnerIndex, 1);
        await event.save(); // 保存更改

        res.status(200).send({ message: 'Winner deleted successfully.' });
    } catch (error) {
        console.error('Error deleting winner:', error);
        res.status(500).send('Error deleting winner.');
    }
};

// 新增中獎者
exports.addLuckydrawUser = async (req, res) => {
    const { _id, name, company, table, prizeId } = req.body; // 獲取中獎者資料和獎品ID
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        // 檢查是否選擇了獎品
        if (!prizeId) {
            return res.status(400).send('Please select a prize.');
        }

        // 檢查中獎者是否已經存在
        const alreadyWinner = event.winners.some(existingWinner => existingWinner._id.equals(_id));
        if (alreadyWinner) {
            return res.status(400).send('This user has already won.');
        }

        // 檢查獎品是否存在並更新數量
        const Prize = require('../model/Prize');
        const prize = await Prize.findById(prizeId);
        if (!prize) {
            return res.status(404).send('Prize not found.');
        }
        
        if (prize.unit <= 0) {
            return res.status(400).send('Prize is out of stock.');
        }

        prize.unit -= 1;
        const prizeName = prize.name;
        await prize.save();

        // 創建 winner 對象，包含獎品信息
        const winner = { 
            _id, 
            name, 
            company, 
            table,
            prizeId, 
            prizeName,
            wonAt: new Date()
        };

        // 將中獎者存儲在 event 的 winners 陣列中
        event.winners.push(winner);
        await event.save(); // 保存更改

        res.status(201).send({ message: 'Winner added successfully.', winner });
    } catch (error) {
        console.error('Error adding winner:', error);
        res.status(500).send('Error adding winner.');
    }
};

// 渲染抽獎頁面
exports.renderLuckydrawPage = async (req, res) => {
    const { eventId } = req.params; // 獲取 eventId
    try {
        const event = await Event.findById(eventId).populate('users'); // 獲取事件並填充用戶和中獎者
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        // 獲取獎品列表
        const Prize = require('../model/Prize');
        const prizes = await Prize.find({ eventId });

        // 日誌輸出 winners 陣列
        console.log('Winners:', event.winners);

        // 獲取所有已經簽到且未中獎的用戶
        const availablePeople = event.users.filter(user => 
            user.isCheckIn === true && !event.winners.some(winner => winner._id && winner._id.equals(user._id)) // 確保 winner._id 存在
        );

        res.render('events/luckydraw', { eventId, availablePeople, prizes }); // 傳遞可用的參與者和獎品列表
    } catch (error) {
        console.error('Error rendering luckydraw page:', error);
        res.status(500).send('Error rendering luckydraw page.');
    }
};

// 渲染管理中獎者頁面
exports.renderAdminLuckydrawPage = async (req, res) => {
    const { eventId } = req.params; // 獲取 eventId
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        // 獲取中獎者列表，並添加次序
        const winners = event.winners.map((winner, index) => ({
            order: index + 1, // 次序從 1 開始
            _id: winner._id,
            name: winner.name,
            company: winner.company,
            table: winner.table,
            prizeName: winner.prizeName,
            wonAt: winner.wonAt
        }));

        // 添加調試日誌
        console.log('Winners data:', winners);

        // 渲染 admin/luckydraw.ejs 頁面，並傳遞中獎者
        res.render('admin/luckydraw', { winners, eventId });
    } catch (error) {
        console.error('Error rendering admin luckydraw page:', error);
        res.status(500).send('Error rendering admin luckydraw page.');
    }
};

// 渲染 QR 碼登錄頁面
exports.renderQRCodeLoginPage = async (req, res) => {
    const { eventId } = req.params; // 獲取 eventId
    try {
        // 生成 QR 碼的數據，這裡直接使用 eventId
        const qrCodeData = eventId;

        // 生成 QR 碼圖像
        const qrCodeImage = await QRCode.toDataURL(qrCodeData);

        // 渲染 qrcodeLogin.ejs 頁面，並傳遞 QR 碼圖像
        res.render('admin/qrcodeLogin', { qrCodeImage, eventId });
    } catch (error) {
        console.error('Error rendering QR code login page:', error);
        res.status(500).send('Error rendering QR code login page.');
    }
};
exports.renderLuckydrawSetting = (req, res) => {
    const eventId = req.params.eventId;
    res.render('admin/luckydraw_setting', { eventId }); // 渲染 luckydraw_setting.ejs
};
// 上傳背景圖片的控制器函數
exports.uploadBackground = (req, res) => {
    if (!req.file) {
        req.flash('error_msg', '沒有上傳文件或文件格式不正確');
        return res.redirect(`/events/${req.params.eventId}/luckydraw_setting`); // 返回到 luckydraw_setting 頁面
    }
    // 獲取上傳的文件路徑
    const filePath = path.join('/luckydraw/img/', req.file.filename);

    // 這裡可以將 filePath 存入數據庫或進行其他處理
    console.log('上傳的背景圖片路徑:', filePath);

    // 設置成功消息
    req.flash('success_msg', '圖片上傳成功！');
    res.redirect(`/events/${req.params.eventId}/luckydraw_setting`); // 返回到 luckydraw_setting 頁面
};

// 渲染 email_html.ejs 的控制器
exports.renderEmailHtml = async (req, res) => {
    const { eventId, userId } = req.params; // 獲取 eventId 和 userId
    
    try {
        // 查詢事件和用戶信息
        const event = await Event.findById(eventId); // 根據 eventId 查詢事件
        // const user = await User.findById(userId); // 根據 userId 查詢用戶

        if (!event) {
            return res.status(404).send('事件或用戶未找到'); // 如果事件或用戶不存在，返回 404 錯誤
        }

        // 渲染 email_html.ejs，並傳遞事件和用戶信息
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${userId}&size=250x250`; // 替換為您的 QR 碼內容
        res.render('email_html', { eventId, userId, qrCodeUrl });
    } catch (error) {
        console.error('Error fetching event or user:', error);
        res.status(500).send('伺服器錯誤'); // 返回伺服器錯誤
    }
};

// 更新付費活動設定
exports.updatePaymentEvent = async (req, res) => {
    const { eventId } = req.params;
    const { isPaymentEvent, PaymentTickets } = req.body;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (typeof isPaymentEvent !== 'undefined') event.isPaymentEvent = isPaymentEvent;
        if (Array.isArray(PaymentTickets)) event.PaymentTickets = PaymentTickets;
        await event.save();
        res.status(200).json({ message: 'Payment event updated', event });
    } catch (error) {
        console.error('Error updating payment event:', error);
        res.status(500).json({ message: 'Error updating payment event' });
    }
};

// Stripe Checkout
exports.stripeCheckout = async (req, res) => {
    const { event_id } = req.params;
    const { ticketId, email, name, company, phone_code, phone } = req.body;
    try {
        const event = await Event.findById(event_id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const ticket = event.PaymentTickets.id(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        // Ensure DOMAIN has proper scheme
        const domain = process.env.DOMAIN || `${req.protocol}://${req.get('host')}`;
        const baseUrl = domain.startsWith('http://') || domain.startsWith('https://') 
            ? domain 
            : `https://${domain}`;
        
        // Stripe session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email,
            line_items: [
                {
                    price_data: {
                        currency: 'hkd',
                        product_data: {
                            name: ticket.title,
                        },
                        unit_amount: ticket.price * 100,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${baseUrl}/web/${event_id}/register/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/web/${event_id}/register/fail?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                event_id,
                ticketId,
                name,
                company,
                phone_code,
                phone
            }
        });
        // 新增 Transaction
        await Transaction.create({
            eventId: event_id,
            userEmail: email,
            userName: name,
            ticketId: ticket._id,
            ticketTitle: ticket.title,
            ticketPrice: ticket.price,
            stripeSessionId: session.id,
            status: 'pending'
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ message: 'Stripe error' });
    }
};

// Stripe Webhook
exports.stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    console.log('Webhook received:', {
        type: req.body?.type,
        timestamp: new Date().toISOString()
    });
    
    let event;
    
    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log('Webhook verified successfully:', event.type);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    try {
        // Handle checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('Processing checkout.session.completed:', session.id);
            
            // Find and update transaction status
            const transaction = await Transaction.findOneAndUpdate(
                { stripeSessionId: session.id },
                { 
                    status: 'paid',
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!transaction) {
                console.error('Transaction not found for session:', session.id);
                return res.json({ received: true, warning: 'Transaction not found' });
            }
            
            console.log('Transaction updated:', transaction._id);
            
            // Find the event
            const eventDoc = await Event.findById(transaction.eventId);
            if (!eventDoc) {
                console.error('Event not found:', transaction.eventId);
                return res.json({ received: true, warning: 'Event not found' });
            }
            
            // Check if user already exists in event.users
            const existingUser = eventDoc.users.find(u => u.email === transaction.userEmail);
            if (existingUser) {
                console.log('User already exists, updating payment status:', transaction.userEmail);
                existingUser.paymentStatus = 'paid';
                existingUser.modified_at = new Date();
            } else {
                console.log('Adding new user to event:', transaction.userEmail);
                // Add user to event.users with all metadata
                eventDoc.users.push({
                    email: transaction.userEmail,
                    name: transaction.userName || session.metadata.name,
                    company: session.metadata.company || '',
                    phone_code: session.metadata.phone_code || '',
                    phone: session.metadata.phone || '',
                    paymentStatus: 'paid',
                    isCheckIn: false,
                    role: 'guests',
                    create_at: new Date(),
                    modified_at: new Date()
                });
            }
            
            await eventDoc.save();
            console.log('Event updated successfully:', eventDoc._id);
            
            // Optional: Send confirmation email here
            // await sendPaymentConfirmationEmail(transaction.userEmail, transaction);
            
        } 
        // Handle checkout.session.expired event
        else if (event.type === 'checkout.session.expired') {
            const session = event.data.object;
            console.log('Processing checkout.session.expired:', session.id);
            
            await Transaction.findOneAndUpdate(
                { stripeSessionId: session.id },
                { 
                    status: 'failed',
                    updatedAt: new Date()
                }
            );
            console.log('Transaction marked as failed (expired):', session.id);
        }
        // Handle payment_intent.payment_failed event
        else if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object;
            console.log('Processing payment_intent.payment_failed:', paymentIntent.id);
            
            // Find transaction by payment intent if needed
            // This depends on how you store payment intent ID
        }
        // Log unhandled event types
        else {
            console.log('Unhandled event type:', event.type);
        }
        
        res.json({ received: true, eventType: event.type });
        
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Still return 200 to acknowledge receipt to Stripe
        res.status(200).json({ received: true, error: error.message });
    }
};

// Render Transaction Records Page
exports.renderTransactionRecords = async (req, res) => {
    const { eventId } = req.params;
    try {
        // Check authentication
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.redirect('/login');
        }

        // Find event
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        // Find all transactions for this event
        const transactions = await Transaction.find({ eventId: eventId })
            .sort({ createdAt: -1 });

        res.render('admin/transaction_records', { 
            event, 
            transactions,
            eventId: eventId 
        });
    } catch (error) {
        console.error('Error fetching transaction records:', error);
        res.status(500).send('Server error');
    }
};

exports.outputReport = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).send('Event not found');
        const users = event.users || [];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');
        worksheet.columns = [
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Table', key: 'table', width: 10 },
            { header: 'Company', key: 'company', width: 20 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Role', key: 'role', width: 10 },
            { header: 'Industry', key: 'industry', width: 15 },
            { header: 'CheckInAt', key: 'checkInAt', width: 15 },
            { header: '已簽到', key: 'isCheckIn', width: 10 }
        ];
        users.forEach(user => {
            worksheet.addRow({
                email: user.email,
                name: user.name,
                table: user.table,
                company: user.company,
                phone: user.phone,
                role: user.role,
                industry: user.industry,
                checkInAt: user.checkInAt ? new Date(user.checkInAt).toLocaleString('zh-TW', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }) : '',
                isCheckIn: user.isCheckIn ? '✓' : ''
            });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=event_users.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export report error:', err);
        res.status(500).send('報表匯出失敗');
    }
};

// Check-in 用戶
exports.checkInUser = async (req, res) => {
    const { eventId, userId } = req.params;
    
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        // 查找用戶
        const user = event.users.find(user => user._id.toString() === userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found in this event' });
        }
        
        // 檢查用戶是否已經 check-in
        if (user.isCheckIn) {
            return res.status(400).json({ message: 'User has already checked in' });
        }
        
        // 更新用戶的 check-in 狀態
        user.isCheckIn = true;
        user.checkInAt = new Date(); // 添加 check-in 時間
        
        await event.save();
        
        res.status(200).json({ 
            message: 'Check-in successful',
            user: {
                name: user.name,
                email: user.email,
                checkInAt: user.checkInAt
            }
        });
        
    } catch (error) {
        console.error('Error checking in user:', error);
        res.status(500).json({ message: 'Error checking in user' });
    }
};

// Batch delete users
exports.batchDeleteUsers = async (req, res) => {
    const { eventId } = req.params;
    const { userIds } = req.body; // 接收用戶ID數組
    
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        // 過濾掉要刪除的用戶
        const originalCount = event.users.length;
        event.users = event.users.filter(user => !userIds.includes(user._id.toString()));
        const deletedCount = originalCount - event.users.length;
        
        await event.save();
        
        res.status(200).json({ 
            message: `Successfully deleted ${deletedCount} users`,
            deletedCount: deletedCount
        });
        
    } catch (error) {
        console.error('Error batch deleting users:', error);
        res.status(500).json({ message: 'Error batch deleting users' });
    }
};

// Banner 管理功能
// 配置 multer 用於文件上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/exvent';
        // 確保目錄存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 使用 eventId 作為文件名
        const eventId = req.params.eventId;
        const ext = path.extname(file.originalname);
        cb(null, eventId + '-temp' + Date.now() + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // 只允許 PNG 和 JPG 文件
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        cb(null, true);
    } else {
        cb(new Error('只允許上傳 PNG 或 JPG 格式的圖片'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制文件大小為 5MB
    }
});

// 顯示 banner 管理頁面
exports.showBannerManagement = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        
        // 檢查當前 banner 是否存在（優先檢查 eventId 的 banner，如果沒有則檢查默認 banner）
        const eventBannerPath = `public/exvent/${eventId}.jpg`;
        const defaultBannerPath = 'public/exvent/banner.jpg';
        
        let currentBanner = null;
        if (fs.existsSync(eventBannerPath)) {
            currentBanner = `/exvent/${eventId}.jpg`;
        } else if (fs.existsSync(defaultBannerPath)) {
            currentBanner = '/exvent/banner.jpg';
        }
        
        res.render('admin/banner_management', { 
            event, 
            currentBanner,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Error showing banner management:', error);
        res.status(500).send('Error loading banner management page');
    }
};

// 上傳新的 banner
exports.uploadBanner = [
    upload.single('banner'),
    async (req, res) => {
        const { eventId } = req.params;
        
        try {
            if (!req.file) {
                return res.redirect(`/events/${eventId}/banner?error=請選擇要上傳的圖片文件`);
            }

            const event = await Event.findById(eventId);
            if (!event) {
                return res.status(404).send('Event not found');
            }

            // 刪除舊的 event banner 文件（如果存在）
            const oldEventBannerPath = `public/exvent/${eventId}.jpg`;
            if (fs.existsSync(oldEventBannerPath)) {
                fs.unlinkSync(oldEventBannerPath);
            }

            // 將新上傳的文件重命名為 eventId.jpg
            const newBannerPath = req.file.path;
            const finalBannerPath = `public/exvent/${eventId}.jpg`;
            fs.renameSync(newBannerPath, finalBannerPath);

            res.redirect(`/events/${eventId}/banner?message=Banner 上傳成功！`);
            
        } catch (error) {
            console.error('Error uploading banner:', error);
            res.redirect(`/events/${eventId}/banner?error=Banner 上傳失敗：${error.message}`);
        }
    }
];

// 刪除當前 banner
exports.deleteBanner = async (req, res) => {
    const { eventId } = req.params;
    
    try {
        const eventBannerPath = `public/exvent/${eventId}.jpg`;
        if (fs.existsSync(eventBannerPath)) {
            fs.unlinkSync(eventBannerPath);
            res.redirect(`/events/${eventId}/banner?message=Banner 已刪除`);
        } else {
            res.redirect(`/events/${eventId}/banner?error=沒有找到此活動的 banner 文件`);
        }
    } catch (error) {
        console.error('Error deleting banner:', error);
        res.redirect(`/events/${eventId}/banner?error=刪除 banner 失敗：${error.message}`);
    }
};