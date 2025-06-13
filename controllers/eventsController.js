const Event = require('../model/Event'); // 引入 Event 模型
const Auth = require('../model/Auth'); // 引入 Auth 模型
const sendWhatsAppMessage = require('./components/sendWhatsAppMessage'); // 使用相對路徑
const sendWelcomeEmail = require('./components/sendWelcomeEmail'); // 引入發送郵件的函數
const mongoose = require('mongoose');
const QRCode = require('qrcode'); // 引入 QRCode 庫
const nodemailer = require('nodemailer');
const sendGrid = require("../utils/sendGrid");
const path = require('path');
const User = require('../model/User'); // 假設您有一個 User 模型

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
        res.render('admin/users', { event }); // 渲染用戶頁面，傳遞事件信息
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Error fetching event' });
    }
};

exports.fetchUsersByEvent = async (req, res) => {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).populate('users'); // 獲取用戶數據
    res.json(event.users);
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

const transporter = nodemailer.createTransport({
    service: 'Gmail', // 使用 Gmail 作為郵件服務
    auth: {
        user: process.env.gmail_ac, // 替換為您的電子郵件地址
        pass: process.env.gmail_pw // 替換為您的電子郵件密碼或應用程式密碼
    }
});
exports.sendEmail = async (user,event) => {
    // 生成 QR 碼
        //https://api.qrserver.com/v1/create-qr-code/?data=67ae345f10b42c96a3ce3c17&size=250x250
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=250x250`; // 替換為您的 QR 碼內容
        //const qrCodeUrl = await QRCode.toDataURL(`userId=${user._id}`);
        // const qrCodeUrl = process.env.domain+'qrcode?userId='+user._id;
        console.log(qrCodeUrl);
        // 發送歡迎訊息和 QR 碼到電子郵件
        const messageBody = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
      <!--[if !mso]><!-->
      <meta http-equiv="X-UA-Compatible" content="IE=Edge">
      <!--<![endif]-->
      <!--[if (gte mso 9)|(IE)]>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
      <![endif]-->
      <!--[if (gte mso 9)|(IE)]>
  <style type="text/css">
    body {width: 600px;margin: 0 auto;}
    table {border-collapse: collapse;}
    table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}
    img {-ms-interpolation-mode: bicubic;}
  </style>
<![endif]-->
      <style type="text/css">
    body, p, div {
      font-family: arial,helvetica,sans-serif;
      font-size: 14px;
    }
    body {
      color: #000;
    }
    body a {
      color: blue;
      text-decoration: none;
    }
    p { margin: 0; padding: 0; }
    table.wrapper {
      width:100% !important;
      table-layout: fixed;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
      -moz-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    img.max-width {
      max-width: 100% !important;
    }
    .column.of-2 {
      width: 50%;
    }
    .column.of-3 {
      width: 33.333%;
    }
    .column.of-4 {
      width: 25%;
    }
    ul ul ul ul  {
      list-style-type: disc !important;
    }
    ol ol {
      list-style-type: lower-roman !important;
    }
    ol ol ol {
      list-style-type: lower-latin !important;
    }
    ol ol ol ol {
      list-style-type: decimal !important;
    }
    @media screen and (max-width:480px) {
      .preheader .rightColumnContent,
      .footer .rightColumnContent {
        text-align: left !important;
      }
      .preheader .rightColumnContent div,
      .preheader .rightColumnContent span,
      .footer .rightColumnContent div,
      .footer .rightColumnContent span {
        text-align: left !important;
      }
      .preheader .rightColumnContent,
      .preheader .leftColumnContent {
        font-size: 80% !important;
        padding: 5px 0;
      }
      table.wrapper-mobile {
        width: 100% !important;
        table-layout: fixed;
      }
      img.max-width {
        height: auto !important;
        max-width: 100% !important;
      }
      a.bulletproof-button {
        display: block !important;
        width: auto !important;
        font-size: 80%;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .columns {
        width: 100% !important;
      }
      .column {
        display: block !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      .social-icon-column {
        display: inline-block !important;
      }
    }
  </style>
      <!--user entered Head Start-->

     <!--End Head user entered-->
    </head>
    <body>
      <center class="wrapper" data-link-color="#42ee99" data-body-style="font-size:14px; font-family:arial,helvetica,sans-serif; color:#002e5d; background-color:#FFF;">
        <div class="webkit">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FFF">
            <tr>
              <td valign="top" bgcolor="#FFF" width="100%">
                <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="100%">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td>
    <center>
    <table style="width:680px;font-family:'DengXian',sans-serif" width="680">
            <tbody>
                <tr>
                    <td style="width:680px;font-size:15px;font-family:'DengXian',sans-serif;text-align:left" width="680">
                        <center>
                            If you cannot read the following message, please click <a href="https://activefathering.brandactivation.hk/events/${event._id}/email/${user._id}" target="_blank" data-saferedirecturl="#">here</a>.
                        </center>
                        <br>
                        <img alt="banner" src="https://activefathering.brandactivation.hk/exvent/email_banner.jpg" style="width:680px" width="680" class="CToWUd a6T" data-bit="iit" tabindex="0"><div class="a6S" dir="ltr" style="opacity: 0.01; left: 884.5px; top: 568.5px;"><span data-is-tooltip-wrapper="true" class="a5q" jsaction="JIbuQc:.CLIENT"><button class="VYBDae-JX-I VYBDae-JX-I-ql-ay5-ays CgzRE" jscontroller="PIVayb" jsaction="click:h5M12e; clickmod:h5M12e;pointerdown:FEiYhc;pointerup:mF5Elf;pointerenter:EX0mI;pointerleave:vpvbp;pointercancel:xyn4sd;contextmenu:xexox;focus:h06R8; blur:zjh6rb;mlnRJb:fLiPzd;" data-idom-class="CgzRE" data-use-native-focus-logic="true" jsname="hRZeKc" aria-label="Download attachment " data-tooltip-enabled="true" data-tooltip-id="tt-c15" data-tooltip-classes="AZPksf" id="" jslog="91252; u014N:cOuCgd,Kr2w4b,xr6bB; 4:WyIjbXNnLWY6MTgzMjgyOTEyNjYyNjM0NDQ3MiJd; 43:WyJpbWFnZS9qcGVnIl0."><span class="OiePBf-zPjgPe VYBDae-JX-UHGRz"></span><span class="bHC-Q" jscontroller="LBaJxb" jsname="m9ZlFb" soy-skip="" ssk="6:RWVI5c"></span><span class="VYBDae-JX-ank-Rtc0Jf" jsname="S5tZuc" aria-hidden="true"><span class="notranslate bzc-ank" aria-hidden="true"><svg viewBox="0 -960 960 960" height="20" width="20" focusable="false" class=" aoH"><path d="M480-336L288-528l51-51L444-474V-816h72v342L621-579l51,51L480-336ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72H696v-72h72v72q0,29.7-21.16,50.85T695.96-192H263.72Z"></path></svg></span></span><div class="VYBDae-JX-ano"></div></button><div class="ne2Ple-oshW8e-J9" id="tt-c15" role="tooltip" aria-hidden="true">Download</div></span></div>  
                    </td>
                </tr>
                <tr>
                    <td style="font-size:15px;line-height:25px;font-family:'DengXian',sans-serif">
                        Dear ${user.name}
                        <br>
                        <br>
                    </td>
                </tr> 
                <tr>
                    <td style="font-size:15px;line-height:24px;vertical-align:top;font-family:'DengXian',sans-serif">
                    Thank you for joining us at "${event.name}" on 7th June (Saturday), 14:30-16:00 at WeWork Lee Garden One, 46/F, Causeway Bay! Your presence made our decade-long journey of supporting fathers even more meaningful.
                    <br>
                    <br>
                    We hope you enjoyed:
                    <br>
                    <br>
                    Refreshments & meaningful conversations over coffee/tea
                    <br>
                    <br>
                    Interactive game booths for parents & children
                    <br>
                    <br>
                    nsights from our latest Fatherhood Mental Health Survey
                    <br>
                    <br>
                    Your enthusiasm during the event reaffirms our mission - to champion every father's role in building stronger families. Let's continue this important work together!
                    <br>
                    <br>
                    <center><img height="200" src="${qrCodeUrl}" style="width:200px;height:200px" width="200" class="CToWUd a6T" data-bit="iit" tabindex="0"><div class="a6S" dir="ltr" style="opacity: 0.01; left: 644.469px; top: 1572.08px;"><span data-is-tooltip-wrapper="true" class="a5q" jsaction="JIbuQc:.CLIENT"><button class="VYBDae-JX-I VYBDae-JX-I-ql-ay5-ays CgzRE" jscontroller="PIVayb" jsaction="click:h5M12e; clickmod:h5M12e;pointerdown:FEiYhc;pointerup:mF5Elf;pointerenter:EX0mI;pointerleave:vpvbp;pointercancel:xyn4sd;contextmenu:xexox;focus:h06R8; blur:zjh6rb;mlnRJb:fLiPzd;" data-idom-class="CgzRE" data-use-native-focus-logic="true" jsname="hRZeKc" aria-label="Download attachment " data-tooltip-enabled="true" data-tooltip-id="tt-c14" data-tooltip-classes="AZPksf" id="" jslog="91252; u014N:cOuCgd,Kr2w4b,xr6bB; 4:WyIjbXNnLWY6MTgzMjgyOTEyNjYyNjM0NDQ3MiJd; 43:WyJpbWFnZS9qcGVnIl0."><span class="OiePBf-zPjgPe VYBDae-JX-UHGRz"></span><span class="bHC-Q" jscontroller="LBaJxb" jsname="m9ZlFb" soy-skip="" ssk="6:RWVI5c"></span><span class="VYBDae-JX-ank-Rtc0Jf" jsname="S5tZuc" aria-hidden="true"><span class="notranslate bzc-ank" aria-hidden="true"><svg viewBox="0 -960 960 960" height="20" width="20" focusable="false" class=" aoH"><path d="M480-336L288-528l51-51L444-474V-816h72v342L621-579l51,51L480-336ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72H696v-72h72v72q0,29.7-21.16,50.85T695.96-192H263.72Z"></path></svg></span></span><div class="VYBDae-JX-ano"></div></button><div class="ne2Ple-oshW8e-J9" id="tt-c14" role="tooltip" aria-hidden="true">Download</div></span></div></center>
                    <br>
                    <br>
                    With gratitude,
                    <br>
                    The DADs Network Team
                    </td>
                </tr> 
            </tbody>
        </table>
        </div>
      </center>
    </body>
  </html>`;
        /* update at 05282025, use sendgrid */ 
        // const mailOptions = {
        //     from: 'icesolution0321@gmail.com', // 替換為您的電子郵件地址
        //     to: user.email, // 確保用戶的電子郵件地址是有效的
        //     subject: '歡迎加入我們的活動',
        //     html: messageBody
        // };

        // await transporter.sendMail(mailOptions);
        sendGrid.sendEmail(user.email, '歡迎加入我們的活動', messageBody);

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
    const { name, phone_code, phone, company, isCheckIn } = req.body; // 從請求中獲取更新的用戶信息

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
        // user.email = email || user.email;
        // user.point = point || user.point;
        // user._id = _id || user._id;
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
    const { _id, name, company } = req.body; // 獲取中獎者資料
    const winner = { _id, name, company }; // 創建 winner 對象
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }

        // 檢查中獎者是否已經存在
        const alreadyWinner = event.winners.some(existingWinner => existingWinner._id.equals(_id));
        if (alreadyWinner) {
            return res.status(400).send('This user has already won.');
        }

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

        // 日誌輸出 winners 陣列
        console.log('Winners:', event.winners);

        // 獲取所有已經簽到且未中獎的用戶
        const availablePeople = event.users.filter(user => 
            user.isCheckIn === true && !event.winners.some(winner => winner._id && winner._id.equals(user._id)) // 確保 winner._id 存在
        );

        res.render('events/luckydraw', { eventId, availablePeople }); // 傳遞可用的參與者
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
            company: winner.company
        }));

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