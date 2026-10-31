import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Archive, Package, Calculator, Layers, Tag,
  ArrowRight, Check, X, Trash2, Info
} from 'lucide-react';
import { productsApi, taxesApi } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import { toast } from '../components/Toast';

const initialProductForm = {
  name: '',
  type: 'service',
  salesPrice: '',
  costPrice: '',
  notes: '',
  tax: '',
  variants: [],
};

const ProductsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Product Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialProductForm);
  const [formErrors, setFormErrors] = useState({});

  // Calculator State
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [selectedCalcProduct, setSelectedCalcProduct] = useState(null);
  const [selectedCalcVariant, setSelectedCalcVariant] = useState(null);
  const [calcQuantity, setCalcQuantity] = useState(1);

  // Fetch Products
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['products', page, limit, search, typeFilter],
    queryFn: () =>
      productsApi.list({ page, limit, search, type: typeFilter || undefined }).then((res) => res.data),
    keepPreviousData: true,
  });

  const products = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

  // Fetch Taxes for dropdown
  const { data: taxesData } = useQuery({
    queryKey: ['taxes-active'],
    queryFn: () => taxesApi.list({ active: true }).then((res) => res.data),
  });
  const taxes = taxesData?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newProd) => productsApi.create(newProd),
    onSuccess: () => {
      toast.success('Product created successfully');
      queryClient.invalidateQueries(['products']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => productsApi.update(id, updates),
    onSuccess: () => {
      toast.success('Product updated successfully');
      queryClient.invalidateQueries(['products']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update product');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Product archived');
      queryClient.invalidateQueries(['products']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to archive product');
    },
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(initialProductForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      type: prod.type,
      salesPrice: prod.salesPrice,
      costPrice: prod.costPrice,
      notes: prod.notes || '',
      tax: prod.tax?._id || prod.tax || '',
      variants: prod.variants ? prod.variants.map((v) => ({ ...v })) : [],
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormData(initialProductForm);
    setFormErrors({});
  };

  const handleAddVariantRow = () => {
    setFormData({
      ...formData,
      variants: [
        ...formData.variants,
        { attribute: 'Brand', value: '', extraPrice: 0 },
      ],
    });
  };

  const handleRemoveVariantRow = (index) => {
    const next = [...formData.variants];
    next.splice(index, 1);
    setFormData({ ...formData, variants: next });
  };

  const handleVariantChange = (index, field, value) => {
    const next = [...formData.variants];
    next[index][field] = value;
    setFormData({ ...formData, variants: next });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Product name is required';
    if (formData.salesPrice === '' || Number(formData.salesPrice) < 0) {
      errors.salesPrice = 'Valid base sales price (₹) is required';
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
      salesPrice: Number(formData.salesPrice),
      costPrice: Number(formData.costPrice) || 0,
      notes: formData.notes?.trim() || '',
      tax: formData.tax || null,
      variants: formData.variants.map((v) => ({
        attribute: v.attribute.trim(),
        value: v.value.trim(),
        extraPrice: Number(v.extraPrice) || 0,
      })),
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Open Price Calculator
  const openCalculator = (product) => {
    setSelectedCalcProduct(product);
    setSelectedCalcVariant(product.variants?.[0] || null);
    setCalcQuantity(1);
    setCalcModalOpen(true);
  };

  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500 capitalize">{row.type}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'salesPrice',
      label: 'Base Price (₹)',
      render: (val) => (
        <span className="font-semibold text-gray-900">
          ₹{(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'tax',
      label: 'Tax Rule',
      render: (val) =>
        val ? (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
            <Tag className="w-3 h-3 text-slate-400" />
            {val.name} ({val.percent}%)
          </span>
        ) : (
          <span className="text-gray-400 text-xs">None</span>
        ),
    },
    {
      key: 'variants',
      label: 'Variants',
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {val && val.length > 0 ? (
            val.map((v, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-mono"
              >
                {v.value} {v.extraPrice > 0 ? `(+₹${v.extraPrice})` : ''}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-xs">Standard only</span>
          )}
        </div>
      ),
    },
    {
      key: 'calculator',
      label: 'Calculator',
      render: (_, row) => (
        <button
          onClick={() => openCalculator(row)}
          className="btn-sm flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Calculator className="w-3.5 h-3.5" />
          Price Check
        </button>
      ),
    },
  ];

  if (isAdmin) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => archiveMutation.mutate(row._id)}
            title="Archive Product"
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      ),
    });
  }

  // Price Calculation Logic
  const calcBasePrice = selectedCalcProduct?.salesPrice || 0;
  const calcExtraPrice = selectedCalcVariant?.extraPrice || 0;
  const calcUnitPrice = calcBasePrice + calcExtraPrice;
  const calcSubtotal = calcUnitPrice * Math.max(1, calcQuantity);
  const calcTaxPercent = selectedCalcProduct?.tax?.percent || 0;
  const calcTaxAmount = (calcSubtotal * calcTaxPercent) / 100;
  const calcTotal = calcSubtotal + calcTaxAmount;

  return (
    <div>
      <PageHeader
        title="Products & Add-Ons"
        subtitle="Manage billable software products, add-on modules, and attribute variants"
        actions={
          isAdmin && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Product
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
              placeholder="Search products..."
              className="w-full sm:w-72"
            />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input w-40 text-xs"
            >
              <option value="">All Types</option>
              <option value="subscription">Subscription</option>
              <option value="service">Service</option>
              <option value="digital">Digital</option>
              <option value="physical">Physical</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">
            Total {meta.total} product{meta.total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card p-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-red-500 text-sm">
            {error?.response?.data?.message || 'Failed to load products'}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={products}
              loading={isLoading}
              emptyMessage="No products match your criteria."
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Product Name" required error={formErrors.name}>
              <input
                type="text"
                className="input"
                placeholder="e.g. Business Software Suite"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>

            <FormField label="Product Type">
              <select
                className="input capitalize"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="subscription">Subscription</option>
                <option value="service">Service</option>
                <option value="digital">Digital</option>
                <option value="physical">Physical</option>
              </select>
            </FormField>

            <FormField label="Base Sales Price (₹)" required error={formErrors.salesPrice}>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="e.g. 1000"
                value={formData.salesPrice}
                onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
              />
            </FormField>

            <FormField label="Cost Price (₹)">
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="e.g. 400"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Default Tax Rule">
            <select
              className="input"
              value={formData.tax}
              onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
            >
              <option value="">No default tax</option>
              {taxes.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.percent}%)
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Internal Notes / Description">
            <textarea
              rows={2}
              className="input"
              placeholder="Internal product specs or customer facing descriptions"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </FormField>

          {/* Variants Section */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Product Variants & Extra Charges
                </h3>
                <p className="text-xs text-gray-400">
                  e.g. Brand: Odoo (+₹560), Tier: 24/7 Dedicated (+₹1,200)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariantRow}
                className="btn-sm flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Variant
              </button>
            </div>

            {formData.variants.length === 0 ? (
              <div className="text-center py-4 bg-gray-50 rounded-lg text-xs text-gray-400">
                No variants configured. Product will sell at base price.
              </div>
            ) : (
              <div className="space-y-2">
                {formData.variants.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input text-xs w-1/3"
                      placeholder="Attribute (e.g. Brand)"
                      value={v.attribute}
                      onChange={(e) => handleVariantChange(idx, 'attribute', e.target.value)}
                    />
                    <input
                      type="text"
                      className="input text-xs flex-1"
                      placeholder="Value (e.g. Odoo Edition)"
                      value={v.value}
                      onChange={(e) => handleVariantChange(idx, 'value', e.target.value)}
                    />
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">+₹</span>
                      <input
                        type="number"
                        step="0.01"
                        className="input text-xs pl-8"
                        placeholder="Extra"
                        value={v.extraPrice}
                        onChange={(e) => handleVariantChange(idx, 'extraPrice', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariantRow(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                : editingProduct
                ? 'Update Product'
                : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Interactive Price Calculator Modal */}
      <Modal
        open={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        title="Live Pricing Engine Calculator"
        size="md"
      >
        {selectedCalcProduct && (
          <div className="space-y-4">
            <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
              <h3 className="font-bold text-gray-900 text-base">{selectedCalcProduct.name}</h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Base Sales Price: ₹{calcBasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {selectedCalcProduct.variants?.length > 0 && (
              <div>
                <label className="label">Select Variant</label>
                <div className="grid grid-cols-1 gap-2">
                  {selectedCalcProduct.variants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedCalcVariant(v)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-colors ${
                        selectedCalcVariant?._id === v._id || selectedCalcVariant?.value === v.value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>
                        {v.attribute}: {v.value}
                      </span>
                      <span className="font-mono text-gray-600">
                        {v.extraPrice > 0 ? `+₹${v.extraPrice}` : 'Included (+₹0)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Quantity</label>
              <input
                type="number"
                min="1"
                className="input"
                value={calcQuantity}
                onChange={(e) => setCalcQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            {/* Price Proof Card */}
            <div className="bg-slate-900 text-white p-5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Base Product Price</span>
                <span>₹{calcBasePrice.toFixed(2)}</span>
              </div>
              {calcExtraPrice > 0 && (
                <div className="flex justify-between text-indigo-300">
                  <span>Variant Surcharge ({selectedCalcVariant?.value})</span>
                  <span>+₹{calcExtraPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-slate-700 pt-2 text-white text-sm">
                <span>Effective Unit Price</span>
                <span>₹{calcUnitPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1">
                <span>Subtotal ({calcQuantity} unit{calcQuantity > 1 ? 's' : ''})</span>
                <span>₹{calcSubtotal.toFixed(2)}</span>
              </div>
              {calcTaxPercent > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Tax ({selectedCalcProduct.tax?.name || `${calcTaxPercent}%`})</span>
                  <span>+₹{calcTaxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-400 font-bold text-base border-t border-slate-700 pt-2">
                <span>Total Amount Due</span>
                <span>₹{calcTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Formula: (Base ₹{calcBasePrice} + Variant ₹{calcExtraPrice}) × Qty {calcQuantity} = Subtotal ₹{calcSubtotal}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setCalcModalOpen(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProductsPage;
