import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Percent, Tag, Calendar, Check, X,
  Clock, AlertTriangle, Trash2, ArrowRight
} from 'lucide-react';
import { discountsApi } from '../api/catalog';
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

const initialDiscountForm = {
  name: '',
  type: 'percent',
  value: '',
  minPurchase: '',
  minQty: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  scope: 'subscription',
  active: true,
};

const DiscountsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formData, setFormData] = useState(initialDiscountForm);
  const [formErrors, setFormErrors] = useState({});

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState(null);

  // Fetch Discounts
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['discounts', page, limit, search, scopeFilter, typeFilter],
    queryFn: () =>
      discountsApi
        .list({
          page,
          limit,
          search,
          scope: scopeFilter || undefined,
          type: typeFilter || undefined,
        })
        .then((res) => res.data),
    keepPreviousData: true,
  });

  const discounts = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newDisc) => discountsApi.create(newDisc),
    onSuccess: () => {
      toast.success('Discount rule created');
      queryClient.invalidateQueries(['discounts']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create discount');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => discountsApi.update(id, updates),
    onSuccess: () => {
      toast.success('Discount rule updated');
      queryClient.invalidateQueries(['discounts']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update discount');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => discountsApi.toggle(id),
    onSuccess: (res) => {
      toast.success(`Discount ${res.data?.data?.active ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries(['discounts']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => discountsApi.delete(id),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Discount deleted');
      queryClient.invalidateQueries(['discounts']);
      setDeleteConfirmOpen(false);
      setDiscountToDelete(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete discount');
    },
  });

  const openAddModal = () => {
    setEditingDiscount(null);
    setFormData(initialDiscountForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (d) => {
    setEditingDiscount(d);
    setFormData({
      name: d.name,
      type: d.type,
      value: d.value,
      minPurchase: d.minPurchase || '',
      minQty: d.minQty || '',
      startDate: d.startDate ? d.startDate.split('T')[0] : '',
      endDate: d.endDate ? d.endDate.split('T')[0] : '',
      usageLimit: d.usageLimit != null ? d.usageLimit : '',
      scope: d.scope || 'subscription',
      active: d.active !== undefined ? d.active : true,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDiscount(null);
    setFormData(initialDiscountForm);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Discount name is required';
    const val = Number(formData.value);
    if (isNaN(val) || val < 0) {
      errors.value = 'Valid discount value is required';
    } else if (formData.type === 'percent' && val > 100) {
      errors.value = 'Percentage cannot exceed 100%';
    }
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        errors.endDate = 'endDate must be after startDate';
      }
    }
    if (editingDiscount && formData.usageLimit !== '') {
      const limitVal = Number(formData.usageLimit);
      if (limitVal < (editingDiscount.timesUsed || 0)) {
        errors.usageLimit = `Limit cannot be below existing usage (${editingDiscount.timesUsed})`;
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
      type: formData.type,
      value: Number(formData.value),
      minPurchase: Number(formData.minPurchase) || 0,
      minQty: Number(formData.minQty) || 0,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      usageLimit: formData.usageLimit !== '' ? Number(formData.usageLimit) : null,
      scope: formData.scope,
      active: formData.active,
    };

    if (editingDiscount) {
      updateMutation.mutate({ id: editingDiscount._id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Discount Rule',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">{row.name}</span>
            <span className="text-xs text-gray-400 capitalize">
              Scope: {row.scope}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Discount Value',
      render: (val, row) => (
        <span className="font-bold text-gray-900">
          {row.type === 'percent' ? `${val}%` : `₹${Number(val).toLocaleString('en-IN')}`}
        </span>
      ),
    },
    {
      key: 'criteria',
      label: 'Eligibility Thresholds',
      render: (_, row) => (
        <div className="text-xs text-gray-600 space-y-0.5">
          {row.minQty > 0 && <div>Min Qty: <span className="font-mono">{row.minQty} units</span></div>}
          {row.minPurchase > 0 && <div>Min Spend: <span className="font-mono">₹{row.minPurchase}</span></div>}
          {!row.minQty && !row.minPurchase && <span className="text-gray-400">No restrictions</span>}
        </div>
      ),
    },
    {
      key: 'usage',
      label: 'Usage (Used / Limit)',
      render: (_, row) => {
        const isMaxed = row.usageLimit && row.timesUsed >= row.usageLimit;
        return (
          <div className="text-xs">
            <span className={isMaxed ? 'text-red-600 font-bold' : 'text-gray-700'}>
              {row.timesUsed || 0} / {row.usageLimit != null ? row.usageLimit : '∞'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'computedStatus',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
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
              setDiscountToDelete(row);
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
        title="Discounts & Promotions"
        subtitle="Configure volume discounts, coupon thresholds, promotional dates and usage counters"
        actions={
          isAdmin && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Discount
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
              placeholder="Search discounts..."
              className="w-full sm:w-72"
            />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input w-36 text-xs"
            >
              <option value="">All Types</option>
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed (₹)</option>
            </select>
            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value);
                setPage(1);
              }}
              className="input w-36 text-xs"
            >
              <option value="">All Scopes</option>
              <option value="subscription">Subscription</option>
              <option value="product">Product</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">
            Total {meta.total} discount rule{meta.total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Discounts Table */}
      <div className="card p-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-red-500 text-sm">
            {error?.response?.data?.message || 'Failed to load discounts'}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={discounts}
              loading={isLoading}
              emptyMessage="No discount rules match your criteria."
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Add / Edit Discount Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingDiscount ? 'Edit Discount Rule' : 'New Discount Rule'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Discount Name" required error={formErrors.name}>
              <input
                type="text"
                className="input"
                placeholder="e.g. 10% at 10+ Seats"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>

            <FormField label="Discount Scope">
              <select
                className="input capitalize"
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
              >
                <option value="subscription">Subscription Scope (Total invoice subtotal)</option>
                <option value="product">Product Scope (Individual line items)</option>
              </select>
            </FormField>

            <FormField label="Discount Type" required>
              <select
                className="input capitalize"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </FormField>

            <FormField
              label={formData.type === 'percent' ? 'Discount Percentage (%)' : 'Fixed Amount (₹)'}
              required
              error={formErrors.value}
            >
              <input
                type="number"
                step="0.01"
                min="0"
                max={formData.type === 'percent' ? 100 : undefined}
                className="input"
                placeholder={formData.type === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </FormField>

            <FormField label="Minimum Quantity Threshold" hint="e.g. 10 for 10% volume discount">
              <input
                type="number"
                min="0"
                className="input"
                placeholder="0 = no minimum"
                value={formData.minQty}
                onChange={(e) => setFormData({ ...formData, minQty: e.target.value })}
              />
            </FormField>

            <FormField label="Minimum Purchase Subtotal (₹)" hint="e.g. 5000 for ₹500 off">
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                placeholder="0 = no minimum"
                value={formData.minPurchase}
                onChange={(e) => setFormData({ ...formData, minPurchase: e.target.value })}
              />
            </FormField>

            <FormField label="Usage Limit (Total times usable)" error={formErrors.usageLimit} hint="Leave empty for unlimited">
              <input
                type="number"
                min="1"
                className="input"
                placeholder="Unlimited"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
              />
            </FormField>

            <FormField label="Validity Dates" error={formErrors.endDate}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="input text-xs"
                  placeholder="Start"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
                <input
                  type="date"
                  className="input text-xs"
                  placeholder="End"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="discActive"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="discActive" className="text-sm text-gray-700 select-none">
              Active discount rule (eligible during quote & invoice calculations)
            </label>
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
                : editingDiscount
                ? 'Update Discount'
                : 'Create Discount'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate(discountToDelete?._id)}
        loading={deleteMutation.isPending}
        title="Delete Discount Rule"
        message={`Are you sure you want to delete ${discountToDelete?.name}? If it has past usage records, it will be marked inactive.`}
      />
    </div>
  );
};

export default DiscountsPage;
