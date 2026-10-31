import React from 'react';
import { Search } from 'lucide-react';

const SearchInput = ({ value, onChange, placeholder = 'Search...', className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9"
    />
  </div>
);

export default SearchInput;
