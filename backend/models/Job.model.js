import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: [
        'pdf_generation',
        'composite_image',
        'export_csv',
        'export_pdf',
        'scheduled_report',
        'email',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    priority: {
      type: Number,
      default: 0, // Higher number = higher priority
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
    },
    error: {
      message: String,
      stack: String,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    retries: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    logs: [
      {
        message: String,
        level: {
          type: String,
          enum: ['info', 'warn', 'error', 'debug'],
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resourceType: {
      type: String, // 'invoice', 'order', etc.
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ type: 1, status: 1 });
// Note: jobId already has unique: true, which creates an index automatically
jobSchema.index({ resourceType: 1, resourceId: 1 });
jobSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model('Job', jobSchema);

