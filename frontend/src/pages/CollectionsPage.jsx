import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, RefreshCw, AlertTriangle, Mail, Send, DollarSign, Calendar } from 'lucide-react';
import { collectionsApi } from '../api/collections';
import { remindersApi } from '../api/reminders';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

const CollectionsPage = () => {
  const navigate = useNavigate();
  const [confirmRun, setConfirmRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [remindingId, setRemindingId] = useState(null);

  const {
    data: agingData,
    isLoading: agingLoading,
    refetch: refetchAging,
  } = useQuery({
    queryKey: ['collections-aging'],
    queryFn: () => collectionsApi.getAging().then((r) => r.data?.data),
  });

  const {
    data: reminderData,
    isLoading: reminderLoading,
    refetch: refetchReminders,
  } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => remindersApi.list({ limit: 20 }).then((r) => r.data),
  });

  const buckets = agingData?.buckets || {
    '1-7': { count: 0, amount: 0 },
    '8-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '60+': { count: 0, amount: 0 },
  };

  const overdueInvoices = agingData?.invoices || [];
  const reminderLogs = reminderData?.data || [];

  const handleRunReminders = async () => {
    setConfirmRun(false);
    setRunning(true);
    try {
      const res = await remindersApi.trigger();
      const sent = res.data?.data?.sent ?? 0;
      toast.success(`Reminder campaign complete — ${sent} email(s) sent`);
      refetchAging();
      refetchReminders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reminder run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleSendSingleReminder = async (invoiceId) => {
    setRemindingId(invoiceId);
    try {
      const res = await collectionsApi.remindInvoice(invoiceId);
      toast.success(res.data?.message || 'Reminder email sent successfully');
      refetchAging();
      refetchReminders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  };

  const overdueColumns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (v, row) => (
        <button
          onClick={() => navigate(`/invoices/${row._id}`)}
          className="font-mono text-xs font-semibold text-indigo-700 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
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
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (v) => <span className="text-red-600 font-medium">{fmtDate(v)}</span>,
    },
    {
      key: 'daysOverdue',
      label: 'Aging',
      render: (v) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            v > 60
              ? 'bg-red-100 text-red-800'
              : v > 30
              ? 'bg-amber-100 text-amber-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {v} day{v === 1 ? '' : 's'}
        </span>
      ),
    },
    { key: 'total', label: 'Total', render: (v) => fmt(v) },
    {
      key: 'balance',
      label: 'Balance Due',
      render: (v) => <span className="font-bold text-red-700">{fmt(v)}</span>,
    },
    {
      key: 'lastReminderSentAt',
      label: 'Last Reminder',
      render: (v) => (
        <span className="text-xs text-gray-500">
          {v ? fmtDate(v) : <span className="text-gray-400 italic">None</span>}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSendSingleReminder(row._id)}
            disabled={remindingId === row._id}
            title="Send payment reminder email"
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition flex items-center gap-1 text-xs font-medium border border-indigo-200"
          >
            {remindingId === row._id ? <Spinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
            Remind
          </button>
          <button
            onClick={() => navigate(`/invoices/${row._id}`)}
            title="Record payment"
            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded transition flex items-center gap-1 text-xs font-medium border border-emerald-200"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Pay
          </button>
        </div>
      ),
    },
  ];

  const reminderColumns = [
    {
      key: 'invoice',
      label: 'Invoice',
      render: (v, row) => (
        <span className="font-mono text-xs font-medium text-gray-800">
          {row.invoice?.number || String(v || '').slice(-6)}
        </span>
      ),
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (v) => <span className="capitalize text-xs font-medium">{v || 'email'}</span>,
    },
    {
      key: 'recipient',
      label: 'Sent To',
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
    { key: 'sentAt', label: 'Sent At', render: (v) => fmtDate(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v || 'sent'} /> },
    {
      key: 'previewUrl',
      label: 'Preview',
      render: (v) =>
        v ? (
          <a
            href={v}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 text-xs font-semibold underline hover:text-indigo-800"
          >
            View Email
          </a>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections Cockpit"
        subtitle="Aging buckets, overdue invoice management, and automated dunning reminders"
        action={
          <button
            onClick={() => setConfirmRun(true)}
            disabled={running || agingLoading}
            className="btn-primary flex items-center gap-2 text-sm shadow-sm"
          >
            {running ? <Spinner size="sm" /> : <Mail className="w-4 h-4" />}
            Run Dunning Reminders
          </button>
        }
      />

      {/* 4 Overdue Aging Buckets */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Overdue Aging Buckets
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="1–7 Days Overdue"
            value={fmt(buckets['1-7'].amount)}
            subtext={`${buckets['1-7'].count} invoice(s)`}
            icon={Bell}
            color="yellow"
          />
          <StatCard
            title="8–30 Days Overdue"
            value={fmt(buckets['8-30'].amount)}
            subtext={`${buckets['8-30'].count} invoice(s)`}
            icon={AlertTriangle}
            color="amber"
          />
          <StatCard
            title="31–60 Days Overdue"
            value={fmt(buckets['31-60'].amount)}
            subtext={`${buckets['31-60'].count} invoice(s)`}
            icon={AlertTriangle}
            color="orange"
          />
          <StatCard
            title="60+ Days Overdue"
            value={fmt(buckets['60+'].amount)}
            subtext={`${buckets['60+'].count} invoice(s)`}
            icon={AlertTriangle}
            color="red"
          />
        </div>
      </div>

      {/* Overdue invoices table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Overdue Invoices Requiring Action (
            {overdueInvoices.length})
          </h2>
          <span className="text-xs font-semibold text-gray-500">
            Total Outstanding: <span className="text-red-700 font-bold">{fmt(agingData?.totalOverdue?.amount || 0)}</span>
          </span>
        </div>
        <DataTable
          columns={overdueColumns}
          data={overdueInvoices}
          loading={agingLoading}
          emptyMessage="No overdue invoices found — all accounts are current!"
        />
      </div>

      {/* Reminder audit log */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-indigo-500" /> Recent Dunning Reminder Logs
        </h2>
        <DataTable
          columns={reminderColumns}
          data={reminderLogs}
          loading={reminderLoading}
          emptyMessage="No reminders logged yet"
        />
      </div>

      <ConfirmDialog
        open={confirmRun}
        title="Run Dunning Reminder Campaign"
        message="This will scan all overdue invoices and send reminder emails to customers whose invoices have not been reminded in the last 3 days. Proceed?"
        confirmLabel="Send Reminders"
        onConfirm={handleRunReminders}
        onCancel={() => setConfirmRun(false)}
      />
    </div>
  );
};

export default CollectionsPage;
