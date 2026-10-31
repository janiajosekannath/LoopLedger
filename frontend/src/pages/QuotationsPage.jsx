import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, FileText, CheckCircle, Clock } from 'lucide-react';
import { quotationsApi } from '../api/quotations';
import { quotationTemplatesApi } from '../api/quotationTemplates';
import { customersApi } from '../api/customers';
import { catalogApi } from '../api/catalog';
import { pricingApi } from '../api/pricing';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import Spinner from '../components/Spinner';
import { toast } from '../components/Toast';

const QuotationsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    customer: '',
    template: '',
    plan: '',
    validityDays: 30,
    lines: [{ product: '', variant: '', quantity: 1 }],
  });

  const [previewPricing, setPreviewPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const { data: customersData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.list({ limit: 100 }).then((r) => r.data.data),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates-all'],
    queryFn: () => quotationTemplatesApi.list({ limit: 100 }).then((r) => r.data.data),
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
    queryKey: ['quotations', page, search, statusFilter],
    queryFn: () =>
      quotationsApi
        .list({ page, limit: 10, search, status: statusFilter || undefined })
        .then((r) => r.data),
  });

  // Dynamic live pricing preview
  useEffect(() => {
    const validLines = form.lines.filter((l) => l.product);
    if (validLines.length === 0) {
      setPreviewPricing(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPricingLoading(true);
      try {
        const res = await pricingApi.quote({
          lines: validLines.map((l) => ({
            product: l.product,
            variant: l.variant || null,
            quantity: Math.max(1, Number(l.quantity) || 1),
          })),
          planId: form.plan || null,
          customerId: form.customer || null,
        });
        setPreviewPricing(res.data.data);
      } catch (err) {
        // Validation error during live preview (e.g. minQty)
        setPreviewPricing({ error: err.response?.data?.message || err.message });
      } finally {
        setPricingLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.lines, form.plan, form.customer]);

  const handleTemplateSelect = (templateId) => {
    setForm((prev) => ({ ...prev, template: templateId }));
    if (!templateId) return;

    const tmpl = templatesData?.find((t) => t._id === templateId);
    if (tmpl) {
      setForm((prev) => ({
        ...prev,
        template: templateId,
        validityDays: tmpl.validityDays || 30,
        plan: tmpl.plan?._id || tmpl.plan || prev.plan,
        lines:
          tmpl.lines?.length > 0
            ? tmpl.lines.map((l) => ({
                product: l.product?._id || l.product || '',
                variant: l.variant?._id || l.variant || '',
                quantity: l.quantity || 1,
              }))
            : prev.lines,
      }));
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload) => quotationsApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation created');
      setModalOpen(false);
      navigate(`/sales/quotations/${res.data.data._id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create quotation');
    },
  });

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
    if (!form.customer) return toast.error('Please select a customer');
    const validLines = form.lines.filter((l) => l.product);
    if (validLines.length === 0) return toast.error('At least one product line is required');

    createMutation.mutate({
      customer: form.customer,
      template: form.template || null,
      plan: form.plan || null,
      validityDays: Number(form.validityDays) || 30,
      lines: validLines.map((l) => ({
        product: l.product,
        variant: l.variant || null,
        quantity: Math.max(1, Number(l.quantity) || 1),
      })),
    });
  };

  const columns = [
    {
      key: 'number',
      label: 'Quotation #',
      render: (val, row) => (
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
      label: 'Plan',
      render: (val) =>
        val ? (
          <span className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
            {val.name} ({val.billingPeriod})
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (val) => <span className="font-semibold text-gray-900">₹{val?.toLocaleString('en-IN') || 0}</span>,
    },
    {
      key: 'validUntil',
      label: 'Valid Until',
      render: (val) => {
        if (!val) return '—';
        const d = new Date(val);
        const isExpired = d < new Date();
        return (
          <span className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
            {d.toLocaleDateString('en-IN')} {isExpired ? '(Expired)' : ''}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'subscription',
      label: 'Subscription',
      render: (val) =>
        val ? (
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            {val.number}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
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
        title="Quotations"
        subtitle="Manage sales proposals, custom quotes, and convert to active subscriptions"
        actions={
          <button
            onClick={() => {
              setForm({
                customer: '',
                template: '',
                plan: '',
                validityDays: 30,
                lines: [{ product: '', variant: '', quantity: 1 }],
              });
              setPreviewPricing(null);
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Quotation
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: 'All', value: '' },
          { label: 'Draft', value: 'draft' },
          { label: 'Quotation Sent', value: 'quotation' },
          { label: 'Confirmed', value: 'confirmed' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search quotation number (QUO-...)..."
            className="w-full sm:w-72"
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          emptyMessage="No quotations found."
          onRowClick={(row) => navigate(`/sales/quotations/${row._id}`)}
        />

        <Pagination
          page={page}
          totalPages={data?.meta?.totalPages || 1}
          onPageChange={setPage}
        />
      </div>

      {/* Create Quotation Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Quotation"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Select Customer" required>
              <select
                className="input"
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                required
              >
                <option value="">Select customer...</option>
                {customersData?.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.company || c.email})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Load from Template (Optional)">
              <select
                className="input"
                value={form.template}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">None (Custom proposal)</option>
                {templatesData?.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Target Subscription Plan">
              <select
                className="input"
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                <option value="">None / Custom</option>
                {plansData?.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.billingPeriod}) - ₹{p.price}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Validity (Days)">
              <input
                type="number"
                min="1"
                className="input"
                value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
              />
            </FormField>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Line Items</span>
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
                        {prod.name} (Base ₹{prod.salesPrice})
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
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Real-time Pricing Engine Preview Card */}
          {previewPricing && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1 mt-3">
              <div className="flex justify-between font-semibold text-slate-700 border-b border-slate-200 pb-1">
                <span>Pricing Engine Live Quote</span>
                {pricingLoading && <span className="text-indigo-600">Calculating...</span>}
              </div>

              {previewPricing.error ? (
                <p className="text-red-600 font-medium py-1">{previewPricing.error}</p>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Subtotal:</span>
                    <span>₹{previewPricing.subtotal?.toLocaleString('en-IN')}</span>
                  </div>
                  {previewPricing.discountTotal > 0 && (
                    <div className="flex justify-between text-green-700 font-medium">
                      <span>Discounts Applied:</span>
                      <span>-₹{previewPricing.discountTotal?.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Taxes (GST):</span>
                    <span>₹{previewPricing.taxTotal?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-sm border-t border-slate-200 pt-1">
                    <span>Estimated Total:</span>
                    <span>₹{previewPricing.total?.toLocaleString('en-IN')}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Spinner size="sm" /> : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default QuotationsPage;
