// 遊戲API測試腳本
// 使用方法：node test_game_api.js

const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3377';
const GAME_ID = 'test_game_123';
const EVENT_ID = '507f1f77bcf86cd799439010'; // 請替換為實際的事件ID
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // 請替換為實際的用戶ID

// 測試函數
async function testGameAPI() {
    console.log('🎮 開始測試遊戲API...\n');

    try {
        // 0. 首先為事件添加遊戲ID
        console.log('0. 為事件添加遊戲ID...');
        try {
            const addGameResponse = await axios.post(`${BASE_URL}/api/game/event/${EVENT_ID}/gameId`, {
                gameId: GAME_ID
            });
            console.log('✅ 添加遊戲ID響應:', JSON.stringify(addGameResponse.data, null, 2));
        } catch (error) {
            if (error.response?.data?.message?.includes('已存在')) {
                console.log('ℹ️ 遊戲ID已存在於事件中');
            } else {
                throw error;
            }
        }
        console.log('');

        // 1. 測試獲取事件的遊戲ID列表
        console.log('1. 測試獲取事件遊戲ID列表...');
        const gameIdsResponse = await axios.get(`${BASE_URL}/api/game/event/${EVENT_ID}/gameIds`);
        console.log('✅ 事件遊戲ID列表響應:', JSON.stringify(gameIdsResponse.data, null, 2));
        console.log('');

        // 2. 測試遊戲開始
        console.log('2. 測試遊戲開始 API...');
        const startResponse = await axios.post(`${BASE_URL}/api/game/${GAME_ID}/gamestart`, {
            user: TEST_USER_ID
        });
        console.log('✅ 遊戲開始響應:', JSON.stringify(startResponse.data, null, 2));
        console.log('');

        // 3. 測試遊戲結束
        console.log('3. 測試遊戲結束 API...');
        const endResponse = await axios.post(`${BASE_URL}/api/game/${GAME_ID}/endgame`, {
            user: TEST_USER_ID,
            point: 5
        });
        console.log('✅ 遊戲結束響應:', JSON.stringify(endResponse.data, null, 2));
        console.log('');

        // 4. 測試獲取遊戲歷史
        console.log('4. 測試獲取遊戲歷史 API...');
        const historyResponse = await axios.get(`${BASE_URL}/api/game/${GAME_ID}/user/${TEST_USER_ID}/history`);
        console.log('✅ 遊戲歷史響應:', JSON.stringify(historyResponse.data, null, 2));
        console.log('');

        // 5. 測試獲取遊戲統計
        console.log('5. 測試獲取遊戲統計 API...');
        const statsResponse = await axios.get(`${BASE_URL}/api/game/${GAME_ID}/stats`);
        console.log('✅ 遊戲統計響應:', JSON.stringify(statsResponse.data, null, 2));
        console.log('');

        console.log('🎉 所有測試完成！');

    } catch (error) {
        console.error('❌ 測試失敗:', error.response?.data || error.message);
    }
}

// 執行測試
if (require.main === module) {
    console.log('請確保：');
    console.log('1. 伺服器正在運行 (npm start 或 node app.js)');
    console.log('2. 已將 EVENT_ID 和 TEST_USER_ID 替換為實際的ID');
    console.log('3. 該用戶存在於指定事件中');
    console.log('4. 事件存在且可以添加遊戲ID\n');
    
    testGameAPI();
}

module.exports = { testGameAPI };
