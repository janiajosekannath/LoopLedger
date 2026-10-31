import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Package, CreditCard, FileText, BarChart3,
  ChevronDown, ChevronRight, Menu, X, LogOut, User, Settings,
  Tag, Percent, BookTemplate, ScrollText, ReceiptText, Banknote,
  Clock, AlertTriangle, Building2
} from 'lucide-react';

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['admin', 'staff'],
  },
  {
    label: 'Customers',
    icon: Users,
    path: '/customers',
    roles: ['admin', 'staff'],
  },
  {
    label: 'Catalog',
    icon: Package,
    roles: ['admin', 'staff'],
    children: [
      { label: 'Products', icon: Package, path: '/catalog/products' },
      { label: 'Plans', icon: ScrollText, path: '/catalog/plans' },
      { label: 'Taxes', icon: Tag, path: '/catalog/taxes' },
      { label: 'Discounts', icon: Percent, path: '/catalog/discounts' },
    ],
  },
  {
    label: 'Sales',
    icon: FileText,
    roles: ['admin', 'staff'],
    children: [
      { label: 'Templates', icon: BookTemplate, path: '/sales/templates' },
      { label: 'Quotations', icon: FileText, path: '/sales/quotations' },
      { label: 'Subscriptions', icon: ReceiptText, path: '/sales/subscriptions' },
    ],
  },
  {
    label: 'Billing',
    icon: CreditCard,
    roles: ['admin', 'staff'],
    children: [
      { label: 'Invoices', icon: FileText, path: '/billing/invoices' },
      { label: 'Payments', icon: Banknote, path: '/billing/payments' },
      { label: 'Time Machine', icon: Clock, path: '/billing/time-machine' },
      { label: 'Collections', icon: AlertTriangle, path: '/billing/collections' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    path: '/reports',
    roles: ['admin', 'staff'],
  },
  {
    label: 'Staff',
    icon: Building2,
    path: '/staff',
    roles: ['admin'],
  },
];

const NavItem = ({ item, collapsed }) => {
  const location = useLocation();
  const [open, setOpen] = useState(() =>
    item.children?.some((c) => location.pathname.startsWith(c.path))
  );

  const isActive = (path) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(path);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors ${open ? 'bg-slate-700 text-white' : ''}`}
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
            {item.children.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive(child.path)
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <child.icon className="w-4 h-4 flex-shrink-0" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive(item.path)
          ? 'bg-indigo-600 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
};

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full bg-slate-900 ${mobile ? 'w-72' : collapsed ? 'w-16' : 'w-64'} transition-all duration-200`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <ScrollText className="w-4 h-4 text-white" />
        </div>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">LoopLedger</p>
            <p className="text-xs text-slate-400 truncate">Subscription billing</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavItem key={item.label} item={item} collapsed={collapsed && !mobile} />
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          {(!collapsed || mobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          )}
          {(!collapsed || mobile) && (
            <button onClick={handleLogout} className="p-1 hover:text-red-400 text-slate-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col">
            <Sidebar mobile />
          </div>
          <button
            className="absolute top-4 right-4 text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="hidden sm:inline">{user?.name}</span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="hidden sm:inline capitalize text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {user?.role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
