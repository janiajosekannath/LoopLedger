import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ScrollText, FileText, LogOut, Menu, X } from 'lucide-react';

const portalNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/portal' },
  { label: 'Subscriptions', icon: ScrollText, path: '/portal/subscriptions' },
  { label: 'Invoices', icon: FileText, path: '/portal/invoices' },
];

const PortalLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) =>
    path === '/portal' ? location.pathname === '/portal' : location.pathname.startsWith(path);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className={`hidden md:flex flex-col w-64 bg-slate-900 flex-shrink-0`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ScrollText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">LoopLedger</p>
            <p className="text-xs text-slate-400">Customer Portal</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {portalNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.path)
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">Customer</p>
            </div>
            <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col w-64 bg-slate-900">
            <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800">
              <p className="text-sm font-bold text-white">LoopLedger</p>
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {portalNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive(item.path) ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4">
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button onClick={handleLogout} className="btn-secondary text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PortalLayout;
