import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, ScrollText, Check, X, Calendar, AlertCircle,
  Clock, Shield, RefreshCw, PauseCircle, PlayCircle, Trash2
} from 'lucide-react';
import { plansApi, productsApi } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import { toast } from '../components/Toast';

const initialPlanForm = {
  name: '',
  product: '',
  price: '',
  billingPeriod: 'monthly',
  minQty: 1,
  availableFrom: '',
  availableTo: '',
  autoClose: false,
  allowEarlyClose: true,
  allowPause: true,
  allowRenew: true,
  active: true,
};

const PlansPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState(initialPlanForm);
  const [formErrors, setFormErrors] = useState({});

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);

  // Fetch Plans
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['plans', page, limit, search, periodFilter],
    queryFn: () =>
      plansApi
        .list({ page, limit, search, billingPeriod: periodFilter || undefined })
        .then((res) => res.data),
    keepPreviousData: true,
  });

  const plans = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

  // Fetch Products for dropdown
  const { data: prodsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsApi.list({ limit: 100 }).then((res) => res.data),
  });
  const products = prodsData?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newPlan) => plansApi.create(newPlan),
    onSuccess: () => {
      toast.success('Subscription plan created');
      queryClient.invalidateQueries(['plans']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create plan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => plansApi.update(id, updates),
    onSuccess: () => {
      toast.success('Subscription plan updated');
      queryClient.invalidateQueries(['plans']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => plansApi.toggle(id),
    onSuccess: (res) => {
      toast.success(`Plan ${res.data?.data?.active ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries(['plans']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => plansApi.delete(id),
    onSuccess: () => {
      toast.success('Plan deleted');
      queryClient.invalidateQueries(['plans']);
      setDeleteConfirmOpen(false);
      setPlanToDelete(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete plan');
    },
  });

  const openAddModal = () => {
    setEditingPlan(null);
    setFormData(initialPlanForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      product: plan.product?._id || plan.product,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      minQty: plan.minQty || 1,
      availableFrom: plan.availableFrom ? plan.availableFrom.split('T')[0] : '',
      availableTo: plan.availableTo ? plan.availableTo.split('T')[0] : '',
      autoClose: plan.autoClose || false,
      allowEarlyClose: plan.allowEarlyClose !== undefined ? plan.allowEarlyClose : true,
      allowPause: plan.allowPause !== undefined ? plan.allowPause : true,
      allowRenew: plan.allowRenew !== undefined ? plan.allowRenew : true,
      active: plan.active !== undefined ? plan.active : true,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlan(null);
    setFormData(initialPlanForm);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Plan name is required';
    if (!formData.product) errors.product = 'Product is required';
    if (formData.price === '' || Number(formData.price) < 0) {
      errors.price = 'Valid price is required';
    }
    if (formData.availableFrom && formData.availableTo) {
      if (new Date(formData.availableTo) < new Date(formData.availableFrom)) {
        errors.availableTo = 'availableTo must be after availableFrom';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: formData.name.trim(),
      product: formData.product,
      price: Number(formData.price),
      billingPeriod: formData.billingPeriod,
      minQty: Number(formData.minQty) || 1,
      availableFrom: formData.availableFrom ? new Date(formData.availableFrom).toISOString() : null,
      availableTo: formData.availableTo ? new Date(formData.availableTo).toISOString() : null,
      autoClose: formData.autoClose,
      allowEarlyClose: formData.allowEarlyClose,
      allowPause: formData.allowPause,
      allowRenew: formData.allowRenew,
      active: formData.active,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan._id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Plan Name',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">
              Product: {row.product?.name || '—'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'billingPeriod',
      label: 'Billing Cycle',
      render: (val) => (
        <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {val}
        </span>
      ),
    },
    {
      key: 'price',
      label: 'Price (₹)',
      render: (val, row) => (
        <div>
          <span className="font-bold text-gray-900">
            ₹{(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-gray-400 block">min qty: {row.minQty || 1}</span>
        </div>
      ),
    },
    {
      key: 'flags',
      label: 'Policy Flags',
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {row.autoClose && (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-purple-50 text-purple-700 border border-purple-200">
              Auto-Close
            </span>
          )}
          {row.allowPause ? (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Pause OK
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
              No Pause
            </span>
          )}
          {row.allowEarlyClose ? (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
              Early Close
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
              Locked
            </span>
          )}
          {row.allowRenew && (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-teal-50 text-teal-700 border border-teal-200">
              Renewable
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (val) => <StatusBadge status={val ? 'active' : 'inactive'} />,
    },
  ];

  if (isAdmin) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMutation.mutate(row._id)}
            title={row.active ? 'Disable' : 'Enable'}
            className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
              row.active
                ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                : 'border-green-200 text-green-700 hover:bg-green-50'
            }`}
          >
            {row.active ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setPlanToDelete(row);
              setDeleteConfirmOpen(true);
            }}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        subtitle="Configure billing periods, recurring rules, pause/renewal policies and seat minimums"
        actions={
          isAdmin && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Plan
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <SearchInput
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search plans by name..."
              className="w-full sm:w-72"
            />
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value);
                setPage(1);
              }}
              className="input w-40 text-xs"
            >
              <option value="">All Periods</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">
            Total {meta.total} plan{meta.total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div className="card p-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-red-500 text-sm">
            {error?.response?.data?.message || 'Failed to load plans'}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={plans}
              loading={isLoading}
              emptyMessage="No subscription plans match your search."
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Add / Edit Plan Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingPlan ? 'Edit Subscription Plan' : 'New Subscription Plan'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Plan Name" required error={formErrors.name}>
              <input
                type="text"
                className="input"
                placeholder="e.g. Enterprise Monthly Plan"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>

            <FormField label="Base Product" required error={formErrors.product}>
              <select
                className="input"
                value={formData.product}
                onChange={(e) => setFormData({ ...formData, product: e.target.value })}
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (Base ₹{p.salesPrice})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Price per Period (₹)" required error={formErrors.price}>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="e.g. 2500"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </FormField>

            <FormField label="Billing Period" required>
              <select
                className="input capitalize"
                value={formData.billingPeriod}
                onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
              >
                <option value="daily">Daily (normalized × 30)</option>
                <option value="weekly">Weekly (normalized × 52/12)</option>
                <option value="monthly">Monthly (normalized × 1)</option>
                <option value="yearly">Yearly (normalized / 12)</option>
              </select>
            </FormField>

            <FormField label="Minimum Quantity / Seats" hint="Enforced in pricing engine">
              <input
                type="number"
                min="1"
                className="input"
                value={formData.minQty}
                onChange={(e) => setFormData({ ...formData, minQty: e.target.value })}
              />
            </FormField>

            <FormField label="Availability Window" error={formErrors.availableTo}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="input text-xs"
                  placeholder="From"
                  value={formData.availableFrom}
                  onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                />
                <input
                  type="date"
                  className="input text-xs"
                  placeholder="To"
                  value={formData.availableTo}
                  onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                />
              </div>
            </FormField>
          </div>

          {/* Policy Flags Checklist */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Subscription Lifecycle Rules & Flags
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowPause}
                  onChange={(e) => setFormData({ ...formData, allowPause: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900 block">Allow Pause</span>
                  <span className="text-xs text-gray-400">Customer or staff can pause billing</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoClose}
                  onChange={(e) => setFormData({ ...formData, autoClose: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900 block">Auto-Close on Expiry</span>
                  <span className="text-xs text-gray-400">Daily cron terminates past-expiry contracts</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowEarlyClose}
                  onChange={(e) => setFormData({ ...formData, allowEarlyClose: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900 block">Allow Early Termination</span>
                  <span className="text-xs text-gray-400">Permit closing before contract expiry</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowRenew}
                  onChange={(e) => setFormData({ ...formData, allowRenew: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900 block">Allow Renewal</span>
                  <span className="text-xs text-gray-400">Allows manual or automatic contract extension</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeModal}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingPlan
                ? 'Update Plan'
                : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Plan Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate(planToDelete?._id)}
        loading={deleteMutation.isPending}
        title="Delete Subscription Plan"
        message={`Are you sure you want to delete ${planToDelete?.name}? Plans currently in use by active subscriptions cannot be deleted.`}
      />
    </div>
  );
};

export default PlansPage;
