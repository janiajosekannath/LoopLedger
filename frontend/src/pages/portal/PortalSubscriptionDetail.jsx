import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, XCircle } from 'lucide-react';
import { subscriptionsApi } from '../../api/subscriptions';
import { historyApi } from '../../api/history';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';
import ConfirmDialog from '../../components/ConfirmDialog';
import Spinner from '../../components/Spinner';
import { toast } from '../../components/Toast';

const PortalSubscriptionDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [pauseOpen, setPauseOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['portal-subscription', id],
    queryFn: () => subscriptionsApi.get(id).then((r) => r.data.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ['portal-subscription-history', id],
    queryFn: () => historyApi.getHistory('subscription', id).then((r) => r.data.data),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-subscription', id] });
    queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
  };

  const pauseMutation = useMutation({
    mutationFn: () => subscriptionsApi.pause(id, 'Customer paused from portal'),
    onSuccess: () => {
      refresh();
      setPauseOpen(false);
      toast.success('Subscription paused');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to pause'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => subscriptionsApi.resume(id, 'Customer resumed from portal'),
    onSuccess: () => {
      refresh();
      toast.success('Subscription resumed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to resume'),
  });

  const closeMutation = useMutation({
    mutationFn: () => subscriptionsApi.close(id, 'Customer cancelled from portal'),
    onSuccess: () => {
      refresh();
      setCloseOpen(false);
      toast.success('Subscription cancelled');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to cancel'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 font-semibold mb-2">Subscription not found</p>
        <Link to="/portal/subscriptions" className="btn-secondary">
          Back to My Subscriptions
        </Link>
      </div>
    );
  }

  const plan = subscription.plan || {};
  const isEarlyClose =
    subscription.expiryDate && new Date() < new Date(subscription.expiryDate);
  const earlyCloseForbidden = isEarlyClose && plan.allowEarlyClose === false;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/portal/subscriptions"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Subscriptions
        </Link>
      </div>

      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{subscription.number}</span>
            <StatusBadge status={subscription.status} />
          </div>
        }
        subtitle={`${plan.name || 'Subscription'} (${plan.billingPeriod || 'monthly'})`}
        actions={
          <div className="flex items-center gap-2">
            {subscription.status === 'active' && (
              <button
                onClick={() => setPauseOpen(true)}
                disabled={plan.allowPause === false}
                className="btn-secondary text-xs"
                title={
                  plan.allowPause === false
                    ? 'Plan policy does not permit pausing'
                    : 'Pause your subscription'
                }
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            )}

            {subscription.status === 'paused' && (
              <button
                onClick={() => resumeMutation.mutate()}
                className="btn-primary text-xs"
                disabled={resumeMutation.isPending}
              >
                <Play className="w-3.5 h-3.5" />
                Resume
              </button>
            )}

            {['active', 'paused'].includes(subscription.status) && (
              <button
                onClick={() => setCloseOpen(true)}
                disabled={earlyCloseForbidden}
                className="btn-danger text-xs"
                title={
                  earlyCloseForbidden
                    ? 'Early cancellation is not allowed under your plan terms'
                    : 'Cancel subscription'
                }
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Plan
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Current Rate
          </p>
          <p className="text-2xl font-bold text-gray-900">
            ₹{subscription.total?.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1 capitalize">Billed {plan.billingPeriod}</p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Next Renewal / Invoice
          </p>
          <p className="font-bold text-gray-900 text-lg">
            {subscription.status === 'active' && subscription.nextBillingDate
              ? new Date(subscription.nextBillingDate).toLocaleDateString('en-IN')
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Automatic recurring billing</p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Contract Expiry
          </p>
          <p className="font-bold text-gray-900 text-lg">
            {subscription.expiryDate
              ? new Date(subscription.expiryDate).toLocaleDateString('en-IN')
              : 'Ongoing'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Terms: {subscription.paymentTerms}</p>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Included Plan Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {subscription.lines?.map((line, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {line.product?.name || line.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    ₹{line.unitPrice?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-900 font-semibold">
                    {line.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ₹{line.amount?.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Contract Timeline</h3>
        <Timeline events={historyData || []} />
      </div>

      <ConfirmDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        onConfirm={() => pauseMutation.mutate()}
        title="Pause Subscription"
        message="Are you sure you want to pause your subscription? Service access will be held until resumed."
        confirmLabel="Pause Plan"
        variant="warning"
        loading={pauseMutation.isPending}
      />

      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Cancel Subscription"
        message="Are you sure you want to cancel your subscription contract?"
        confirmLabel="Cancel Subscription"
        variant="danger"
        loading={closeMutation.isPending}
      />
    </div>
  );
};

export default PortalSubscriptionDetail;
