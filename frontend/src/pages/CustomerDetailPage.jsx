import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building, Mail, Phone, MapPin, Calendar, CreditCard,
  ReceiptText, FileText, Banknote, Edit2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { customersApi } from '../api/customers';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { toast } from '../components/Toast';

const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('subscriptions');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({});

  // 1. Fetch Customer Details
  const {
    data: customerData,
    isLoading: customerLoading,
    isError: customerError,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id).then((res) => res.data),
  });

  const customer = customerData?.data;

  // 2. Fetch Customer Subscriptions
  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['customer-subscriptions', id],
    queryFn: () => customersApi.getSubscriptions(id).then((res) => res.data),
    enabled: !!id,
  });
  const subscriptions = subsData?.data || [];

  // 3. Fetch Customer Invoices
  const { data: invData, isLoading: invLoading } = useQuery({
    queryKey: ['customer-invoices', id],
    queryFn: () => customersApi.getInvoices(id).then((res) => res.data),
    enabled: !!id,
  });
  const invoices = invData?.data || [];

  // 4. Fetch Customer Payments
  const { data: payData, isLoading: payLoading } = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: () => customersApi.getPayments(id).then((res) => res.data),
    enabled: !!id,
  });
  const payments = payData?.data || [];

  // Update Customer Mutation
  const updateMutation = useMutation({
    mutationFn: (updates) => customersApi.update(id, updates),
    onSuccess: () => {
      toast.success('Customer profile updated');
      queryClient.invalidateQueries(['customer', id]);
      setEditModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    },
  });

  const openEdit = () => {
    setFormData({
      name: customer?.name || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      company: customer?.company || '',
      address: {
        line1: customer?.address?.line1 || '',
        line2: customer?.address?.line2 || '',
        city: customer?.address?.city || '',
        state: customer?.address?.state || '',
        pincode: customer?.address?.pincode || '',
        country: customer?.address?.country || 'India',
      },
    });
    setEditModalOpen(true);
  };

  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (customerLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="card text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Customer Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">The customer account you requested does not exist or was removed.</p>
        <button onClick={() => navigate('/customers')} className="btn-secondary">
          Back to Customers
        </button>
      </div>
    );
  }

  // Calculated Stats
  const totalPaidSum = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOutstandingBalance = invoices
    .filter((inv) => inv.status === 'confirmed')
    .reduce((sum, inv) => sum + (inv.balance || 0), 0);

  // Table Columns
  const subscriptionColumns = [
    {
      key: 'number',
      label: 'Subscription #',
      render: (val, row) => (
        <Link
          to={`/sales/subscriptions/${row._id}`}
          className="font-medium text-indigo-600 hover:text-indigo-800"
        >
          {val || 'SUB-DRAFT'}
        </Link>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (val) => val?.name || 'Custom Plan',
    },
    {
      key: 'billingPeriod',
      label: 'Billing Cycle',
      render: (_, row) => (
        <span className="capitalize text-xs text-gray-600 font-medium">
          {row.plan?.billingPeriod || 'monthly'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'nextBillingDate',
      label: 'Next Billing',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'total',
      label: 'Amount (₹)',
      render: (val) => `₹${(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
  ];

  const invoiceColumns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (val, row) => (
        <Link
          to={`/billing/invoices/${row._id}`}
          className="font-medium text-indigo-600 hover:text-indigo-800"
        >
          {val}
        </Link>
      ),
    },
    {
      key: 'issueDate',
      label: 'Issue Date',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => {
        const isOverdue =
          val === 'confirmed' &&
          row.balance > 0 &&
          row.dueDate &&
          new Date(row.dueDate) < new Date();
        return <StatusBadge status={isOverdue ? 'overdue' : val} />;
      },
    },
    {
      key: 'total',
      label: 'Total (₹)',
      render: (val) => `₹${(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'balance',
      label: 'Balance Due (₹)',
      render: (val) => (
        <span className={val > 0 ? 'font-semibold text-red-600' : 'text-gray-500'}>
          ₹{(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  const paymentColumns = [
    {
      key: 'number',
      label: 'Payment #',
      render: (val) => <span className="font-medium text-gray-900">{val}</span>,
    },
    {
      key: 'invoice',
      label: 'Invoice #',
      render: (val) => (
        val?.number ? (
          <Link to={`/billing/invoices/${val._id}`} className="text-indigo-600 hover:underline">
            {val.number}
          </Link>
        ) : '—'
      ),
    },
    {
      key: 'method',
      label: 'Payment Method',
      render: (val) => (
        <span className="capitalize text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
          {val ? val.replace('_', ' ') : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount Paid (₹)',
      render: (val) => (
        <span className="font-semibold text-green-700">
          ₹{(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'paidOn',
      label: 'Paid On',
      render: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'note',
      label: 'Note / Ref',
      render: (val) => <span className="text-xs text-gray-500">{val || '—'}</span>,
    },
  ];

  return (
    <div>
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Customers
        </button>
      </div>

      {/* Header Profile Card */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center flex-shrink-0 shadow-md">
              {customer.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                {customer.user ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Portal Account Active
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                    No Portal Login
                  </span>
                )}
              </div>

              {customer.company && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{customer.company}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 mt-3">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {customer.email}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {customer.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Joined {new Date(customer.registeredAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <button onClick={openEdit} className="btn-secondary flex items-center gap-2 self-start">
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        </div>

        {/* Address Banner */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <span>
            {[
              customer.address?.line1,
              customer.address?.line2,
              customer.address?.city,
              customer.address?.state,
              customer.address?.pincode,
              customer.address?.country,
            ]
              .filter(Boolean)
              .join(', ') || 'No physical billing address registered.'}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subscriptions
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {subscriptions.length}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Invoiced
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {invoices.length} <span className="text-xs font-normal text-gray-500">inv.</span>
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue Collected
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                ₹{totalPaidSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          Subscriptions ({subscriptions.length})
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Banknote className="w-4 h-4" />
          Payments ({payments.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="card p-0 overflow-hidden">
        {activeTab === 'subscriptions' && (
          <DataTable
            columns={subscriptionColumns}
            data={subscriptions}
            loading={subsLoading}
            emptyMessage="No subscriptions created for this customer yet."
            onRowClick={(row) => navigate(`/sales/subscriptions/${row._id}`)}
          />
        )}

        {activeTab === 'invoices' && (
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            loading={invLoading}
            emptyMessage="No invoices generated for this customer yet."
            onRowClick={(row) => navigate(`/billing/invoices/${row._id}`)}
          />
        )}

        {activeTab === 'payments' && (
          <DataTable
            columns={paymentColumns}
            data={payments}
            loading={payLoading}
            emptyMessage="No payment records found for this customer."
          />
        )}
      </div>

      {/* Edit Customer Profile Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Customer Profile"
        size="lg"
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required>
              <input
                type="text"
                className="input"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Email Address" required>
              <input
                type="email"
                className="input"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Company Name">
              <input
                type="text"
                className="input"
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </FormField>

            <FormField label="Phone Number">
              <input
                type="tel"
                className="input"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Billing Address
            </h3>
            <div className="space-y-3">
              <FormField label="Address Line 1">
                <input
                  type="text"
                  className="input"
                  value={formData.address?.line1 || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, line1: e.target.value },
                    })
                  }
                />
              </FormField>

              <FormField label="Address Line 2">
                <input
                  type="text"
                  className="input"
                  value={formData.address?.line2 || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, line2: e.target.value },
                    })
                  }
                />
              </FormField>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FormField label="City">
                  <input
                    type="text"
                    className="input"
                    value={formData.address?.city || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value },
                      })
                    }
                  />
                </FormField>

                <FormField label="State">
                  <input
                    type="text"
                    className="input"
                    value={formData.address?.state || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value },
                      })
                    }
                  />
                </FormField>

                <FormField label="Pincode">
                  <input
                    type="text"
                    className="input"
                    value={formData.address?.pincode || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, pincode: e.target.value },
                      })
                    }
                  />
                </FormField>

                <FormField label="Country">
                  <input
                    type="text"
                    className="input"
                    value={formData.address?.country || 'India'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, country: e.target.value },
                      })
                    }
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditModalOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerDetailPage;
