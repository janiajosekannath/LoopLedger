import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Tag, Percent, Check, X, ShieldAlert } from 'lucide-react';
import { taxesApi } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import SearchInput from '../components/SearchInput';
import { toast } from '../components/Toast';

const TaxesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [formErrors, setFormErrors] = useState({});

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taxToDelete, setTaxToDelete] = useState(null);

  // Fetch Taxes
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['taxes', search],
    queryFn: () => taxesApi.list({ search }).then((res) => res.data),
  });

  const taxes = data?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newTax) => taxesApi.create(newTax),
    onSuccess: () => {
      toast.success('Tax rule created');
      queryClient.invalidateQueries(['taxes']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create tax');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => taxesApi.update(id, updates),
    onSuccess: () => {
      toast.success('Tax rule updated');
      queryClient.invalidateQueries(['taxes']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update tax');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => taxesApi.toggle(id),
    onSuccess: (res) => {
      toast.success(`Tax rule ${res.data?.data?.active ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries(['taxes']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => taxesApi.delete(id),
    onSuccess: () => {
      toast.success('Tax rule deleted');
      queryClient.invalidateQueries(['taxes']);
      setDeleteConfirmOpen(false);
      setTaxToDelete(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete tax');
    },
  });

  const openAddModal = () => {
    setEditingTax(null);
    setName('');
    setPercent('');
    setDescription('');
    setActive(true);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (tax) => {
    setEditingTax(tax);
    setName(tax.name);
    setPercent(tax.percent);
    setDescription(tax.description || '');
    setActive(tax.active);
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTax(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!name.trim()) errors.name = 'Tax name is required';
    const numPercent = Number(percent);
    if (isNaN(numPercent) || numPercent < 0 || numPercent > 100) {
      errors.percent = 'Percentage must be between 0 and 100';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      name: name.trim(),
      percent: numPercent,
      description: description.trim(),
      active,
    };

    if (editingTax) {
      updateMutation.mutate({ id: editingTax._id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Tax Rule',
      render: (val) => (
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Tag className="w-4 h-4" />
          </div>
          <span className="font-semibold text-gray-900">{val}</span>
        </div>
      ),
    },
    {
      key: 'percent',
      label: 'Rate',
      render: (val) => (
        <span className="font-bold text-gray-900 text-sm">{val}%</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => <span className="text-gray-500 text-xs">{val || '—'}</span>,
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
      width: '140px',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMutation.mutate(row._id)}
            title={row.active ? 'Deactivate' : 'Activate'}
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
              setTaxToDelete(row);
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
        title="Tax Rates & Rules"
        subtitle="Manage statutory goods & services tax percentages and exemptions (INR ₹)"
        actions={
          isAdmin && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Tax Rule
            </button>
          )
        }
      />

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search taxes by name..."
            className="w-full sm:w-80"
          />
          <div className="text-xs text-gray-500">
            {taxes.length} Tax Rule{taxes.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-red-500 text-sm">
            {error?.response?.data?.message || 'Failed to load taxes'}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={taxes}
            loading={isLoading}
            emptyMessage="No tax rules configured. Click Add Tax Rule to create one."
          />
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingTax ? 'Edit Tax Rule' : 'New Tax Rule'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Tax Name" required error={formErrors.name}>
            <input
              type="text"
              className="input"
              placeholder="e.g. GST 18%"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField label="Tax Rate (%)" required error={formErrors.percent}>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input"
              placeholder="e.g. 18"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </FormField>

          <FormField label="Description">
            <input
              type="text"
              className="input"
              placeholder="e.g. Standard GST on IT and SaaS services"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="taxActiveCheckbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="taxActiveCheckbox" className="text-sm text-gray-700 select-none">
              Active tax rule (available for product assignment and quotation calculation)
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
                : editingTax
                ? 'Update Tax'
                : 'Create Tax'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate(taxToDelete?._id)}
        loading={deleteMutation.isPending}
        title="Delete Tax Rule"
        message={`Are you sure you want to delete ${taxToDelete?.name}?`}
      />
    </div>
  );
};

export default TaxesPage;
