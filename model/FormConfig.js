const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
    fieldName: { 
        type: String, 
        required: true 
    },
    label: {
        zh: { type: String, default: '' }, // 中文標籤
        en: { type: String, default: '' }  // 英文標籤
    },
    type: { 
        type: String, 
        enum: ['text', 'email', 'select', 'textarea', 'tel', 'checkbox', 'radio'], 
        required: true 
    },
    required: { 
        type: Boolean, 
        default: false 
    },
    visible: { 
        type: Boolean, 
        default: true 
    },
    placeholder: {
        zh: { type: String, default: '' }, // 中文佔位符
        en: { type: String, default: '' }  // 英文佔位符
    },
    options: [{ 
        value: String,
        label: {
            zh: String, // 中文選項標籤
            en: String  // 英文選項標籤
        }
    }],
    validation: {
        minLength: Number,
        maxLength: Number,
        pattern: String
    },
    order: { 
        type: Number, 
        default: 0 
    }
});

const formSectionSchema = new mongoose.Schema({
    sectionName: { 
        type: String, 
        required: true 
    },
    sectionTitle: {
        zh: { type: String, default: '' }, // 中文區塊標題
        en: { type: String, default: '' }  // 英文區塊標題
    },
    visible: { 
        type: Boolean, 
        default: true 
    },
    fields: [formFieldSchema],
    order: { 
        type: Number, 
        default: 0 
    }
});

const formConfigSchema = new mongoose.Schema({
    eventId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Event', 
        required: true 
    },
    defaultLanguage: {
        type: String,
        enum: ['zh', 'en'],
        default: 'zh' // 默認語言為中文
    },
    sections: [formSectionSchema],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// 更新時間中間件
formConfigSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const FormConfig = mongoose.model('FormConfig', formConfigSchema);

module.exports = FormConfig;

