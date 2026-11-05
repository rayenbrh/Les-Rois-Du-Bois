import mongoose from 'mongoose';

const clientNoteSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    commercialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'محتوى الملاحظة مطلوب'],
    },
    tags: [{
      type: String,
      enum: ['VIP', 'delayed_payer', 'new', 'important', 'follow_up', 'complaint', 'other'],
    }],
    isImportant: {
      type: Boolean,
      default: false,
    },
    reminderDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
clientNoteSchema.index({ clientId: 1, createdAt: -1 });
clientNoteSchema.index({ commercialId: 1, createdAt: -1 });
clientNoteSchema.index({ tags: 1 });

export default mongoose.model('ClientNote', clientNoteSchema);

