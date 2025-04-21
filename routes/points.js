const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');



// 渲染創建點數的頁面
router.get('/create', (req, res) => {
    const { eventId } = req.params; // 獲取 eventId
    console.log(eventId);
    console.log(req.url); // 應該能夠獲取到 eventId
    res.render('admin/points/create_points', { eventId }); // 傳遞 eventId
});

// 渲染編輯點數的頁面
router.get('/edit/:pointId', async (req, res) => {
    const { eventId, pointId } = req.params;
    try {
        const event = await Event.findById(eventId);
        const point = event.points.id(pointId);
        if (!point) {
            return res.status(404).send('Point not found.');
        }
        res.render('admin/points/edit_points', { eventId, point }); // 傳遞 eventId 和 point
    } catch (error) {
        console.error('Error fetching point for edit:', error);
        res.status(500).send('Error fetching point.');
    }
});

// 創建新的 points
router.post('/', eventsController.createPoint);

// 獲取所有 points
router.get('/', eventsController.getPoints);

// 獲取單個 point
// router.get('/:pointId', eventsController.getPointById);

// 更新 point
router.put('/:pointId', eventsController.updatePoint);

// 渲染點數列表的頁面
router.get('/list', async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }
        res.render('admin/points/list_points', { eventId, points: event.points }); // 傳遞 eventId 和 points
    } catch (error) {
        console.error('Error fetching points list:', error);
        res.status(500).send('Error fetching points.');
    }
});

module.exports = router;
