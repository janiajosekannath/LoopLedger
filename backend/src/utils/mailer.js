/**
 * utils/mailer.js
 * Mailer utility with HTML templates for invoices and payment reminders.
 */

const { sendMail } = require('../config/mailer');

/**
 * Send an overdue invoice payment reminder email.
 * @param {Object} options
 * @param {Object} options.customer
 * @param {Object} options.invoice
 * @returns {Promise<{ messageId: string, previewUrl: string }>}
 */
async function sendPaymentReminderEmail({ customer, invoice }) {
  const customerName = customer?.name || customer?.company || 'Valued Customer';
  const recipientEmail = customer?.email;
  const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A';
  const balanceStr = `₹${(invoice.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const subject = `Payment Reminder: Invoice ${invoice.number || 'Pending'} is Overdue`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #4f46e5; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">LoopLedger</h1>
        <p style="color: #e0e7ff; margin: 4px 0 0 0; font-size: 14px;">Subscription billing you can prove is correct</p>
      </div>
      <div style="padding: 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Payment Reminder</h2>
        <p>Dear ${customerName},</p>
        <p>This is a friendly reminder that invoice <strong>${invoice.number}</strong> was due on <strong>${dueDateStr}</strong> and currently has an outstanding balance of <strong style="color: #dc2626;">${balanceStr}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Invoice Number:</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 14px;">${invoice.number}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Total Amount:</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 14px;">₹${(invoice.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #64748b; font-size: 14px;">Amount Outstanding:</td>
            <td style="padding: 12px 16px; font-weight: bold; color: #dc2626; font-size: 16px;">${balanceStr}</td>
          </tr>
        </table>

        <p>To view your invoice details and make a secure online payment, please log into your customer portal.</p>
        
        <div style="margin: 28px 0; text-align: center;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/portal/invoices" 
             style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">
            View & Pay Invoice Online
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">If payment has already been sent, please disregard this notice.</p>
      </div>
    </div>
  `;

  const text = `Dear ${customerName},\n\nYour invoice ${invoice.number} is overdue with an outstanding balance of ${balanceStr}. Please log into your portal to settle the payment.\n\nThank you,\nBrightloop Team`;

  return sendMail({
    to: recipientEmail,
    subject,
    html,
    text,
  });
}

module.exports = {
  sendMail,
  sendPaymentReminderEmail,
};
