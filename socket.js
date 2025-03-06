const socketIo = require('socket.io');

let io; // 定義 io 變量

const initSocket = (server) => {
    io = socketIo(server); // 初始化 socket.io
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