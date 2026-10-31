import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle, XCircle, Send, Download, IndianRupee,
  AlertTriangle, Clock, User,
} from 'lucide-react';
import { invoicesApi } from '../api/invoices';
import { historyApi } from '../api/history';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import PaymentMethodSelect from '../components/PaymentMethodSelect';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const InvoiceDetailPage = () => {
  const { id }  = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [confirmAction, setConfirmAction] = useState(null);
  const [payOpen, setPayOpen]             = useState(false);
  const [payForm, setPayForm]             = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
  const [paying, setPaying]               = useState(false);
  const [sending, setSending]             = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id).then((r) => r.data.data),
  });

  const { data: histData } = useQuery({
    queryKey: ['history', 'Invoice', id],
    queryFn: () => historyApi.getHistory('Invoice', id).then((r) => r.data.data),
    enabled: !!id,
  });

  const invalidate = () => qc.invalidateQueries(['invoice', id]);

  const actionMutation = useMutation({
    mutationFn: ({ action }) =>
      action === 'confirm' ? invoicesApi.confirm(id) : invoicesApi.cancel(id),
    onSuccess: (_, { action }) => {
      toast.success(`Invoice ${action}ed`);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed'),
  });

  const handleAction = (action) => {
    setConfirmAction(null);
    actionMutation.mutate({ action });
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await invoicesApi.send(id);
      toast.success('Invoice sent by email');
      invalidate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

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
      toast.success('Payment recorded');
      setPayOpen(false);
      setPayForm({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
      invalidate();
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
  const canConfirm = inv.status === 'draft';
  const canCancel  = ['draft', 'confirmed'].includes(inv.status);
  const canPay     = inv.status === 'confirmed' && inv.balance > 0;

  const timeline = (histData || []).map((h) => ({
    id: h._id,
    title: `${h.from ? `${h.from} → ` : ''}${h.to}`,
    description: h.note,
    timestamp: h.createdAt,
    user: h.changedBy?.name,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{inv.number}</h1>
            <StatusBadge status={inv.status} />
            {isOverdue && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" /> Overdue
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {inv.customer?.name} · {inv.customer?.email}
          </p>
        </div>

        {/* Action toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {canConfirm && (
            <button onClick={() => setConfirmAction('confirm')} className="btn-primary flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-4 h-4" /> Confirm
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setPayOpen(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"
              style={{ backgroundColor: '#16a34a' }}
            >
              <IndianRupee className="w-4 h-4" /> Record Payment
            </button>
          )}
          <button onClick={handleSend} disabled={sending} className="btn-secondary flex items-center gap-1.5 text-sm">
            {sending ? <Spinner size="sm" /> : <Send className="w-4 h-4" />} Send
          </button>
          <button onClick={handleDownloadPdf} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download className="w-4 h-4" /> PDF
          </button>
          {canCancel && (
            <button
              onClick={() => setConfirmAction('cancel')}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              style={{ color: '#dc2626', borderColor: '#fecaca' }}
            >
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice details */}
          <div className="card">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-6">
              <div>
                <p className="text-gray-400 text-xs mb-1">Issue Date</p>
                <p className="font-medium">{fmtDate(inv.issueDate)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Due Date</p>
                <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>{fmtDate(inv.dueDate)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Payment Terms</p>
                <p className="font-medium">{inv.paymentTermsDays ?? 0} days</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Subscription</p>
                <p className="font-medium font-mono text-xs">{inv.subscription?.number || '—'}</p>
              </div>
            </div>

            {/* Line items */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                    <th className="text-left pb-2 px-2">Item</th>
                    <th className="text-right pb-2 px-2">Qty</th>
                    <th className="text-right pb-2 px-2">Unit Price</th>
                    <th className="text-right pb-2 px-2">Discount</th>
                    <th className="text-right pb-2 px-2">Tax</th>
                    <th className="text-right pb-2 px-2">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.lines || []).map((line, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-2">
                        <div className="font-medium text-gray-800">{line.product?.name || line.description || '—'}</div>
                        {line.variant?.name && <div className="text-xs text-gray-400">{line.variant.name}</div>}
                      </td>
                      <td className="py-2 px-2 text-right">{line.quantity}</td>
                      <td className="py-2 px-2 text-right">{fmt(line.unitPrice)}</td>
                      <td className="py-2 px-2 text-right text-red-600">{line.discountAmount > 0 ? `-${fmt(line.discountAmount)}` : '—'}</td>
                      <td className="py-2 px-2 text-right text-blue-600">{fmt(line.taxAmount)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{fmt(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 ml-auto max-w-xs text-sm space-y-1.5">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{fmt(inv.subtotal)}</span>
              </div>
              {inv.discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span><span>-{fmt(inv.discountTotal)}</span>
                </div>
              )}
              {inv.taxTotal > 0 && (
                <div className="flex justify-between text-blue-600">
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
                <span>Balance</span><span>{fmt(inv.balance)}</span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {(inv.payments || []).length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-green-600" /> Payment History
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                    <th className="text-left pb-2 px-2">Ref</th>
                    <th className="text-left pb-2 px-2">Method</th>
                    <th className="text-right pb-2 px-2">Amount</th>
                    <th className="text-right pb-2 px-2">Date</th>
                    <th className="text-right pb-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p._id} className="border-b border-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">{p.number || p._id?.slice(-6)}</td>
                      <td className="py-2 px-2 capitalize">{(p.method || '').replace('_', ' ')}</td>
                      <td className="py-2 px-2 text-right text-green-700 font-semibold">{fmt(p.amount)}</td>
                      <td className="py-2 px-2 text-right">{fmtDate(p.paidAt || p.createdAt)}</td>
                      <td className="py-2 px-2 text-right"><StatusBadge status={p.status || 'completed'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar — Audit timeline */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> History
            </h3>
            {timeline.length > 0 ? (
              <Timeline items={timeline} />
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No history yet</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" /> Customer
            </h3>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{inv.customer?.name}</p>
              <p className="text-gray-500">{inv.customer?.email}</p>
              {inv.customer?.phone && <p className="text-gray-500">{inv.customer?.phone}</p>}
              {inv.customer?.company && <p className="text-gray-400 text-xs">{inv.customer?.company}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm / Cancel dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction === 'confirm' ? 'Confirm Invoice' : 'Cancel Invoice'}
        message={
          confirmAction === 'confirm'
            ? 'This will lock the invoice for payment. Continue?'
            : 'Cancelling this invoice cannot be undone. Are you sure?'
        }
        confirmLabel={confirmAction === 'confirm' ? 'Confirm' : 'Cancel Invoice'}
        danger={confirmAction === 'cancel'}
        onConfirm={() => handleAction(confirmAction)}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Payment modal */}
      <Modal open={payOpen} title="Record Payment" onClose={() => setPayOpen(false)} size="md">
        <form onSubmit={handlePay} className="space-y-4">
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

          <FormField label="Reference / Transaction ID">
            <input
              type="text"
              className="input"
              placeholder="UTR / Cheque number / Card last 4…"
              value={payForm.reference}
              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              className="input"
              rows={2}
              placeholder="Optional payment notes…"
              value={payForm.notes}
              onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </FormField>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={paying} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {paying && <Spinner size="sm" />}
              Record ₹{payForm.amount || '0'} Payment
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

export default InvoiceDetailPage;
