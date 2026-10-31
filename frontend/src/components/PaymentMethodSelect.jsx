import React from 'react';
import { Wallet, Building2, CreditCard, Smartphone, MoreHorizontal } from 'lucide-react';

const METHODS = [
  { value: 'cash',          label: 'Cash',          icon: Wallet },
  { value: 'bank_transfer', label: 'Bank Transfer',  icon: Building2 },
  { value: 'card',          label: 'Card',           icon: CreditCard },
  { value: 'upi',           label: 'UPI',            icon: Smartphone },
  { value: 'other',         label: 'Other',          icon: MoreHorizontal },
];

const PaymentMethodSelect = ({ value, onChange, disabled = false, className = '' }) => (
  <div className={`grid grid-cols-2 sm:grid-cols-5 gap-2 ${className}`}>
    {METHODS.map(({ value: v, label, icon: Icon }) => (
      <button
        key={v}
        type="button"
        disabled={disabled}
        onClick={() => onChange(v)}
        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-colors
          ${value === v
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
            : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Icon className="w-5 h-5" />
        {label}
      </button>
    ))}
  </div>
);

export default PaymentMethodSelect;
