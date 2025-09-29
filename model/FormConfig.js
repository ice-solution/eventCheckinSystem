const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
    fieldName: { 
        type: String, 
        required: true 
    },
    label: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['text', 'email', 'select', 'textarea', 'tel'], 
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
        type: String, 
        default: '' 
    },
    options: [{ 
        value: String, 
        label: String 
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
        type: String, 
        required: true 
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

