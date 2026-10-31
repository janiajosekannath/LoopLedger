import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Eye, MapPin, Building, Mail, Phone, Calendar } from 'lucide-react';
import { customersApi } from '../api/customers';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import { toast } from '../components/Toast';

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  address: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  },
};

const CustomersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // Fetch Customers
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customers', page, limit, search],
    queryFn: () => customersApi.list({ page, limit, search }).then((res) => res.data),
    keepPreviousData: true,
  });

  const customers = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (newCustomer) => customersApi.create(newCustomer),
    onSuccess: () => {
      toast.success('Customer created successfully');
      queryClient.invalidateQueries(['customers']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => customersApi.update(id, updates),
    onSuccess: () => {
      toast.success('Customer updated successfully');
      queryClient.invalidateQueries(['customers']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update customer');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => customersApi.delete(id),
    onSuccess: () => {
      toast.success('Customer deleted successfully');
      queryClient.invalidateQueries(['customers']);
      setDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete customer');
      setDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    },
  });

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData(initialFormData);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (customer, e) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      company: customer.company || '',
      address: {
        line1: customer.address?.line1 || '',
        line2: customer.address?.line2 || '',
        city: customer.address?.city || '',
        state: customer.address?.state || '',
        pincode: customer.address?.pincode || '',
        country: customer.address?.country || 'India',
      },
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openDeleteDialog = (customer, e) => {
    e.stopPropagation();
    setCustomerToDelete(customer);
    setDeleteConfirmOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Name is required';
    if (!formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer._id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center flex-shrink-0 text-sm">
            {row.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-gray-900 hover:text-indigo-600 transition-colors">
              {row.name}
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3" />
              <span>{row.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: (val) => (
        <div className="flex items-center gap-1.5 text-gray-700">
          <Building className="w-3.5 h-3.5 text-gray-400" />
          <span>{val || '—'}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (val) => (
        <div className="text-gray-600 text-xs">
          {val ? (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-gray-400" />
              {val}
            </span>
          ) : (
            '—'
          )}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (_, row) => {
        const parts = [row.address?.city, row.address?.state].filter(Boolean);
        return parts.length > 0 ? (
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="w-3 h-3 text-gray-400" />
            {parts.join(', ')}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        );
      },
    },
    {
      key: 'registeredAt',
      label: 'Registered',
      render: (val) => (
        <span className="text-xs text-gray-500">
          {val ? new Date(val).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '120px',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/customers/${row._id}`)}
            title="View Details"
            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => openEditModal(row, e)}
            title="Edit Customer"
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => openDeleteDialog(row, e)}
            title="Delete Customer"
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your subscribers, accounts, and contact profiles"
        actions={
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by name, email, company, phone..."
            className="w-full sm:w-80"
          />
          <div className="text-xs text-gray-500 self-end sm:self-center">
            Total {meta.total} customer{meta.total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card p-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-red-500 text-sm">
            {error?.response?.data?.message || 'Failed to load customers'}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={customers}
              loading={isLoading}
              emptyMessage={search ? 'No customers match your search.' : 'No customers found. Click Add Customer to create one.'}
              onRowClick={(row) => navigate(`/customers/${row._id}`)}
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required error={formErrors.name}>
              <input
                type="text"
                className="input"
                placeholder="e.g. Ramesh Kumar"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>

            <FormField label="Email Address" required error={formErrors.email}>
              <input
                type="email"
                className="input"
                placeholder="e.g. ramesh@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>

            <FormField label="Company Name" error={formErrors.company}>
              <input
                type="text"
                className="input"
                placeholder="e.g. TechCorp Solutions"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </FormField>

            <FormField label="Phone Number" error={formErrors.phone}>
              <input
                type="tel"
                className="input"
                placeholder="e.g. +91 98765 43210"
                value={formData.phone}
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
                  placeholder="Street / Flat / Door No."
                  value={formData.address.line1}
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
                  placeholder="Apartment, suite, landmark"
                  value={formData.address.line2}
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
                    placeholder="City"
                    value={formData.address.city}
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
                    placeholder="State"
                    value={formData.address.state}
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
                    placeholder="Pincode"
                    value={formData.address.pincode}
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
                    value={formData.address.country}
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
                : editingCustomer
                ? 'Update Customer'
                : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate(customerToDelete?._id)}
        loading={deleteMutation.isPending}
        title="Delete Customer"
        message={`Are you sure you want to delete ${customerToDelete?.name}? This action cannot be undone. Customers with active subscriptions or invoices cannot be deleted.`}
        confirmLabel="Delete Customer"
      />
    </div>
  );
};

export default CustomersPage;
