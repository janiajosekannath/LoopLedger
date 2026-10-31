import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, TrendingUp, DollarSign, AlertTriangle, BarChart3,
  ReceiptText, Plus, UserPlus, ArrowRight, Building, Mail
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { customersApi } from '../api/customers';

const DashboardPage = () => {
  const navigate = useNavigate();

  // Fetch recent customers
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['recent-customers'],
    queryFn: () => customersApi.list({ page: 1, limit: 5 }).then((res) => res.data),
  });

  const recentCustomers = customersData?.data || [];
  const totalCustomers = customersData?.meta?.total || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of Brightloop subscription business and revenue metrics"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/customers')}
              className="btn-primary flex items-center gap-1.5 text-xs"
            >
              <UserPlus className="w-4 h-4" />
              Manage Customers
            </button>
          </div>
        }
      />

      {/* Six Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Active Subscriptions"
          value="0"
          icon={ReceiptText}
          color="indigo"
          hint="Recurring customer active contracts"
        />
        <StatCard
          title="MRR (Monthly Recurring Revenue)"
          value="₹0.00"
          icon={TrendingUp}
          color="green"
          hint="Normalized monthly run-rate"
        />
        <StatCard
          title="ARR (Annual Run Rate)"
          value="₹0.00"
          icon={BarChart3}
          color="blue"
          hint="MRR normalized × 12"
        />
        <StatCard
          title="Total Revenue Collected"
          value="₹0.00"
          icon={DollarSign}
          color="green"
          hint="Sum of actual payments received"
        />
        <StatCard
          title="Outstanding Payments"
          value="₹0.00"
          icon={Users}
          color="yellow"
          hint="Unpaid confirmed invoice balances"
        />
        <StatCard
          title="Overdue Invoices"
          value="0"
          icon={AlertTriangle}
          color="red"
          hint="Past due balance > 0"
        />
      </div>

      {/* Main Grid: Quick Actions & Recent Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Customers */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Recent Customers</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {totalCustomers} customer account{totalCustomers === 1 ? '' : 's'} registered
              </p>
            </div>
            <button
              onClick={() => navigate('/customers')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {customersLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading customers...</div>
            ) : recentCustomers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No customers registered yet.</div>
            ) : (
              recentCustomers.map((cust) => (
                <div
                  key={cust._id}
                  onClick={() => navigate(`/customers/${cust._id}`)}
                  className="px-6 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-sm">
                      {cust.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                        {cust.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {cust.email}
                        </span>
                        {cust.company && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Building className="w-3 h-3" />
                            {cust.company}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(cust.registeredAt).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Stage Progress */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/customers')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Add Customer</p>
                    <p className="text-xs text-gray-500">Create account profile</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/sales/quotations')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">New Quotation</p>
                    <p className="text-xs text-gray-500">Price plan & add-ons</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/sales/subscriptions')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <ReceiptText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Manage Subscriptions</p>
                    <p className="text-xs text-gray-500">View active recurring cycles</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="card bg-slate-900 text-white">
            <h2 className="text-sm font-semibold mb-1">Billing Time Machine Ready</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Phase 5 billing engine delivers idempotent, double-billing-proof recurring invoice generation.
            </p>
            <div className="text-xs text-indigo-400 font-medium">
              Currency: INR (₹) • UTC Billing Ledger
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
