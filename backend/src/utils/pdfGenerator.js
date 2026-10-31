const PDFDocument = require('pdfkit');

function formatDate(date) {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return 'N/A';
  }
}

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
    doc.fontSize(22).font('Helvetica-Bold').text('LoopLedger Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).font('Helvetica');
    doc.text(`Invoice #: ${invoice.number || 'N/A'}`);
    doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`);
    doc.text(`Due Date: ${formatDate(invoice.dueDate)}`);
    doc.text(`Status: ${(invoice.status || 'draft').toUpperCase()}`);
    doc.moveDown();

    // Customer details
    const cust = invoice.customer || {};
    doc.font('Helvetica-Bold').text('Bill To:');
    doc.font('Helvetica').text(cust.name || cust.company || 'Customer');
    if (cust.company && cust.name && cust.company !== cust.name) doc.text(cust.company);
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
    const lines = invoice.lines || [];
    lines.forEach((line) => {
      const desc =
        line.description ||
        `${line.product?.name || 'Item'}${line.variant?.value ? ' - ' + line.variant.value : ''}`;
      doc.text(desc, 50, y, { width: colWidths.desc });
      doc.text(String(line.quantity || 1), 300, y, { width: colWidths.qty, align: 'right' });
      doc.text(`INR ${(line.unitPrice || 0).toFixed(2)}`, 350, y, { width: colWidths.unit, align: 'right' });
      doc.text(`${(line.taxAmount || 0).toFixed(2)}`, 430, y, { width: colWidths.tax, align: 'right' });
      doc.text(`INR ${(line.amount || 0).toFixed(2)}`, 490, y, { width: colWidths.total, align: 'right' });
      y += 20;
    });
    doc.moveDown();

    // Summary
    doc.y = y + 15;
    doc.text(`Subtotal: INR ${(invoice.subtotal || 0).toFixed(2)}`, { align: 'right' });
    if (invoice.discountTotal) {
      doc.text(`Discounts: -INR ${(invoice.discountTotal || 0).toFixed(2)}`, { align: 'right' });
    }
    doc.text(`Tax: INR ${(invoice.taxTotal || 0).toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text(`Total: INR ${(invoice.total || 0).toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica');
    doc.moveDown();
    doc.text(`Amount Paid: INR ${(invoice.amountPaid || 0).toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text(`Balance Due: INR ${(invoice.balance || 0).toFixed(2)}`, { align: 'right' });

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
