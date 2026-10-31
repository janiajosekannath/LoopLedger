import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
};

export const RoleRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!roles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'customer') return <Navigate to="/portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
