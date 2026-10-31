import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, BookTemplate } from 'lucide-react';
import { quotationTemplatesApi } from '../api/quotationTemplates';
import { catalogApi } from '../api/catalog';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const QuotationTemplatesPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    validityDays: 30,
    plan: '',
    lines: [{ product: '', variant: '', quantity: 1 }],
  });

  const { data: plansData } = useQuery({
    queryKey: ['plans-all'],
    queryFn: () => catalogApi.listPlans({ limit: 100 }).then((r) => r.data.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => catalogApi.listProducts({ limit: 100 }).then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['quotation-templates', page, search],
    queryFn: () =>
      quotationTemplatesApi.list({ page, limit: 10, search }).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingTemplate
        ? quotationTemplatesApi.update(editingTemplate._id, payload)
        : quotationTemplatesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => quotationTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
      toast.success('Template deleted');
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete template');
    },
  });

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setForm({
        name: template.name,
        validityDays: template.validityDays || 30,
        plan: template.plan?._id || template.plan || '',
        lines:
          template.lines?.length > 0
            ? template.lines.map((l) => ({
                product: l.product?._id || l.product || '',
                variant: l.variant?._id || l.variant || '',
                quantity: l.quantity || 1,
              }))
            : [{ product: '', variant: '', quantity: 1 }],
      });
    } else {
      setEditingTemplate(null);
      setForm({
        name: '',
        validityDays: 30,
        plan: '',
        lines: [{ product: '', variant: '', quantity: 1 }],
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
  };

  const handleAddLine = () => {
    setForm({
      ...form,
      lines: [...form.lines, { product: '', variant: '', quantity: 1 }],
    });
  };

  const handleRemoveLine = (index) => {
    if (form.lines.length <= 1) return;
    setForm({
      ...form,
      lines: form.lines.filter((_, i) => i !== index),
    });
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...form.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === 'product') {
      newLines[index].variant = '';
    }
    setForm({ ...form, lines: newLines });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Template name is required');
    const validLines = form.lines.filter((l) => l.product);
    if (validLines.length === 0) return toast.error('At least one product line is required');

    saveMutation.mutate({
      name: form.name.trim(),
      validityDays: Number(form.validityDays) || 30,
      plan: form.plan || null,
      lines: validLines.map((l) => ({
        product: l.product,
        variant: l.variant || null,
        quantity: Math.max(1, Number(l.quantity) || 1),
      })),
    });
  };

  const columns = [
    {
      key: 'name',
      label: 'Template Name',
      render: (val, row) => (
        <div>
          <span className="font-medium text-gray-900">{val}</span>
          {row.plan && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
              {row.plan.name} ({row.plan.billingPeriod})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'validityDays',
      label: 'Validity',
      render: (val) => `${val || 30} days`,
    },
    {
      key: 'lines',
      label: 'Pre-configured Items',
      render: (val) => (
        <span className="text-gray-600 text-xs">
          {val?.length || 0} item{val?.length === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(row)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600"
            title="Edit Template"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteId(row._id)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600"
            title="Delete Template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const getVariantsForProduct = (productId) => {
    const product = productsData?.find((p) => p._id === productId);
    return product?.variants || [];
  };

  return (
    <div>
      <PageHeader
        title="Quotation Templates"
        subtitle="Pre-configured packages and line items for fast quotation generation"
        actions={
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Template
          </button>
        }
      />

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search templates by name..."
            className="w-full sm:w-72"
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          emptyMessage="No quotation templates found. Click 'New Template' to create one."
        />

        <Pagination
          page={page}
          totalPages={data?.meta?.totalPages || 1}
          onPageChange={setPage}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingTemplate ? 'Edit Quotation Template' : 'Create Quotation Template'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Template Name" required>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Starter SaaS Onboarding Package"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Validity (Days)">
              <input
                type="number"
                min="1"
                className="input"
                value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
              />
            </FormField>

            <FormField label="Default Subscription Plan">
              <select
                className="input"
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                <option value="">No default plan</option>
                {plansData?.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.billingPeriod}) - ₹{p.price}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Pre-configured Line Items</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add Item
              </button>
            </div>

            {form.lines.map((line, idx) => {
              const variants = getVariantsForProduct(line.product);
              return (
                <div key={idx} className="flex gap-2 items-center mb-2">
                  <select
                    className="input flex-1 text-xs"
                    value={line.product}
                    onChange={(e) => handleLineChange(idx, 'product', e.target.value)}
                    required
                  >
                    <option value="">Select Product...</option>
                    {productsData?.map((prod) => (
                      <option key={prod._id} value={prod._id}>
                        {prod.name} (₹{prod.salesPrice})
                      </option>
                    ))}
                  </select>

                  {variants.length > 0 && (
                    <select
                      className="input flex-1 text-xs"
                      value={line.variant}
                      onChange={(e) => handleLineChange(idx, 'variant', e.target.value)}
                    >
                      <option value="">Standard (No variant)</option>
                      {variants.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.attribute}: {v.value} (+₹{v.extraPrice})
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="number"
                    min="1"
                    className="input w-20 text-xs"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                  />

                  {form.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Spinner size="sm" /> : editingTemplate ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Delete Quotation Template"
        message="Are you sure you want to delete this template? Existing quotations generated from it will not be affected."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

export default QuotationTemplatesPage;
