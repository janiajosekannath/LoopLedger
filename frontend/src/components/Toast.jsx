import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

let toastHandler = null;

export const toast = {
  success: (message) => toastHandler?.({ type: 'success', message }),
  error: (message) => toastHandler?.({ type: 'error', message }),
  warning: (message) => toastHandler?.({ type: 'warning', message }),
  info: (message) => toastHandler?.({ type: 'info', message }),
};

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastHandler = ({ type, message }) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { toastHandler = null; };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 border rounded-xl shadow-lg pointer-events-auto transition-all ${colors[t.type]}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toast;
