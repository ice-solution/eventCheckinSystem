const Vote = require('../model/Vote');
const Event = require('../model/Event');
const multer = require('multer');
const path = require('path');

// 設置 multer 來處理投票選項圖片上傳
const uploadVoteImage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/votes/img/'); // 設定上傳路徑
    },
    filename: (req, file, cb) => {
        const eventId = req.params.eventId;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${eventId}_${timestamp}${ext}`);
    }
});

const uploadVoteImageMulter = multer({ 
    storage: uploadVoteImage,
    limits: {
        fileSize: 1024 * 1024 * 5, // 5MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允許上傳圖片！'), false);
        }
        cb(null, true);
    }
});

// 渲染投票管理頁面
exports.renderVoteAdmin = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        
        let vote = await Vote.findOne({ eventId });
        if (!vote) {
            // 創建新的投票
            vote = new Vote({
                eventId,
                title: '投票活動',
                description: '請選擇您最喜歡的選項',
                options: []
            });
            await vote.save();
        }
        
        res.render('admin/vote_admin', { eventId, vote, event });
    } catch (error) {
        console.error('Error rendering vote admin:', error);
        res.status(500).send('Error rendering vote admin');
    }
};

// 添加投票選項
exports.addVoteOption = async (req, res) => {
    const { eventId } = req.params;
    const { name, description } = req.body;
    
    try {
        let vote = await Vote.findOne({ eventId });
        if (!vote) {
            return res.status(404).json({ message: 'Vote not found' });
        }
        
        let imagePath = '';
        if (req.file) {
            imagePath = `/votes/img/${req.file.filename}`;
        }
        
        const newOption = {
            name,
            description,
            image: imagePath,
            votes: 0
        };
        
        vote.options.push(newOption);
        await vote.save();
        
        res.json({ message: 'Option added successfully', option: newOption });
    } catch (error) {
        console.error('Error adding vote option:', error);
        res.status(500).json({ message: 'Error adding vote option' });
    }
};

// 刪除投票選項
exports.deleteVoteOption = async (req, res) => {
    const { eventId, optionId } = req.params;
    
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) {
            return res.status(404).json({ message: 'Vote not found' });
        }
        
        const optionIndex = vote.options.findIndex(option => option._id.toString() === optionId);
        if (optionIndex === -1) {
            return res.status(404).json({ message: 'Option not found' });
        }
        
        vote.options.splice(optionIndex, 1);
        await vote.save();
        
        res.json({ message: 'Option deleted successfully' });
    } catch (error) {
        console.error('Error deleting vote option:', error);
        res.status(500).json({ message: 'Error deleting vote option' });
    }
};

// 更新投票設置
exports.updateVoteSettings = async (req, res) => {
    const { eventId } = req.params;
    const { title, description, isActive } = req.body;
    
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) {
            return res.status(404).json({ message: 'Vote not found' });
        }
        
        vote.title = title;
        vote.description = description;
        vote.isActive = isActive;
        vote.modified_at = Date.now();
        
        await vote.save();
        
        res.json({ message: 'Settings updated successfully', vote });
    } catch (error) {
        console.error('Error updating vote settings:', error);
        res.status(500).json({ message: 'Error updating vote settings' });
    }
};

// 渲染前台投票頁面
exports.renderVotePage = async (req, res) => {
    const { eventId } = req.params;
    
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        
        const vote = await Vote.findOne({ eventId });
        if (!vote || !vote.isActive) {
            return res.status(404).send('Vote not found or inactive');
        }
        
        // 檢查用戶是否已登入
        const user = req.session.user;
        if (!user) {
            return res.redirect(`/events/${eventId}/login`);
        }
        
        // 檢查用戶是否已經投票
        const hasVoted = vote.records.some(record => record.userId.toString() === user._id.toString());
        
        // 計算投票結果
        const totalVotes = vote.records.length;
        const results = vote.options.map(option => ({
            _id: option._id,
            name: option.name,
            image: option.image,
            votes: option.votes,
            percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
        }));
        

        
        res.render('events/vote', { 
            eventId, 
            vote, 
            event, 
            user,
            hasVoted,
            results,
            totalVotes
        });
    } catch (error) {
        console.error('Error rendering vote page:', error);
        res.status(500).send('Error rendering vote page');
    }
};

// 提交投票
exports.submitVote = async (req, res) => {
    const { eventId } = req.params;
    const { optionId, userId, userName } = req.body;
    
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote || !vote.isActive) {
            return res.status(404).json({ message: 'Vote not found or inactive' });
        }
        
        // 檢查用戶是否已經投票
        const hasVoted = vote.records.some(record => record.userId.toString() === userId);
        if (hasVoted) {
            return res.status(400).json({ message: 'You have already voted' });
        }
        
        // 檢查選項是否存在
        const option = vote.options.find(opt => opt._id.toString() === optionId);
        if (!option) {
            return res.status(404).json({ message: 'Option not found' });
        }
        
        // 添加投票記錄
        vote.records.push({
            userId,
            userName,
            optionId,
            votedAt: new Date()
        });
        
        // 更新選項票數
        option.votes += 1;
        
        await vote.save();
        
        // 計算投票結果
        const totalVotes = vote.records.length;
        const results = vote.options.map(option => ({
            _id: option._id,
            name: option.name,
            image: option.image,
            votes: option.votes,
            percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
        }));
        
        res.json({ 
            message: 'Vote submitted successfully', 
            results,
            totalVotes,
            hasVoted: true
        });
    } catch (error) {
        console.error('Error submitting vote:', error);
        res.status(500).json({ message: 'Error submitting vote' });
    }
};

// 獲取投票結果
exports.getVoteResults = async (req, res) => {
    const { eventId } = req.params;
    
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) {
            return res.status(404).json({ message: 'Vote not found' });
        }
        
        const totalVotes = vote.records.length;
        const results = vote.options.map(option => ({
            _id: option._id,
            name: option.name,
            image: option.image,
            votes: option.votes,
            percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
        }));
        
        res.json({ results, totalVotes });
    } catch (error) {
        console.error('Error getting vote results:', error);
        res.status(500).json({ message: 'Error getting vote results' });
    }
};

// 檢查用戶是否已投票
exports.checkUserVote = async (req, res) => {
    const { eventId, userId } = req.params;
    
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) {
            return res.status(404).json({ message: 'Vote not found' });
        }
        
        const userRecord = vote.records.find(record => record.userId.toString() === userId);
        const hasVoted = !!userRecord;
        
        res.json({ hasVoted, userRecord });
    } catch (error) {
        console.error('Error checking user vote:', error);
        res.status(500).json({ message: 'Error checking user vote' });
    }
};

// 確保所有函數都被正確導出
exports.uploadVoteImageMulter = uploadVoteImageMulter; 