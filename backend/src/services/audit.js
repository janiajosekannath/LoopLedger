/**
 * services/audit.js
 * Audit log service to track status changes across Quotations, Subscriptions, Invoices, and Payments.
 */

const { StatusHistory } = require('../models/History');

/**
 * Records a status transition in the StatusHistory collection.
 *
 * @param {Object} params
 * @param {string} params.entityType - 'quotation' | 'subscription' | 'invoice' | 'payment'
 * @param {string|ObjectId} params.entityId - Document ID
 * @param {string} [params.from] - Previous status
 * @param {string} params.to - New status
 * @param {string|ObjectId} [params.changedBy] - User ID responsible for the change
 * @param {string} [params.note] - Optional context or reason
 * @param {Date} [params.at] - Timestamp (defaults to now)
 * @returns {Promise<Object>} Created StatusHistory record
 */
async function recordStatusChange({
  entityType,
  entityId,
  from,
  to,
  changedBy,
  note,
  at = new Date(),
}) {
  if (!entityType || !entityId || !to) {
    throw new Error('entityType, entityId, and to are required to record a status change');
  }

  const history = await StatusHistory.create({
    entityType: entityType.toLowerCase(),
    entityId,
    from: from ? from.toLowerCase() : undefined,
    to: to.toLowerCase(),
    changedBy: changedBy || undefined,
    note,
    at,
  });

  return history;
}

/**
 * Retrieves the full audit timeline for an entity, sorted chronologically or reverse-chronologically.
 *
 * @param {string} entityType
 * @param {string|ObjectId} entityId
 * @param {'asc'|'desc'} [sort='asc']
 * @returns {Promise<Array>}
 */
async function getEntityHistory(entityType, entityId, sort = 'asc') {
  return StatusHistory.find({
    entityType: entityType.toLowerCase(),
    entityId,
  })
    .populate('changedBy', 'name email role')
    .sort({ at: sort === 'asc' ? 1 : -1 })
    .lean();
}

module.exports = {
  recordStatusChange,
  getEntityHistory,
};
