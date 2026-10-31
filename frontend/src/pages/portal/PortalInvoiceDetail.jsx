import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import PaymentMethodSelect from '../../components/PaymentMethodSelect';
import Spinner from '../../components/Spinner';
import { toast } from '../../components/Toast';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PortalInvoiceDetail = () => {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const qc            = useQueryClient();
  // toast is imported directly, no hook needed

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'upi', reference: '', notes: '' });
  const [paying, setPaying]   = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoice', id],
    queryFn: () => invoicesApi.get(id).then((r) => r.data.data),
  });

  const handleDownloadPdf = async () => {
    try {
      const res = await invoicesApi.pdf(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${inv?.number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF download failed');
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setPaying(true);
    try {
      await invoicesApi.pay(id, {
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
      });
      toast.success('Payment recorded successfully!');
      setPayOpen(false);
      setPayForm({ amount: '', method: 'upi', reference: '', notes: '' });
      qc.invalidateQueries(['portal-invoice', id]);
      qc.invalidateQueries(['portal-invoices']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-400">Invoice not found</div>;

  const inv = data;
  const isOverdue = inv.status === 'confirmed' && inv.balance > 0 && new Date(inv.dueDate) < new Date();
  const isPaid    = inv.status === 'paid';
  const canPay    = inv.status === 'confirmed' && inv.balance > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </button>

      {/* Overdue / Paid banner */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">This invoice is overdue</p>
            <p className="text-xs text-red-500 mt-0.5">
              Due {fmtDate(inv.dueDate)} · Balance: {fmt(inv.balance)}. Please pay immediately.
            </p>
          </div>
        </div>
      )}
      {isPaid && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-sm font-semibold text-green-700">This invoice has been fully paid</p>
        </div>
      )}

      {/* Card */}
      <div className="card space-y-6">
        {/* Header row */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Invoice Number</p>
            <p className="text-lg font-bold font-mono text-indigo-700">{inv.number}</p>
          </div>
          <StatusBadge status={inv.status} />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs mb-1">Issue Date</p>
            <p className="font-medium">{fmtDate(inv.issueDate)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Due Date</p>
            <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>{fmtDate(inv.dueDate)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Terms</p>
            <p className="font-medium">{inv.paymentTermsDays ?? 0} days</p>
          </div>
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="text-left pb-2">Item</th>
                <th className="text-right pb-2">Qty</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {(inv.lines || []).map((line, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2">
                    <div className="font-medium">{line.product?.name || line.description || '—'}</div>
                    {line.variant?.name && <div className="text-xs text-gray-400">{line.variant.name}</div>}
                  </td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{fmt(line.unitPrice)}</td>
                  <td className="py-2 text-right font-semibold">{fmt(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 text-sm ml-auto max-w-xs">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span><span>{fmt(inv.subtotal)}</span>
          </div>
          {inv.discountTotal > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Discount</span><span>-{fmt(inv.discountTotal)}</span>
            </div>
          )}
          {inv.taxTotal > 0 && (
            <div className="flex justify-between text-blue-500">
              <span>Tax</span><span>{fmt(inv.taxTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
            <span>Total</span><span>{fmt(inv.total)}</span>
          </div>
          {inv.amountPaid > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Paid</span><span>-{fmt(inv.amountPaid)}</span>
            </div>
          )}
          <div className={`flex justify-between font-bold text-base ${inv.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            <span>Balance Due</span><span>{fmt(inv.balance)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button onClick={handleDownloadPdf} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          {canPay && (
            <button onClick={() => { setPayForm((f) => ({ ...f, amount: String(inv.balance) })); setPayOpen(true); }} className="btn-primary flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700">
              Pay {fmt(inv.balance)}
            </button>
          )}
        </div>
      </div>

      {/* Payment history */}
      {(inv.payments || []).length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h3>
          <div className="space-y-2">
            {inv.payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-medium capitalize">{(p.method || '').replace('_', ' ')}</span>
                  {p.reference && <span className="text-gray-400 ml-2 text-xs">({p.reference})</span>}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-700">{fmt(p.amount)}</p>
                  <p className="text-xs text-gray-400">{fmtDate(p.paidAt || p.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal open={payOpen} title="Make a Payment" onClose={() => setPayOpen(false)} size="md">
        <form onSubmit={handlePay} className="space-y-4">
          <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
            Outstanding balance: <strong>{fmt(inv.balance)}</strong>
          </div>

          <FormField label="Amount (₹)" required>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={inv.balance}
              className="input"
              placeholder={`Max ${fmt(inv.balance)}`}
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </FormField>

          <FormField label="Payment Method" required>
            <PaymentMethodSelect
              value={payForm.method}
              onChange={(v) => setPayForm((f) => ({ ...f, method: v }))}
            />
          </FormField>

          <FormField label="Reference / UPI ID / Transaction ID">
            <input
              type="text"
              className="input"
              placeholder="e.g. UPI Ref, Cheque no, Card last 4…"
              value={payForm.reference}
              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
            />
          </FormField>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
            This is a simulated payment. No real transaction will occur.
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={paying} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {paying && <Spinner size="sm" />}
              Confirm Payment
            </button>
            <button type="button" onClick={() => setPayOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PortalInvoiceDetail;
