import React from 'react';
import Modal from './Modal';

const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading = false }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-gray-600 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
      <button
        className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading ? 'Processing...' : confirmLabel}
      </button>
    </div>
  </Modal>
);

export default ConfirmDialog;
