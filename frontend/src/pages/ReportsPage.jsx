import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, BarChart3, Users, DollarSign,
  RefreshCw, ChevronDown,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { reportsApi } from '../api/reports';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtNum = (n) =>
  new Intl.NumberFormat('en-IN').format(n || 0);

const TABS = [
  { id: 'waterfall', label: 'MRR Waterfall', icon: TrendingUp },
  { id: 'revenue', label: 'Revenue Collected', icon: DollarSign },
  { id: 'churn', label: 'Churn Analysis', icon: Users },
];

const RANGE_OPTIONS = [
  { label: '6 Months', value: 6 },
  { label: '12 Months', value: 12 },
  { label: '24 Months', value: 24 },
];

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-gray-600 capitalize">{p.name}</span>
          </span>
          <span className="font-medium text-gray-900">
            {typeof p.value === 'number' && p.value > 100
              ? fmt(p.value)
              : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ───────────────────────────────────────────────────────────────

const KpiCard = ({ title, value, sub, color = 'indigo', icon: Icon }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

// ─── Waterfall Tab ──────────────────────────────────────────────────────────

const WaterfallTab = ({ months }) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mrr-waterfall', months],
    queryFn: () => reportsApi.mrrWaterfall(months),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <div className="text-center py-10 text-red-500 text-sm">Failed to load waterfall data.</div>;

  const rows = data?.data || [];
  const latestMrr = rows[rows.length - 1]?.mrr || 0;
  const latestArr = rows[rows.length - 1]?.arr || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <KpiCard title="Current MRR" value={fmt(latestMrr)} sub="Monthly recurring revenue" color="indigo" icon={TrendingUp} />
        <KpiCard title="Current ARR" value={fmt(latestArr)} sub="Annualised run rate" color="blue" icon={BarChart3} />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">MRR Trend (last {months} months)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="mrr" name="MRR" stroke="#6366f1" fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">MRR Movement (New / Expansion / Churn)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="new" name="New MRR" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expansion" name="Expansion" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="churn" name="Churn" fill="#f43f5e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─── Revenue Tab ─────────────────────────────────────────────────────────────

const RevenueTab = ({ months }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['revenue-breakdown', months],
    queryFn: () => reportsApi.revenue(months),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <div className="text-center py-10 text-red-500 text-sm">Failed to load revenue data.</div>;

  const rows = data?.data || [];
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalInvoices = rows.reduce((s, r) => s + r.invoiceCount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard title="Total Collected" value={fmt(totalRevenue)} sub={`Over last ${months} months`} color="green" icon={DollarSign} />
        <KpiCard title="Invoices Paid" value={fmtNum(totalInvoices)} sub="Across selected period" color="purple" icon={BarChart3} />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Collected Revenue</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" name="Revenue" fill="url(#revGrad)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Monthly Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-5 py-2.5 text-left font-medium">Period</th>
                <th className="px-5 py-2.5 text-right font-medium">Invoices</th>
                <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...rows].reverse().map((r) => (
                <tr key={r.period} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-2.5 text-gray-700">{r.label}</td>
                  <td className="px-5 py-2.5 text-right text-gray-600">{fmtNum(r.invoiceCount)}</td>
                  <td className="px-5 py-2.5 text-right font-medium text-emerald-700">{fmt(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Churn Tab ───────────────────────────────────────────────────────────────

const ChurnTab = ({ months }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['churn-analysis', months],
    queryFn: () => reportsApi.churn(months),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <div className="text-center py-10 text-red-500 text-sm">Failed to load churn data.</div>;

  const rows = data?.data || [];
  const totalNew = rows.reduce((s, r) => s + r.new, 0);
  const totalChurned = rows.reduce((s, r) => s + r.churned, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard title="New Subscriptions" value={fmtNum(totalNew)} sub={`Last ${months} months`} color="green" icon={Users} />
        <KpiCard title="Churned" value={fmtNum(totalChurned)} sub={`Last ${months} months`} color="red" icon={Users} />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Subscription Growth vs Churn</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="new" name="New" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="churned" name="Churned" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="net" name="Net" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('waterfall');
  const [months, setMonths] = useState(12);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: reportsApi.summary,
    staleTime: 60_000,
  });

  const summary = summaryData?.data || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="MRR waterfall, revenue trends, and churn metrics"
        actions={
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="relative">
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        }
      />

      {/* KPI summary strip */}
      {summaryLoading ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: 'MRR', value: fmt(summary.mrr), color: 'indigo', icon: TrendingUp },
            { title: 'ARR', value: fmt(summary.arr), color: 'blue', icon: BarChart3 },
            { title: 'Active Subs', value: fmtNum(summary.activeSubscriptions), color: 'green', icon: Users },
            { title: 'ARPU', value: fmt(summary.arpu), color: 'purple', icon: DollarSign },
            { title: 'Churn Rate', value: `${summary.churnRate ?? 0}%`, color: 'yellow', icon: RefreshCw },
            { title: 'Overdue', value: fmtNum(summary.overdueCount), color: 'red', icon: BarChart3 },
          ].map((k) => (
            <div key={k.title} className="card py-3 px-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-400">
                <k.icon className="w-3.5 h-3.5" />
                <span className="text-xs">{k.title}</span>
              </div>
              <p className="text-base font-bold text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Report tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'waterfall' && <WaterfallTab months={months} />}
        {activeTab === 'revenue' && <RevenueTab months={months} />}
        {activeTab === 'churn' && <ChurnTab months={months} />}
      </div>
    </div>
  );
};

export default ReportsPage;
