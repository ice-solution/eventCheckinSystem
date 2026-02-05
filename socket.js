const socketIo = require('socket.io');

let io; // 定義 io 變量

const initSocket = (server) => {
    // 與 app.js 一致：CORS_ENABLED=true 時才允許跨域（localhost/其他 domain 連線）
    const corsEnabled = (process.env.CORS_ENABLED || '').toString().trim().toLowerCase() === 'true' || process.env.CORS_ENABLED === '1';
    const corsOrigin = (process.env.CORS_ORIGIN || '').trim();
    const allowedOrigins = corsOrigin ? corsOrigin.split(',').map(s => s.trim()).filter(Boolean) : [];
    let socketCors;
    if (!corsEnabled) {
        socketCors = false; // 只允許同源
    } else if (allowedOrigins.length > 0) {
        socketCors = { origin: allowedOrigins, credentials: true };
    } else {
        // 允許所有 origin：用函數明確回傳 true，確保 localhost:5175 等都會過
        socketCors = {
            origin: (origin, callback) => callback(null, true),
            credentials: true
        };
    }
    io = socketIo(server, { cors: socketCors });
    
    // 追蹤每個 room 中是否有 panel 連接
    const roomPanels = new Map(); // Map<room, Set<socketId>>

    io.on('connection', (socket) => {
        console.log('A user connected');

        // LuckyDraw: 加入特定 event 的 room，並標記 socket 當前控制的 eventId
        socket.on('join_luckydraw', ({ eventId, type }) => {
            if (!eventId) return;
            const room = `luckydraw:${eventId}`;
            socket.join(room);
            socket.luckydrawEventId = eventId;
            socket.luckydrawType = type || 'display'; // 默認為 display
            
            console.log(`Socket joined room ${room} as type: ${socket.luckydrawType}`);

            // 如果是 panel，記錄到 roomPanels
            if (type === 'panel') {
                if (!roomPanels.has(room)) {
                    roomPanels.set(room, new Set());
                }
                roomPanels.get(room).add(socket.id);
                
                // 通知該 room：控制器已連接
                io.to(room).emit('luckydraw:controller_status', {
                    eventId,
                    status: 'online'
                });
            } else {
                // 如果是 display page，檢查是否有 panel 連接
                const hasPanel = roomPanels.has(room) && roomPanels.get(room).size > 0;
                socket.emit('luckydraw:controller_status', {
                    eventId,
                    status: hasPanel ? 'online' : 'offline'
                });
            }
        });

        // LuckyDraw: 從控制面板發出「開始抽獎動畫」指令
        socket.on('luckydraw_panel_start', ({ eventId }) => {
            if (!eventId) return;
            const room = `luckydraw:${eventId}`;
            socket.to(room).emit('luckydraw:start');
        });

        // LuckyDraw: 從用戶顯示頁面點擊開始按鈕
        socket.on('luckydraw:user_start_click', ({ eventId }) => {
            if (!eventId) return;
            const room = `luckydraw:${eventId}`;
            // 通知控制面板用戶已經開始（可以用於自動開始或其他邏輯）
            io.to(room).emit('luckydraw:user_started', { eventId });
        });

        // LuckyDraw: 從控制面板發出「獎品選擇」通知
        socket.on('luckydraw_panel_prize_selected', ({ eventId, prizeName }) => {
            if (!eventId) return;
            const room = `luckydraw:${eventId}`;
            io.to(room).emit('luckydraw:prize_selected', { prizeName });
        });

        // 處理投票提交事件
        socket.on('vote_submitted', (data) => {
            console.log('Vote submitted:', data);
            // 廣播投票更新給所有連接的客戶端
            socket.broadcast.emit('vote_update', data);
        });
        
        socket.on('disconnect', () => {
            console.log('A user disconnected');

            // 如果這個 socket 有加入某個 luckydraw event
            if (socket.luckydrawEventId) {
                const room = `luckydraw:${socket.luckydrawEventId}`;
                
                // 如果是 panel，從 roomPanels 中移除
                if (socket.luckydrawType === 'panel' && roomPanels.has(room)) {
                    roomPanels.get(room).delete(socket.id);
                    
                    // 如果沒有 panel 了，清理該 room 的記錄
                    if (roomPanels.get(room).size === 0) {
                        roomPanels.delete(room);
                    }
                    
                    // 通知該 room：控制器已離線
                    io.to(room).emit('luckydraw:controller_status', {
                        eventId: socket.luckydrawEventId,
                        status: 'offline'
                    });
                }
            }
        });
    });
    
    return io; // 返回 io 實例
};

const getSocket = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!'); // 如果未初始化，拋出錯誤
    }
    return io; // 返回 io 實例
};

module.exports = {
    initSocket,
    getSocket
};