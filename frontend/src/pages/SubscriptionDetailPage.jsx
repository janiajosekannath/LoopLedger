import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Play, Pause, XCircle, RotateCcw,
  CheckCircle, ShieldAlert, Calendar, CreditCard, ExternalLink
} from 'lucide-react';
import { subscriptionsApi } from '../api/subscriptions';
import { historyApi } from '../api/history';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const STEPS = ['draft', 'quotation', 'confirmed', 'active', 'closed'];

const SubscriptionDetailPage = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => subscriptionsApi.get(id).then((r) => r.data.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ['subscription-history', id],
    queryFn: () => historyApi.getHistory('subscription', id).then((r) => r.data.data),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', id] });
    queryClient.invalidateQueries({ queryKey: ['subscription-history', id] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  };

  const activateMutation = useMutation({
    mutationFn: () => subscriptionsApi.activate(id),
    onSuccess: () => {
      refresh();
      toast.success('Subscription activated! Next billing schedule set.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to activate'),
  });

  const pauseMutation = useMutation({
    mutationFn: () => subscriptionsApi.pause(id, 'Paused by admin/staff'),
    onSuccess: () => {
      refresh();
      setPauseModalOpen(false);
      toast.success('Subscription paused');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to pause'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => subscriptionsApi.resume(id, 'Resumed by admin/staff'),
    onSuccess: () => {
      refresh();
      toast.success('Subscription resumed and active');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to resume'),
  });

  const closeMutation = useMutation({
    mutationFn: () => subscriptionsApi.close(id, 'Closed by admin/staff'),
    onSuccess: () => {
      refresh();
      setCloseModalOpen(false);
      toast.success('Subscription closed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to close'),
  });

  const renewMutation = useMutation({
    mutationFn: () => subscriptionsApi.renew(id, 12),
    onSuccess: () => {
      refresh();
      setRenewModalOpen(false);
      toast.success('Subscription renewed for 12 months');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to renew'),
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
        <Link to="/sales/subscriptions" className="btn-secondary">
          Back to Subscriptions
        </Link>
      </div>
    );
  }

  const plan = subscription.plan || {};
  const isEarlyClose =
    subscription.expiryDate && new Date() < new Date(subscription.expiryDate);
  const earlyCloseForbidden = isEarlyClose && plan.allowEarlyClose === false;

  // Visual Stepper index
  let activeStepIndex = STEPS.indexOf(subscription.status);
  if (subscription.status === 'paused') activeStepIndex = 3; // treat paused alongside active in lifecycle

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/sales/subscriptions"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Subscriptions
        </Link>
      </div>

      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{subscription.number}</span>
            <StatusBadge status={subscription.status} />
          </div>
        }
        subtitle={`Started on ${new Date(subscription.startDate).toLocaleDateString('en-IN')}`}
        actions={
          <div className="flex items-center gap-2">
            {['draft', 'quotation', 'confirmed'].includes(subscription.status) && (
              <button
                onClick={() => activateMutation.mutate()}
                className="btn-primary"
                disabled={activateMutation.isPending}
              >
                <Play className="w-4 h-4" />
                Activate
              </button>
            )}

            {subscription.status === 'active' && (
              <button
                onClick={() => setPauseModalOpen(true)}
                disabled={plan.allowPause === false}
                className="btn-secondary"
                title={plan.allowPause === false ? 'Plan policy blocks pause' : 'Pause subscription'}
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}

            {subscription.status === 'paused' && (
              <button
                onClick={() => resumeMutation.mutate()}
                className="btn-primary"
                disabled={resumeMutation.isPending}
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}

            {['active', 'paused'].includes(subscription.status) && (
              <button
                onClick={() => setCloseModalOpen(true)}
                disabled={earlyCloseForbidden}
                className="btn-danger"
                title={earlyCloseForbidden ? 'Plan blocks early closure before expiry' : 'Close contract'}
              >
                <XCircle className="w-4 h-4" />
                Close
              </button>
            )}

            <button
              onClick={() => setRenewModalOpen(true)}
              disabled={plan.allowRenew === false}
              className="btn-secondary"
              title={plan.allowRenew === false ? 'Plan blocks renewal' : 'Extend contract'}
            >
              <RotateCcw className="w-4 h-4" />
              Renew
            </button>
          </div>
        }
      />

      {/* Lifecycle Visual Stepper */}
      <div className="card mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Subscription Lifecycle Status
        </p>
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-gray-200 z-0" />
          {STEPS.map((step, idx) => {
            const isCompleted = idx <= activeStepIndex && subscription.status !== 'closed';
            const isCurrent = step === subscription.status;
            return (
              <div key={step} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span className="text-xs font-medium capitalize text-gray-700 mt-2">
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Metric & Policy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Normalized MRR</p>
          <p className="text-2xl font-bold text-green-700">₹{subscription.mrr?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-400 mt-1">ARR: ₹{(subscription.mrr * 12)?.toLocaleString('en-IN')}</p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Billing Schedule</p>
          <p className="font-bold text-gray-900 text-base capitalize">{plan.billingPeriod || 'Monthly'}</p>
          <p className="text-xs text-gray-500 mt-1">
            Next invoice:{' '}
            <span className="font-semibold text-slate-800">
              {subscription.nextBillingDate
                ? new Date(subscription.nextBillingDate).toLocaleDateString('en-IN')
                : 'Not scheduled'}
            </span>
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer</p>
          <p className="font-bold text-gray-900 text-base">{subscription.customer?.name}</p>
          <p className="text-xs text-gray-500">{subscription.customer?.company || subscription.customer?.email}</p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contract Validity</p>
          <p className="font-bold text-gray-900 text-base">
            {subscription.expiryDate
              ? new Date(subscription.expiryDate).toLocaleDateString('en-IN')
              : 'Ongoing'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Payment Terms: {subscription.paymentTerms?.toUpperCase() || 'IMMEDIATE'}
          </p>
        </div>
      </div>

      {/* Plan Policies Enforced */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Enforced Plan Policies & Flags</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-gray-600">Pause Permitted:</span>
            <span
              className={`font-semibold ${
                plan.allowPause !== false ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {plan.allowPause !== false ? 'Allowed' : 'Blocked'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-gray-600">Early Close Permitted:</span>
            <span
              className={`font-semibold ${
                plan.allowEarlyClose !== false ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {plan.allowEarlyClose !== false ? 'Allowed' : 'Blocked'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-gray-600">Renew Permitted:</span>
            <span
              className={`font-semibold ${
                plan.allowRenew !== false ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {plan.allowRenew !== false ? 'Allowed' : 'Blocked'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-gray-600">Auto-Close on Expiry:</span>
            <span
              className={`font-semibold ${
                plan.autoClose ? 'text-indigo-700' : 'text-gray-500'
              }`}
            >
              {plan.autoClose ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Subscription Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Product / Service</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Tax (GST)</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {subscription.lines?.map((line, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {line.product?.name || line.description || 'Product Item'}
                    </p>
                    {line.variant && (
                      <p className="text-xs text-indigo-600">
                        {line.variant.attribute}: {line.variant.value} (+₹{line.variant.extraPrice})
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    ₹{line.unitPrice?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-900 font-semibold">
                    {line.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">
                    {line.discountAmount > 0
                      ? `-₹${line.discountAmount.toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ₹{line.taxAmount?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ₹{line.amount?.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Box */}
        <div className="flex justify-end mt-4">
          <div className="w-full sm:w-72 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>₹{subscription.subtotal?.toLocaleString('en-IN')}</span>
            </div>
            {subscription.discountTotal > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discounts:</span>
                <span>-₹{subscription.discountTotal?.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Taxes:</span>
              <span>₹{subscription.taxTotal?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-1.5">
              <span>Cycle Total:</span>
              <span>₹{subscription.total?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Lifecycle Audit Timeline</h3>
        <Timeline events={historyData || []} />
      </div>

      {/* Pause Dialog */}
      <ConfirmDialog
        open={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        onConfirm={() => pauseMutation.mutate()}
        title="Pause Subscription"
        message="Pausing halts automated recurring billing runs until resumed. Are you sure you want to pause?"
        confirmLabel="Pause Contract"
        variant="warning"
        loading={pauseMutation.isPending}
      />

      {/* Close Dialog */}
      <ConfirmDialog
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Close Subscription"
        message="Closing permanently deactivates this contract and records MRR churn. Are you sure?"
        confirmLabel="Close Subscription"
        variant="danger"
        loading={closeMutation.isPending}
      />

      {/* Renew Dialog */}
      <ConfirmDialog
        open={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onConfirm={() => renewMutation.mutate()}
        title="Renew Subscription Contract"
        message="This extends the subscription expiry date by 12 months. Confirm renewal?"
        confirmLabel="Renew 12 Months"
        variant="primary"
        loading={renewMutation.isPending}
      />
    </div>
  );
};

export default SubscriptionDetailPage;
