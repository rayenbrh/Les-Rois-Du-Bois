import { Worker } from 'bullmq';
import { redisConnection } from '../config/queue.js';
import { generateInvoicePDF } from '../services/pdfService.js';
import Invoice from '../models/Invoice.model.js';
import Job from '../models/Job.model.js';
import mongoose from 'mongoose';

const pdfWorker = new Worker(
  'pdf-generation',
  async (job) => {
    const { invoiceId, jobId } = job.data;

    try {
      // Update job status
      if (jobId) {
        await Job.findByIdAndUpdate(jobId, {
          status: 'processing',
          startedAt: new Date(),
          progress: 10,
        });
      }

      // Get invoice
      const invoice = await Invoice.findById(invoiceId)
        .populate('orderId')
        .populate('clientId', 'email')
        .populate('commercialId', 'name email');

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (jobId) {
        await Job.findByIdAndUpdate(jobId, { progress: 30 });
      }

      // Generate PDF
      const pdfPath = await generateInvoicePDF(invoice);

      if (jobId) {
        await Job.findByIdAndUpdate(jobId, { progress: 80 });
      }

      // Update invoice with PDF path
      invoice.pdfPath = pdfPath;
      await invoice.save();

      if (jobId) {
        await Job.findByIdAndUpdate(jobId, {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
          result: { pdfPath },
        });
      }

      return { success: true, pdfPath };
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
    concurrency: 2, // Process 2 PDFs at a time
  }
);

pdfWorker.on('completed', (job) => {
  console.log(`✅ PDF generated for invoice: ${job.data.invoiceId}`);
});

pdfWorker.on('failed', (job, err) => {
  console.error(`❌ PDF generation failed for invoice ${job.data.invoiceId}:`, err);
});

export default pdfWorker;

