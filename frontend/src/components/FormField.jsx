import React from 'react';

const FormField = ({ label, error, required, children, hint }) => (
  <div className="mb-4">
    {label && (
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

export default FormField;
