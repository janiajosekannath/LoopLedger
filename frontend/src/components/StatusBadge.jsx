import React from 'react';

const variantClasses = {
  draft: 'bg-gray-100 text-gray-600',
  quotation: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-200 text-gray-500',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  overdue: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
  scheduled: 'bg-purple-100 text-purple-700',
  exhausted: 'bg-gray-100 text-gray-500',
  inactive: 'bg-gray-100 text-gray-500',
};

const StatusBadge = ({ status, className = '' }) => {
  const classes = variantClasses[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${classes} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
