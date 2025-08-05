const socketIo = require('socket.io');

let io; // 定義 io 變量

const initSocket = (server) => {
    io = socketIo(server); // 初始化 socket.io
    
    io.on('connection', (socket) => {
        console.log('A user connected');
        
        // 處理投票提交事件
        socket.on('vote_submitted', (data) => {
            console.log('Vote submitted:', data);
            // 廣播投票更新給所有連接的客戶端
            socket.broadcast.emit('vote_update', data);
        });
        
        socket.on('disconnect', () => {
            console.log('A user disconnected');
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