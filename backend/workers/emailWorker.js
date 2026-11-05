import { Worker } from 'bullmq';
import { redisConnection } from '../config/queue.js';
import { sendInvoiceEmail } from '../services/emailService.js';
import Invoice from '../models/Invoice.model.js';
import Job from '../models/Job.model.js';

const emailWorker = new Worker(
  'email-sending',
  async (job) => {
    const { invoiceId, jobId } = job.data;

    try {
      // Update job status
      if (jobId) {
        await Job.findByIdAndUpdate(jobId, {
          status: 'processing',
          startedAt: new Date(),
        });
      }

      // Get invoice
      const invoice = await Invoice.findById(invoiceId)
        .populate('clientId', 'email name')
        .populate('orderId');

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Ensure PDF exists
      let pdfPath = invoice.pdfPath;
      if (!pdfPath) {
        throw new Error('PDF not generated yet. Please generate PDF first.');
      }

      // Send email
      await sendInvoiceEmail(invoice, pdfPath.replace('/uploads', './uploads'));

      // Update invoice
      invoice.emailSent = true;
      invoice.emailSentAt = new Date();
      await invoice.save();

      if (jobId) {
        await Job.findByIdAndUpdate(jobId, {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        });
      }

      return { success: true };
    } catch (error) {
      if (jobId) {
        await Job.findByIdAndUpdate(jobId, {
          status: 'failed',
          error: {
            message: error.message,
            stack: error.stack,
          },
        });
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 emails at a time
  }
);

emailWorker.on('completed', (job) => {
  console.log(`✅ Email sent for invoice: ${job.data.invoiceId}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Email sending failed for invoice ${job.data.invoiceId}:`, err);
});

export default emailWorker;

