const PDFDocument = require('pdfkit');
const moment = require('moment');

/**
 * Generate a PDF buffer for an invoice document.
 * @param {Object} invoice Mongoose invoice doc (populated customer & lines).
 * @returns {Promise<Buffer>} PDF data.
 */
function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('LoopLedger Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice #: ${invoice.number || 'N/A'}`);
    doc.text(`Issue Date: ${moment(invoice.issueDate).format('YYYY-MM-DD')}`);
    doc.text(`Due Date: ${moment(invoice.dueDate).format('YYYY-MM-DD')}`);
    doc.text(`Status: ${invoice.status}`);
    doc.moveDown();

    // Customer details
    const cust = invoice.customer || {};
    doc.text('Bill To:', { underline: true });
    doc.text(cust.name || cust.company || '');
    if (cust.address) doc.text(cust.address);
    if (cust.email) doc.text(`Email: ${cust.email}`);
    if (cust.phone) doc.text(`Phone: ${cust.phone}`);
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    const colWidths = { desc: 250, qty: 50, unit: 80, tax: 60, total: 80 };
    doc.font('Helvetica-Bold');
    doc.text('Description', 50, tableTop, { width: colWidths.desc });
    doc.text('Qty', 300, tableTop, { width: colWidths.qty, align: 'right' });
    doc.text('Unit Price', 350, tableTop, { width: colWidths.unit, align: 'right' });
    doc.text('Tax', 430, tableTop, { width: colWidths.tax, align: 'right' });
    doc.text('Amount', 490, tableTop, { width: colWidths.total, align: 'right' });
    doc.moveDown();
    doc.font('Helvetica');

    let y = tableTop + 20;
    invoice.lines.forEach((line) => {
      doc.text(line.description || `${line.product?.name || ''} ${line.variant?.value || ''}`, 50, y, { width: colWidths.desc });
      doc.text(line.quantity, 300, y, { width: colWidths.qty, align: 'right' });
      doc.text(`₹${line.unitPrice.toFixed(2)}`, 350, y, { width: colWidths.unit, align: 'right' });
      doc.text(`${line.taxAmount ? line.taxAmount.toFixed(2) : 0}`, 430, y, { width: colWidths.tax, align: 'right' });
      doc.text(`₹${line.amount.toFixed(2)}`, 490, y, { width: colWidths.total, align: 'right' });
      y += 20;
    });
    doc.moveDown();

    // Summary
    const sumY = y + 10;
    doc.text(`Subtotal: ₹${invoice.subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`Discounts: -₹${invoice.discountTotal.toFixed(2)}`, { align: 'right' });
    doc.text(`Tax: ₹${invoice.taxTotal.toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text(`Total: ₹${invoice.total.toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica');
    doc.moveDown();
    doc.text(`Amount Paid: ₹${invoice.amountPaid.toFixed(2)}`);
    doc.text(`Balance Due: ₹${invoice.balance.toFixed(2)}`);

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
