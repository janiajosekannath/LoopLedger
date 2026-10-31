import React from 'react';
import { Loader2 } from 'lucide-react';

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

const Spinner = ({ size = 'md', className = '' }) => (
  <Loader2 className={`animate-spin text-indigo-600 ${sizeMap[size]} ${className}`} />
);

export default Spinner;
