import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, Mail, Shield, KeyRound, Check, X } from 'lucide-react';
import { staffApi } from '../api/staff';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import { toast } from '../components/Toast';

const StaffPage = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Fetch Staff
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['staff', page, limit, search],
    queryFn: () => staffApi.list({ page, limit, search }).then((res) => res.data),
    keepPreviousData: true,
  });

  const staffMembers = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

  // Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (newStaff) => staffApi.create(newStaff),
    onSuccess: () => {
      toast.success('Staff member created successfully');
      queryClient.invalidateQueries(['staff']);
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create staff member');
    },
  });

  // Toggle Staff Status Mutation
  const toggleMutation = useMutation({
    mutationFn: (id) => staffApi.toggle(id),
    onSuccess: (res) => {
      const updated = res.data?.data?.user;
      toast.success(`Staff member ${updated?.isActive ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries(['staff']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setName('');
    setEmail('');
    setPassword('');
    setFormErrors({});
  };

  // Password rules validation
  const rules = {
    length: password.length >= 9,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const isPasswordValid = Object.values(rules).every(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!name.trim()) errors.name = 'Full name is required';
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (!isPasswordValid) {
      errors.password = 'Password does not meet the security criteria';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    createMutation.mutate({ name, email, password });
  };

  const columns = [
    {
      key: 'name',
      label: 'Staff Member',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 text-white font-semibold flex items-center justify-center flex-shrink-0 text-sm">
            {row.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3" />
              <span>{row.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (val) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
          <Shield className="w-3 h-3" />
          {val}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (val) => (
        <StatusBadge status={val ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'createdAt',
      label: 'Created At',
      render: (val) => (
        <span className="text-xs text-gray-500">
          {val ? new Date(val).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '140px',
      render: (_, row) => (
        <button
          onClick={() => toggleMutation.mutate(row._id)}
          disabled={toggleMutation.isPending}
          className={`btn-sm flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
            row.isActive
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          {row.isActive ? (
            <>
              <UserX className="w-3.5 h-3.5" />
              Deactivate
            </>
          ) : (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              Activate
            </>
          )}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Staff Management"
        subtitle="Manage administrative operators and staff access permissions"
        actions={
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Staff Member
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
            placeholder="Search staff by name or email..."
            className="w-full sm:w-80"
          />
          <div className="text-xs text-gray-500">
            Total {meta.total} staff account{meta.total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="card p-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-red-500 text-sm">
            {error?.response?.data?.message || 'Failed to load staff list'}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={staffMembers}
              loading={isLoading}
              emptyMessage={search ? 'No staff members match your search.' : 'No staff accounts found.'}
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="Add New Staff Member" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name" required error={formErrors.name}>
            <input
              type="text"
              className="input"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField label="Email Address" required error={formErrors.email}>
            <input
              type="email"
              className="input"
              placeholder="e.g. priya@loopledger.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Initial Password" required error={formErrors.password}>
            <input
              type="password"
              className="input"
              placeholder="Minimum 9 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          {/* Password Rules Checklist */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1.5 text-xs">
            <p className="font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              Security requirements:
            </p>
            <div className="flex items-center gap-2">
              {rules.length ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
              <span className={rules.length ? 'text-green-700' : 'text-gray-500'}>At least 9 characters</span>
            </div>
            <div className="flex items-center gap-2">
              {rules.upper ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
              <span className={rules.upper ? 'text-green-700' : 'text-gray-500'}>At least one uppercase letter (A-Z)</span>
            </div>
            <div className="flex items-center gap-2">
              {rules.lower ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
              <span className={rules.lower ? 'text-green-700' : 'text-gray-500'}>At least one lowercase letter (a-z)</span>
            </div>
            <div className="flex items-center gap-2">
              {rules.special ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
              <span className={rules.special ? 'text-green-700' : 'text-gray-500'}>At least one special character (!@#$%^&*)</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeModal}
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending || !isPasswordValid}
            >
              {createMutation.isPending ? 'Creating Account...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StaffPage;
