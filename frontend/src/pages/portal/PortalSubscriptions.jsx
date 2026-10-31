import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '../../api/subscriptions';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';

const PortalSubscriptions = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-subscriptions', page],
    queryFn: () => subscriptionsApi.list({ page, limit: 10 }).then((r) => r.data),
  });

  const columns = [
    {
      key: 'number',
      label: 'Subscription #',
      render: (val) => <span className="font-semibold text-indigo-600 hover:underline">{val}</span>,
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (val) => (
        <div>
          <p className="font-medium text-gray-900">{val?.name || 'Subscription'}</p>
          <span className="text-xs text-gray-500 capitalize">{val?.billingPeriod}</span>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Rate / Cycle',
      render: (val) => <span className="font-semibold text-gray-900">₹{val?.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'nextBillingDate',
      label: 'Next Invoice',
      render: (val, row) =>
        row.status === 'active' && val
          ? new Date(val).toLocaleDateString('en-IN')
          : '—',
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Subscriptions"
        subtitle="Review active plans, renewal dates, and contract details"
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          emptyMessage="You have no active or historical subscriptions."
          onRowClick={(row) => navigate(`/portal/subscriptions/${row._id}`)}
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

export default PortalSubscriptions;
