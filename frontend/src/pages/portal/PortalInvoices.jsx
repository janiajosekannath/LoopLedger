import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, IndianRupee } from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import StatCard from '../../components/StatCard';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

const TABS = [
  { label: 'All',       value: '' },
  { label: 'Unpaid',    value: 'confirmed' },
  { label: 'Overdue',   value: '_overdue' },
  { label: 'Paid',      value: 'paid' },
];

const PortalInvoices = () => {
  const navigate = useNavigate();
  const [tab, setTab]   = useState('');
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 15,
    ...(tab === '_overdue' ? { overdue: true } : tab ? { status: tab } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoices', params],
    queryFn: () => invoicesApi.list(params).then((r) => r.data),
    keepPreviousData: true,
  });

  const invoices = data?.data || [];
  const meta     = data?.meta  || {};

  const overdueInvoices = invoices.filter(
    (inv) => inv.status === 'confirmed' && inv.balance > 0 && new Date(inv.dueDate) < new Date()
  );

  const columns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (v) => <span className="font-mono text-xs font-semibold text-indigo-700">{v}</span>,
    },
    { key: 'issueDate', label: 'Issued',  render: (v) => fmtDate(v) },
    {
      key: 'dueDate',
      label: 'Due',
      render: (v, row) => {
        const over = row.status === 'confirmed' && row.balance > 0 && new Date(v) < new Date();
        return <span className={over ? 'text-red-600 font-semibold' : ''}>{fmtDate(v)}</span>;
      },
    },
    { key: 'total',   label: 'Total',   render: (v) => fmt(v) },
    { key: 'balance', label: 'Balance', render: (v) => fmt(v) },
    {
      key: 'status',
      label: 'Status',
      render: (v, row) => {
        const over = v === 'confirmed' && row.balance > 0 && new Date(row.dueDate) < new Date();
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={v} />
            {over && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Invoices" subtitle="View and pay your invoices" />

      {/* Overdue banner */}
      {overdueInvoices.length > 0 && tab === '' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              Outstanding balance: {fmt(overdueInvoices.reduce((s, i) => s + i.balance, 0))}. Please pay to avoid service disruption.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Outstanding"
          value={fmt(invoices.filter((i) => i.status === 'confirmed').reduce((s, i) => s + i.balance, 0))}
          icon={IndianRupee}
          color="yellow"
        />
        <StatCard
          title="Total Invoices"
          value={meta.total ?? invoices.length}
          icon={FileText}
          color="indigo"
        />
      </div>

      {/* Table */}
      <div className="card">
        {/* Tabs */}
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
          onRowClick={(row) => navigate(`/portal/invoices/${row._id}`)}
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

export default PortalInvoices;
