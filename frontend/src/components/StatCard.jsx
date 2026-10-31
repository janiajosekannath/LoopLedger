import React from 'react';

const StatCard = ({ title, value, icon: Icon, trend, trendLabel, color = 'indigo' }) => {
  const colorMap = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="card flex items-start gap-4">
      {Icon && (
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
        {trendLabel && (
          <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}% {trendLabel}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
