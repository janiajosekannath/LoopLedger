import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { quotationsApi } from '../api/quotations';
import { historyApi } from '../api/history';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const QuotationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationsApi.get(id).then((r) => r.data.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ['quotation-history', id],
    queryFn: () => historyApi.getHistory('quotation', id).then((r) => r.data.data),
    enabled: Boolean(id),
  });

  const sendMutation = useMutation({
    mutationFn: () => quotationsApi.updateStatus(id, 'quotation', 'Sent proposal to customer'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotation-history', id] });
      toast.success('Quotation marked as sent');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => quotationsApi.confirm(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation confirmed and subscription created!');
      setConfirmModalOpen(false);
      navigate(`/sales/subscriptions/${res.data.data.subscription._id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to confirm quotation');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 font-semibold mb-2">Quotation not found</p>
        <Link to="/sales/quotations" className="btn-secondary">
          Back to Quotations
        </Link>
      </div>
    );
  }

  const isExpired = quotation.validUntil && new Date(quotation.validUntil) < new Date();
  const canConfirm = quotation.status !== 'confirmed' && !isExpired;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/sales/quotations"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quotations
        </Link>
      </div>

      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{quotation.number}</span>
            <StatusBadge status={quotation.status} />
            {isExpired && quotation.status !== 'confirmed' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Expired
              </span>
            )}
          </div>
        }
        subtitle={`Created on ${new Date(quotation.createdAt).toLocaleDateString('en-IN')}`}
        actions={
          <div className="flex items-center gap-2">
            {quotation.status === 'draft' && (
              <button
                onClick={() => sendMutation.mutate()}
                className="btn-secondary"
                disabled={sendMutation.isPending}
              >
                <Send className="w-4 h-4" />
                {sendMutation.isPending ? 'Updating...' : 'Mark as Sent'}
              </button>
            )}

            {canConfirm && (
              <button
                onClick={() => setConfirmModalOpen(true)}
                className="btn-primary"
                disabled={confirmMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Create Subscription
              </button>
            )}

            {quotation.subscription && (
              <Link
                to={`/sales/subscriptions/${quotation.subscription._id || quotation.subscription}`}
                className="btn-secondary"
              >
                <ExternalLink className="w-4 h-4" />
                View Subscription
              </Link>
            )}
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</p>
          <p className="font-bold text-gray-900 text-base">{quotation.customer?.name}</p>
          <p className="text-sm text-gray-600">{quotation.customer?.company || 'Individual Account'}</p>
          <p className="text-xs text-gray-400 mt-1">{quotation.customer?.email}</p>
          {quotation.customer?.phone && (
            <p className="text-xs text-gray-400">{quotation.customer?.phone}</p>
          )}
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Plan Details</p>
          {quotation.plan ? (
            <>
              <p className="font-bold text-gray-900 text-base">{quotation.plan.name}</p>
              <p className="text-sm text-gray-600 capitalize">
                Billing Cycle: <span className="font-medium text-slate-800">{quotation.plan.billingPeriod}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Base Price: ₹{quotation.plan.price}</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Custom Order (No fixed plan assigned)</p>
          )}
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Proposal Validity</p>
          <p className="font-bold text-gray-900 text-base">
            {quotation.validUntil
              ? new Date(quotation.validUntil).toLocaleDateString('en-IN')
              : 'Open'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Status:{' '}
            <span
              className={`font-semibold capitalize ${
                isExpired ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {isExpired ? 'Expired' : 'Active'}
            </span>
          </p>
          {quotation.createdBy && (
            <p className="text-xs text-gray-400 mt-2">
              Created by: {quotation.createdBy.name}
            </p>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Product / Service</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Tax (GST)</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.lines?.map((line, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {line.product?.name || line.productName || 'Product'}
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
                    {line.taxPercent ? ` (${line.taxPercent}%)` : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ₹{line.amount?.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pricing Summary */}
        <div className="flex justify-end mt-6">
          <div className="w-full sm:w-80 space-y-2 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal:</span>
              <span>₹{quotation.subtotal?.toLocaleString('en-IN')}</span>
            </div>
            {quotation.discountTotal > 0 && (
              <div className="flex justify-between text-sm text-green-700 font-medium">
                <span>Total Discounts:</span>
                <span>-₹{quotation.discountTotal?.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>Total Taxes (GST):</span>
              <span>₹{quotation.taxTotal?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Grand Total:</span>
              <span>₹{quotation.total?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Lifecycle Audit Timeline</h3>
        <Timeline events={historyData || []} />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => confirmMutation.mutate()}
        title="Confirm Quotation & Activate Subscription"
        message="Are you sure you want to confirm this quotation? A permanent Subscription document (SUB-xxxxxx) will be generated and linked immediately."
        confirmLabel="Confirm & Generate Subscription"
        variant="primary"
        loading={confirmMutation.isPending}
      />
    </div>
  );
};

export default QuotationDetailPage;
