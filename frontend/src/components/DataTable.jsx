import React from 'react';
import Spinner from './Spinner';

const DataTable = ({
  columns,
  data,
  loading,
  emptyMessage = 'No records found',
  onRowClick,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row._id || i}
              className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
