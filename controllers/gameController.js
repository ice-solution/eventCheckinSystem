const Event = require('../model/Event');
const GameHistory = require('../model/GameHistory');

// 開始遊戲 - 檢查用戶是否存在並返回遊戲記錄
exports.startGame = async (req, res) => {
    try {
        const { gameId } = req.params;
        const { user: eventUserId } = req.body;

        if (!eventUserId) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少用戶ID' 
            });
        }

        // 查找所有事件，檢查用戶是否存在且該事件的gameIds包含此gameId
        const events = await Event.find({});
        let foundUser = null;
        let foundEvent = null;

        for (const event of events) {
            // 檢查該事件是否包含此gameId
            if (event.gameIds && event.gameIds.includes(gameId)) {
                const user = event.users.id(eventUserId);
                if (user) {
                    foundUser = user;
                    foundEvent = event;
                    break;
                }
            }
        }

        // 如果找不到用戶或事件，返回詳細錯誤信息
        if (!foundUser || !foundEvent) {
            // 先檢查用戶是否存在於任何事件中
            let userExists = false;
            let gameIdExists = false;
            
            for (const event of events) {
                if (event.users.id(eventUserId)) {
                    userExists = true;
                }
                if (event.gameIds && event.gameIds.includes(gameId)) {
                    gameIdExists = true;
                }
            }

            let errorMessage = '不能開啟遊戲原因：';
            if (!userExists) {
                errorMessage += '找不到用戶';
            } else if (!gameIdExists) {
                errorMessage += '遊戲ID不在該事件中';
            } else {
                errorMessage += '找不到用戶或遊戲ID';
            }

            return res.status(404).json({ 
                success: false, 
                message: errorMessage 
            });
        }

        // 查找該用戶的遊戲記錄
        const gameRecord = await GameHistory.findOne({ 
            gameId: gameId, 
            userId: eventUserId 
        });

        // 返回用戶信息和遊戲記錄（如果存在）
        const response = {
            success: true,
            event: {
                id: foundEvent._id,
                name: foundEvent.name
            },
            user: {
                id: foundUser._id,
                name: foundUser.name,
                email: foundUser.email,
                company: foundUser.company,
                currentPoints: foundUser.point || 0
            },
            gameRecord: gameRecord || {}
        };

        res.json(response);

    } catch (error) {
        console.error('開始遊戲錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};

// 結束遊戲 - 記錄分數並更新用戶積分
exports.endGame = async (req, res) => {
    try {
        const { gameId } = req.params;
        const { user: eventUserId, point } = req.body;

        if (!eventUserId || point === undefined || point === null) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少必要參數：用戶ID或分數' 
            });
        }

        if (typeof point !== 'number' || point < 0) {
            return res.status(400).json({ 
                success: false, 
                message: '分數必須是非負數字' 
            });
        }

        // 查找所有事件，檢查用戶是否存在且該事件的gameIds包含此gameId
        const events = await Event.find({});
        let foundUser = null;
        let foundEvent = null;

        for (const event of events) {
            // 檢查該事件是否包含此gameId
            if (event.gameIds && event.gameIds.includes(gameId)) {
                const user = event.users.id(eventUserId);
                if (user) {
                    foundUser = user;
                    foundEvent = event;
                    break;
                }
            }
        }

        // 如果找不到用戶或事件，返回詳細錯誤信息
        if (!foundUser || !foundEvent) {
            // 先檢查用戶是否存在於任何事件中
            let userExists = false;
            let gameIdExists = false;
            
            for (const event of events) {
                if (event.users.id(eventUserId)) {
                    userExists = true;
                }
                if (event.gameIds && event.gameIds.includes(gameId)) {
                    gameIdExists = true;
                }
            }

            let errorMessage = '不能結束遊戲原因：';
            if (!userExists) {
                errorMessage += '找不到用戶';
            } else if (!gameIdExists) {
                errorMessage += '遊戲ID不在該事件中';
            } else {
                errorMessage += '找不到用戶或遊戲ID';
            }

            return res.status(404).json({ 
                success: false, 
                message: errorMessage 
            });
        }

        // 更新用戶積分
        foundUser.point = (foundUser.point || 0) + point;
        await foundEvent.save();

        // 記錄遊戲歷史
        const gameHistory = new GameHistory({
            gameId: gameId,
            userId: eventUserId,
            point: point
        });
        await gameHistory.save();

        // 返回成功響應
        res.json({
            success: true,
            message: '遊戲結束，積分已更新',
            event: {
                id: foundEvent._id,
                name: foundEvent.name
            },
            user: {
                id: foundUser._id,
                name: foundUser.name,
                previousPoints: (foundUser.point || 0) - point,
                currentPoints: foundUser.point,
                gainedPoints: point
            },
            gameHistory: {
                gameId: gameId,
                point: point,
                timestamp: gameHistory.created_at
            }
        });

    } catch (error) {
        console.error('結束遊戲錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};

// 獲取用戶的遊戲歷史
exports.getGameHistory = async (req, res) => {
    try {
        const { gameId, eventUserId } = req.params;

        const gameHistory = await GameHistory.find({ 
            gameId: gameId, 
            userId: eventUserId 
        }).sort({ created_at: -1 });

        res.json({
            success: true,
            gameHistory: gameHistory
        });

    } catch (error) {
        console.error('獲取遊戲歷史錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};

// 獲取遊戲統計信息
exports.getGameStats = async (req, res) => {
    try {
        const { gameId } = req.params;

        const stats = await GameHistory.aggregate([
            { $match: { gameId: gameId } },
            {
                $group: {
                    _id: null,
                    totalGames: { $sum: 1 },
                    totalPoints: { $sum: '$point' },
                    averagePoints: { $avg: '$point' },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalGames: 1,
                    totalPoints: 1,
                    averagePoints: { $round: ['$averagePoints', 2] },
                    uniqueUserCount: { $size: '$uniqueUsers' }
                }
            }
        ]);

        res.json({
            success: true,
            gameId: gameId,
            stats: stats[0] || {
                totalGames: 0,
                totalPoints: 0,
                averagePoints: 0,
                uniqueUserCount: 0
            }
        });

    } catch (error) {
        console.error('獲取遊戲統計錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};

// 為事件添加遊戲ID
exports.addGameIdToEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { gameId } = req.body;

        if (!gameId) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少遊戲ID' 
            });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                message: '找不到該事件' 
            });
        }

        // 檢查gameId是否已存在
        if (!event.gameIds) {
            event.gameIds = [];
        }

        if (event.gameIds.includes(gameId)) {
            return res.status(400).json({ 
                success: false, 
                message: '遊戲ID已存在於該事件中' 
            });
        }

        // 添加gameId
        event.gameIds.push(gameId);
        await event.save();

        res.json({
            success: true,
            message: '遊戲ID已成功添加到事件',
            event: {
                id: event._id,
                name: event.name,
                gameIds: event.gameIds
            }
        });

    } catch (error) {
        console.error('添加遊戲ID錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};

// 從事件移除遊戲ID
exports.removeGameIdFromEvent = async (req, res) => {
    try {
        const { eventId, gameId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                message: '找不到該事件' 
            });
        }

        // 檢查gameId是否存在
        if (!event.gameIds || !event.gameIds.includes(gameId)) {
            return res.status(404).json({ 
                success: false, 
                message: '遊戲ID不存在於該事件中' 
            });
        }

        // 移除gameId
        event.gameIds = event.gameIds.filter(id => id !== gameId);
        await event.save();

        res.json({
            success: true,
            message: '遊戲ID已成功從事件中移除',
            event: {
                id: event._id,
                name: event.name,
                gameIds: event.gameIds
            }
        });

    } catch (error) {
        console.error('移除遊戲ID錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};

// 獲取事件的所有遊戲ID
exports.getEventGameIds = async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                message: '找不到該事件' 
            });
        }

        res.json({
            success: true,
            event: {
                id: event._id,
                name: event.name,
                gameIds: event.gameIds || []
            }
        });

    } catch (error) {
        console.error('獲取事件遊戲ID錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
};
