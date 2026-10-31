import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <p className="text-6xl font-bold text-indigo-600 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">Go home</Link>
    </div>
  </div>
);

export default NotFoundPage;
