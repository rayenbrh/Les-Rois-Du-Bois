import Job from '../models/Job.model.js';
import { pdfQueue, emailQueue, isQueueAvailable } from '../config/queue.js';

export const getJobs = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Job.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('resourceId');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة',
      });
    }

    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

export const retryJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة',
      });
    }

    if (job.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إعادة محاولة مهمة مكتملة',
      });
    }

    // Reset job status
    job.status = 'pending';
    job.retries += 1;
    job.error = null;
    await job.save();

    // Re-add to appropriate queue (only if queue is available)
    if (!isQueueAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Job queue is not available. Please configure Redis.',
      });
    }

    if (job.type === 'pdf_generation' && pdfQueue) {
      await pdfQueue.add('generate-invoice-pdf', {
        invoiceId: job.payload.invoiceId,
        jobId: job._id,
      });
    } else if (job.type === 'email' && emailQueue) {
      await emailQueue.add('send-invoice-email', {
        invoiceId: job.payload.invoiceId,
        jobId: job._id,
      });
    }

    res.json({
      success: true,
      message: 'تمت إعادة المحاولة بنجاح',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة',
      });
    }

    if (job.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء مهمة مكتملة',
      });
    }

    job.status = 'cancelled';
    await job.save();

    res.json({
      success: true,
      message: 'تم إلغاء المهمة',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

