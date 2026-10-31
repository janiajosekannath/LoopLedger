import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Banknote, CreditCard, Building, Smartphone, FileText } from 'lucide-react';
import { paymentsApi } from '../api/payments';
import client from '../api/client';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const methodIcons = {
  cash: Banknote,
  bank_transfer: Building,
  card: CreditCard,
  upi: Smartphone,
  other: FileText,
};

const PaymentsPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    invoice: '',
    method: 'bank_transfer',
    amount: '',
    paidOn: new Date().toISOString().split('T')[0],
    note: '',
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-unpaid'],
    queryFn: () =>
      client
        .get('/invoices', { params: { limit: 100 } })
        .then((r) => r.data.data)
        .catch(() => []),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, search, methodFilter],
    queryFn: () =>
      paymentsApi
        .list({
          page,
          limit: 10,
          search,
          method: methodFilter || undefined,
        })
        .then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => paymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded successfully');
      setModalOpen(false);
      setForm({
        invoice: '',
        method: 'bank_transfer',
        amount: '',
        paidOn: new Date().toISOString().split('T')[0],
        note: '',
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    },
  });

  const handleInvoiceChange = (invId) => {
    const inv = invoicesData?.find((i) => i._id === invId);
    setForm({
      ...form,
      invoice: invId,
      amount: inv ? (inv.balance != null ? inv.balance : inv.total) : '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.invoice) return toast.error('Please select an invoice');
    if (!form.amount || Number(form.amount) <= 0) {
      return toast.error('Amount must be greater than 0');
    }

    createMutation.mutate({
      invoice: form.invoice,
      method: form.method,
      amount: Number(form.amount),
      paidOn: form.paidOn ? new Date(form.paidOn) : new Date(),
      note: form.note || undefined,
    });
  };

  const columns = [
    {
      key: 'number',
      label: 'Payment #',
      render: (val) => <span className="font-semibold text-gray-900">{val}</span>,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (val) => (
        <div>
          <p className="font-medium text-gray-900">{val?.name || '—'}</p>
          <p className="text-xs text-gray-500">{val?.company || val?.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'invoice',
      label: 'Invoice',
      render: (val) =>
        val ? (
          <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">
            {val.number || 'Invoice'}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'method',
      label: 'Payment Method',
      render: (val) => {
        const Icon = methodIcons[val] || FileText;
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-slate-700">
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            <span>{val?.replace('_', ' ')}</span>
          </div>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount Paid',
      render: (val) => (
        <span className="font-bold text-green-700">
          ₹{val?.toLocaleString('en-IN') || 0}
        </span>
      ),
    },
    {
      key: 'paidOn',
      label: 'Date',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'note',
      label: 'Notes',
      render: (val) => <span className="text-xs text-gray-500 truncate max-w-xs">{val || '—'}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payments Ledger"
        subtitle="Track incoming cash, bank wire, UPI, and card settlements against invoices"
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        }
      />

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search payment number (PAY-...)..."
            className="w-full sm:w-72"
          />

          <select
            className="input w-auto text-xs"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Methods</option>
            <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          emptyMessage="No payments recorded yet."
        />

        <Pagination
          page={page}
          totalPages={data?.meta?.totalPages || 1}
          onPageChange={setPage}
        />
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Payment Settlement"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Target Invoice" required>
            <select
              className="input"
              value={form.invoice}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              required
            >
              <option value="">Select Invoice to settle...</option>
              {invoicesData?.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.number} — {inv.customer?.name} (Due: ₹{inv.balance ?? inv.total})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Payment Method" required>
              <select
                className="input"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                required
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="upi">UPI</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </FormField>

            <FormField label="Amount Paid (₹)" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="₹ Amount"
                required
              />
            </FormField>
          </div>

          <FormField label="Payment Date" required>
            <input
              type="date"
              className="input"
              value={form.paidOn}
              onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Note / Reference Number">
            <input
              type="text"
              className="input"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="e.g. UTR / Transaction ID #9876543210"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Spinner size="sm" /> : 'Record Settlement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PaymentsPage;
