import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, IndianRupee, AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react';
import { invoicesApi } from '../api/invoices';
import { remindersApi } from '../api/reminders';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = [
  { label: 'All',       value: '' },
  { label: 'Draft',     value: 'draft' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Paid',      value: 'paid' },
  { label: 'Overdue',   value: '_overdue' },
  { label: 'Cancelled', value: 'cancelled' },
];

const InvoicesPage = () => {
  const navigate = useNavigate();

  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState('');
  const [page, setPage]           = useState(1);
  const [reminding, setReminding] = useState(false);

  const params = {
    page,
    limit: 20,
    ...(search && { search }),
    ...(tab === '_overdue' ? { overdue: true } : tab ? { status: tab } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', params],
    queryFn: () => invoicesApi.list(params).then((r) => r.data),
    keepPreviousData: true,
  });

  const invoices = data?.data || [];
  const meta     = data?.meta  || {};

  const totalInvoiced    = data?.meta?.totalInvoiced    ?? null;
  const totalOutstanding = data?.meta?.totalOutstanding ?? null;
  const overdueCount     = data?.meta?.overdueCount     ?? null;
  const paidThisMonth    = data?.meta?.paidThisMonth    ?? null;

  const handleRunReminders = async () => {
    setReminding(true);
    try {
      const res = await remindersApi.trigger();
      toast.success(`Reminders sent: ${res.data?.data?.sent ?? 0}`);
    } catch {
      toast.error('Failed to trigger reminders');
    } finally {
      setReminding(false);
    }
  };

  const columns = [
    { key: 'number', label: 'Invoice #', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-700">{v}</span> },
    {
      key: 'customer',
      label: 'Customer',
      render: (v, row) => (
        <div>
          <div className="font-medium text-gray-800">{row.customer?.name || '—'}</div>
          <div className="text-xs text-gray-400">{row.customer?.email}</div>
        </div>
      ),
    },
    { key: 'issueDate', label: 'Issued',  render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    {
      key: 'dueDate',
      label: 'Due',
      render: (v, row) => {
        const overdue = row.status === 'confirmed' && row.balance > 0 && new Date(v) < new Date();
        return (
          <span className={overdue ? 'text-red-600 font-semibold' : ''}>
            {v ? new Date(v).toLocaleDateString('en-IN') : '—'}
          </span>
        );
      },
    },
    { key: 'total',   label: 'Total',   render: (v) => fmt(v) },
    { key: 'balance', label: 'Balance', render: (v) => fmt(v) },
    {
      key: 'status',
      label: 'Status',
      render: (v, row) => {
        const overdue = v === 'confirmed' && row.balance > 0 && new Date(row.dueDate) < new Date();
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={v} />
            {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" title="Overdue" />}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Track and manage all billing invoices"
        action={
          <button
            onClick={handleRunReminders}
            disabled={reminding}
            className="btn-secondary flex items-center gap-2"
          >
            {reminding ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Run Reminders
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Invoiced"   value={totalInvoiced   != null ? fmt(totalInvoiced)    : '—'} icon={FileText}     color="indigo" />
        <StatCard title="Outstanding"      value={totalOutstanding != null ? fmt(totalOutstanding) : '—'} icon={IndianRupee}  color="yellow" />
        <StatCard title="Overdue Invoices" value={overdueCount     != null ? overdueCount          : '—'} icon={AlertTriangle} color="red"   />
        <StatCard title="Paid This Month"  value={paidThisMonth    != null ? fmt(paidThisMonth)    : '—'} icon={CheckCircle}  color="green" />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by invoice number or customer…"
            className="flex-1"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setPage(1); }}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.value
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={invoices}
          loading={isLoading}
          emptyMessage="No invoices found"
          onRowClick={(row) => navigate(`/billing/invoices/${row._id}`)}
        />

        {meta.totalPages > 1 && (
          <div className="mt-4">
            <Pagination page={page} totalPages={meta.totalPages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
