import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ['user', 'product', 'category', 'order', 'invoice', 'inventory', 'special_product', 'supplier', 'purchase_order'],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'status_change', 'price_change', 'stock_change', 'assign'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    before: {
      type: Object,
      default: {},
    },
    after: {
      type: Object,
      default: {},
    },
    changes: {
      type: Object,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);

