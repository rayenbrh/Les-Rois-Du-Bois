import nodemailer from 'nodemailer';

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send invoice email to client
 * @param {Object} invoice - Invoice document
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<Object>} - Email send result
 */
export const sendInvoiceEmail = async (invoice, pdfPath) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP not configured. Please set SMTP_USER and SMTP_PASS in .env');
    }

    const transporter = createTransporter();

    // Get client email
    const clientEmail = invoice.clientEmail || invoice.clientId?.email;
    if (!clientEmail) {
      throw new Error('Client email not found');
    }

    // Email content
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: clientEmail,
      subject: `Invoice ${invoice.invoiceNumber} - Les Rois des Bois / فاتورة ${invoice.invoiceNumber}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FFD700;">Les Rois des Bois</h2>
          <h3>Invoice / فاتورة</h3>
          <p>Dear ${invoice.clientName},</p>
          <p>Please find attached your invoice <strong>${invoice.invoiceNumber}</strong>.</p>
          <p>Total Amount: <strong>${invoice.total.toFixed(2)} TND</strong></p>
          <p>Due Date: <strong>${new Date(invoice.dueDate).toLocaleDateString()}</strong></p>
          <p>Status: <strong>${invoice.status.toUpperCase()}</strong></p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            عزيزي ${invoice.clientName}،<br>
            يرجى الاطلاع على الفاتورة المرفقة رقم <strong>${invoice.invoiceNumber}</strong>.<br>
            المبلغ الإجمالي: <strong>${invoice.total.toFixed(2)} د.ت</strong><br>
            تاريخ الاستحقاق: <strong>${new Date(invoice.dueDate).toLocaleDateString('ar-TN')}</strong>
          </p>
        </div>
      `,
      attachments: pdfPath ? [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          path: pdfPath.replace('/uploads', './uploads'), // Convert URL path to file system path
        },
      ] : [],
    };

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Test email configuration
 * @returns {Promise<boolean>}
 */
export const testEmailConfig = async () => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return false;
    }

    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email config test failed:', error);
    return false;
  }
};

