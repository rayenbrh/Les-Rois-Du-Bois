import { getAuditLogs as getLogs } from '../utils/auditLogger.js';
import AuditLog from '../models/AuditLog.model.js';
import { endOfRange } from '../utils/dateRange.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const result = await getLogs(req.query, { page: req.query.page || 1, limit: req.query.limit || 50 });
    res.json({ success: true, data: result.logs, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const deleteAuditLogs = async (req, res, next) => {
  try {
    const { resourceType, action, startDate, endDate, deleteAll } = req.query;
    
    // Build query
    let query = {};
    
    // If deleteAll is true, delete all logs (empty query)
    if (deleteAll === 'true') {
      query = {};
    } else {
      // Otherwise, use filters
      if (resourceType) query.resourceType = resourceType;
      if (action) query.action = action;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = endOfRange(endDate);
      }
    }

    // Count before deletion
    const countBefore = await AuditLog.countDocuments(query);

    // Delete logs matching the query
    const result = await AuditLog.deleteMany(query);
    
    res.json({
      success: true,
      message: `تم حذف ${result.deletedCount} سجل بنجاح`,
      deletedCount: result.deletedCount,
      countBefore,
    });
  } catch (error) {
    next(error);
  }
};

