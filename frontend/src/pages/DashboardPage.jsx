import React from 'react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { LayoutDashboard, Users, TrendingUp, DollarSign, AlertTriangle, BarChart3 } from 'lucide-react';

const DashboardPage = () => (
  <div>
    <PageHeader title="Dashboard" subtitle="Overview of your subscription business" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <StatCard title="Active Subscriptions" value="—" icon={LayoutDashboard} color="indigo" />
      <StatCard title="MRR" value="—" icon={TrendingUp} color="green" />
      <StatCard title="ARR" value="—" icon={BarChart3} color="blue" />
      <StatCard title="Revenue Collected" value="—" icon={DollarSign} color="green" />
      <StatCard title="Outstanding" value="—" icon={Users} color="yellow" />
      <StatCard title="Overdue Invoices" value="—" icon={AlertTriangle} color="red" />
    </div>
    <div className="card text-center text-gray-400 py-12 text-sm">
      Dashboard charts load in Phase 7 once billing engine is seeded.
    </div>
  </div>
);

export default DashboardPage;
