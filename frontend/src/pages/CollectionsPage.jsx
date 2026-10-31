import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, RefreshCw, AlertTriangle, Mail } from 'lucide-react';
import { remindersApi } from '../api/reminders';
import { invoicesApi } from '../api/invoices';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

const CollectionsPage = () => {
  const [page, setPage]         = useState(1);
  const [confirmRun, setConfirmRun] = useState(false);
  const [running, setRunning]   = useState(false);

  const { data: overdueData, isLoading: overdueLoading, refetch: refetchOverdue } = useQuery({
    queryKey: ['collections-overdue', page],
    queryFn: () => invoicesApi.list({ page, limit: 20, overdue: true }).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: reminderData, isLoading: reminderLoading, refetch: refetchReminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => remindersApi.list({ limit: 20 }).then((r) => r.data),
  });

  const overdueInvoices = overdueData?.data || [];
  const reminderLogs    = reminderData?.data || [];
  const overdueMeta     = overdueData?.meta  || {};

  const totalOverdueBalance = overdueInvoices.reduce((s, i) => s + (i.balance || 0), 0);

  const handleRunReminders = async () => {
    setConfirmRun(false);
    setRunning(true);
    try {
      const res = await remindersApi.trigger();
      const sent = res.data?.data?.sent ?? 0;
      toast.success(`Reminder run complete — ${sent} email(s) sent`);
      refetchOverdue();
      refetchReminders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reminder run failed');
    } finally {
      setRunning(false);
    }
  };

  const overdueColumns = [
    { key: 'number',   label: 'Invoice #', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-700">{v}</span> },
    {
      key: 'customer',
      label: 'Customer',
      render: (v, row) => (
        <div>
          <p className="font-medium text-gray-800">{row.customer?.name || '—'}</p>
          <p className="text-xs text-gray-400">{row.customer?.email}</p>
        </div>
      ),
    },
    { key: 'dueDate',  label: 'Due Date', render: (v) => <span className="text-red-600 font-medium">{fmtDate(v)}</span> },
    { key: 'total',    label: 'Total',    render: (v) => fmt(v) },
    { key: 'balance',  label: 'Balance',  render: (v) => <span className="font-semibold text-red-700">{fmt(v)}</span> },
    { key: 'status',   label: 'Status',   render: () => <StatusBadge status="confirmed" /> },
  ];

  const reminderColumns = [
    { key: 'invoice',   label: 'Invoice',  render: (v, row) => <span className="font-mono text-xs">{row.invoice?.number || String(v || '').slice(-6)}</span> },
    { key: 'channel',   label: 'Channel',  render: (v) => <span className="capitalize">{v || 'email'}</span> },
    { key: 'recipient', label: 'Sent To',  render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span> },
    { key: 'sentAt',    label: 'Sent At',  render: (v) => fmtDate(v) },
    { key: 'status',    label: 'Status',   render: (v) => <StatusBadge status={v || 'sent'} /> },
    {
      key: 'previewUrl',
      label: 'Preview',
      render: (v) =>
        v ? <a href={v} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs underline">Open</a> : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections & Reminders"
        subtitle="Monitor overdue invoices and run dunning reminders"
        action={
          <button
            onClick={() => setConfirmRun(true)}
            disabled={running}
            className="btn-primary flex items-center gap-2"
          >
            {running ? <Spinner size="sm" /> : <Mail className="w-4 h-4" />}
            Run Reminders Now
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Overdue Invoices"   value={overdueMeta.total ?? overdueInvoices.length} icon={AlertTriangle} color="red"    />
        <StatCard title="Overdue Balance"    value={fmt(totalOverdueBalance)}                     icon={Bell}          color="yellow" />
        <StatCard title="Reminders Sent"     value={reminderData?.meta?.total ?? reminderLogs.length} icon={Mail}     color="indigo" />
        <StatCard title="Active Collections" value={overdueInvoices.length}                       icon={RefreshCw}    color="blue"   />
      </div>

      {/* Overdue invoices */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" /> Overdue Invoices
        </h2>
        <DataTable
          columns={overdueColumns}
          data={overdueInvoices}
          loading={overdueLoading}
          emptyMessage="No overdue invoices — great work!"
        />
        {overdueMeta.totalPages > 1 && (
          <div className="mt-4">
            <Pagination page={page} totalPages={overdueMeta.totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Reminder log */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-indigo-500" /> Reminder Log
        </h2>
        <DataTable
          columns={reminderColumns}
          data={reminderLogs}
          loading={reminderLoading}
          emptyMessage="No reminders sent yet"
        />
      </div>

      <ConfirmDialog
        open={confirmRun}
        title="Run Reminder Campaign"
        message="This will email all customers with overdue invoices. Continue?"
        confirmLabel="Send Reminders"
        onConfirm={handleRunReminders}
        onCancel={() => setConfirmRun(false)}
      />
    </div>
  );
};

export default CollectionsPage;
