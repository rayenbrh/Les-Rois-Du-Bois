import mongoose from 'mongoose';

const orderActivitySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    action: {
      type: String,
      enum: ['created', 'updated', 'status_changed', 'item_added', 'item_removed', 'assigned', 'canceled'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changes: {
      type: Object,
      default: {},
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
orderActivitySchema.index({ orderId: 1, createdAt: -1 });
orderActivitySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('OrderActivity', orderActivitySchema);

