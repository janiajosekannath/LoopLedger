import React from 'react';
import { FileSearch } from 'lucide-react';

const EmptyState = ({ title = 'No records found', message, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <FileSearch className="w-12 h-12 text-gray-300 mb-4" />
    <p className="text-gray-700 font-medium">{title}</p>
    {message && <p className="text-gray-400 text-sm mt-1">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
