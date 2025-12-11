const socketIo = require('socket.io');

let io; // 定義 io 變量

const initSocket = (server) => {
    io = socketIo(server); // 初始化 socket.io
    
    io.on('connection', (socket) => {
        console.log('A user connected');

        // LuckyDraw: 加入特定 event 的 room，並標記 socket 當前控制的 eventId
        socket.on('join_luckydraw', ({ eventId }) => {
            if (!eventId) return;
            const room = `luckydraw:${eventId}`;
            socket.join(room);
            socket.luckydrawEventId = eventId;
            console.log(`Socket joined room ${room}`);

            // 通知該 room：控制器已連接
            io.to(room).emit('luckydraw:controller_status', {
                eventId,
                status: 'online'
            });
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

            // 如果這個 socket 有加入某個 luckydraw event，通知該 room 控制器離線
            if (socket.luckydrawEventId) {
                const room = `luckydraw:${socket.luckydrawEventId}`;
                io.to(room).emit('luckydraw:controller_status', {
                    eventId: socket.luckydrawEventId,
                    status: 'offline'
                });
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