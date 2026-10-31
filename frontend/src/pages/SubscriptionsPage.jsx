import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, PauseCircle, XCircle, Clock } from 'lucide-react';
import { subscriptionsApi } from '../api/subscriptions';
import { catalogApi } from '../api/catalog';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';

const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [billingPeriodFilter, setBillingPeriodFilter] = useState('');

  const { data: plansData } = useQuery({
    queryKey: ['plans-all'],
    queryFn: () => catalogApi.listPlans({ limit: 100 }).then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'subscriptions',
      page,
      search,
      statusFilter,
      planFilter,
      billingPeriodFilter,
    ],
    queryFn: () =>
      subscriptionsApi
        .list({
          page,
          limit: 10,
          search,
          status: statusFilter || undefined,
          plan: planFilter || undefined,
          billingPeriod: billingPeriodFilter || undefined,
        })
        .then((r) => r.data),
  });

  const activeCount = data?.data?.filter((s) => s.status === 'active').length || 0;
  const pausedCount = data?.data?.filter((s) => s.status === 'paused').length || 0;
  const closedCount = data?.data?.filter((s) => s.status === 'closed').length || 0;

  const columns = [
    {
      key: 'number',
      label: 'Subscription #',
      render: (val) => (
        <span className="font-semibold text-indigo-600 hover:underline">
          {val}
        </span>
      ),
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
      key: 'plan',
      label: 'Plan & Cycle',
      render: (val) => (
        <div>
          <p className="font-medium text-gray-900">{val?.name || '—'}</p>
          <span className="inline-flex text-xs text-slate-500 capitalize">
            {val?.billingPeriod}
          </span>
        </div>
      ),
    },
    {
      key: 'mrr',
      label: 'MRR',
      render: (val) => (
        <span className="font-semibold text-green-700">
          ₹{val?.toLocaleString('en-IN') || 0}/mo
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'nextBillingDate',
      label: 'Next Invoice',
      render: (val, row) => {
        if (row.status !== 'active') return '—';
        if (!val) return 'Due';
        const d = new Date(val);
        const isPast = d <= new Date();
        return (
          <span className={`text-xs ${isPast ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
            {d.toLocaleDateString('en-IN')}
          </span>
        );
      },
    },
    {
      key: 'expiryDate',
      label: 'Expiry',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : 'Ongoing'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Active recurring contracts, customer seats, renewals, and lifecycle controls"
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Active Subscriptions"
          value={activeCount}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Paused Contracts"
          value={pausedCount}
          icon={PauseCircle}
          color="yellow"
        />
        <StatCard
          title="Closed / Churned"
          value={closedCount}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Filter Bar */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search subscription number (SUB-...)..."
            className="w-full md:w-64"
          />

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select
              className="input w-auto text-xs"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="confirmed">Confirmed (Pending Activation)</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>

            <select
              className="input w-auto text-xs"
              value={billingPeriodFilter}
              onChange={(e) => {
                setBillingPeriodFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Cycles</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>

            <select
              className="input w-auto text-xs"
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Plans</option>
              {plansData?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          emptyMessage="No subscriptions match your criteria."
          onRowClick={(row) => navigate(`/sales/subscriptions/${row._id}`)}
        />

        <Pagination
          page={page}
          totalPages={data?.meta?.totalPages || 1}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default SubscriptionsPage;
