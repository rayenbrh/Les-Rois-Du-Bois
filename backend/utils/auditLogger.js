import AuditLog from '../models/AuditLog.model.js';
import { endOfRange } from './dateRange.js';

export const createAuditLog = async (data) => {
  try {
    const {
      resourceType,
      resourceId,
      action,
      userId,
      userEmail,
      before = {},
      after = {},
      ipAddress,
      userAgent,
    } = data;

    // Calculate changes
    const changes = {};
    Object.keys(after).forEach((key) => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = {
          before: before[key],
          after: after[key],
        };
      }
    });

    await AuditLog.create({
      resourceType,
      resourceId,
      action,
      userId,
      userEmail,
      before,
      after,
      changes,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to avoid breaking main flow
  }
};

export const getAuditLogs = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  const query = {};
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.resourceId) query.resourceId = filters.resourceId;
  if (filters.action) query.action = filters.action;
  if (filters.userId) query.userId = filters.userId;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = endOfRange(filters.endDate);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

