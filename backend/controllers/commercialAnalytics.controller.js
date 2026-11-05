import Expense from '../models/Expense.model.js';
import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import { generateCommercialAnalyticsPDF } from '../services/commercialAnalyticsPdfService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get analytics for all commercials
 * Returns a list of all commercials with key performance metrics
 */
export const getCommercialsAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        dateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.date.$lte = end;
      }
    }

    // Get all commercials
    const commercials = await User.find({ role: 'commercial' }).select('name email');

    // Get analytics for each commercial
    const analytics = await Promise.all(
      commercials.map(async (commercial) => {
        // Get expenses for this commercial
        const expenses = await Expense.find({
          commercialId: commercial._id,
          ...dateFilter,
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const expensesBySubcategory = expenses.reduce((acc, exp) => {
          const sub = exp.subcategory || 'other';
          acc[sub] = (acc[sub] || 0) + exp.amount;
          return acc;
        }, {});

        // Get orders for this commercial - directly linked OR through clients
        const clientIds = await User.find({ commercialId: commercial._id }).distinct('_id');
        
        const orderDateFilter = {};
        if (dateFilter.date) {
          orderDateFilter.createdAt = dateFilter.date;
        }

        const orders = await Order.find({
          $or: [
            { commercialId: commercial._id },
            { clientId: { $in: clientIds } }
          ],
          ...orderDateFilter,
        });

        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalOrders = orders.length;

        return {
          commercialId: commercial._id,
          commercialName: commercial.name,
          commercialEmail: commercial.email,
          totalRevenue,
          totalOrders,
          totalExpenses,
          expensesBySubcategory,
          profit: totalRevenue - totalExpenses,
          expenseToRevenueRatio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
        };
      })
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed analytics for a specific commercial
 */
export const getCommercialDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const commercial = await User.findById(id);
    if (!commercial || commercial.role !== 'commercial') {
      return res.status(404).json({
        success: false,
        message: 'المندوب التجاري غير موجود',
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        dateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.date.$lte = end;
      }
    }

    // Get expenses
    const expenses = await Expense.find({
      commercialId: id,
      ...dateFilter,
    }).populate('categoryId', 'name');

    // Get orders
    const clientIds = await User.find({ commercialId: id }).distinct('_id');
    const orders = await Order.find({
      clientId: { $in: clientIds },
      ...(dateFilter.date && { createdAt: dateFilter.date }),
    }).populate('clientId', 'name email');

    // Calculate metrics
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    res.json({
      success: true,
      data: {
        commercial: {
          _id: commercial._id,
          name: commercial.name,
          email: commercial.email,
        },
        metrics: {
          totalRevenue,
          totalOrders: orders.length,
          averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
          totalExpenses,
          profit: totalRevenue - totalExpenses,
          expenseToRevenueRatio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
        },
        expenses: expenses.map(exp => ({
          _id: exp._id,
          amount: exp.amount,
          subcategory: exp.subcategory,
          date: exp.date,
          label: exp.label,
        })),
        orders: orders.map(order => ({
          _id: order._id,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get expense breakdown for a commercial
 */
export const getCommercialExpenses = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, subcategory } = req.query;

    const query = { commercialId: id };
    
    if (subcategory) {
      query.subcategory = subcategory;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const expenses = await Expense.find(query)
      .populate('categoryId', 'name')
      .sort({ date: -1 });

    const expensesBySubcategory = expenses.reduce((acc, exp) => {
      const sub = exp.subcategory || 'other';
      acc[sub] = (acc[sub] || 0) + exp.amount;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        expenses,
        breakdown: expensesBySubcategory,
        total: expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales performance for a commercial
 */
export const getCommercialSales = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const clientIds = await User.find({ commercialId: id }).distinct('_id');

    const query = { clientId: { $in: clientIds } };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(query)
      .populate('clientId', 'name email')
      .sort({ createdAt: -1 });

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    res.json({
      success: true,
      data: {
        orders,
        metrics: {
          totalRevenue,
          totalOrders: orders.length,
          averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Compare multiple commercials
 */
export const compareCommercials = async (req, res, next) => {
  try {
    const { commercialIds, startDate, endDate } = req.query;

    if (!commercialIds || !Array.isArray(commercialIds)) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد قائمة المندوبين التجاريين للمقارنة',
      });
    }

    // Similar to getCommercialsAnalytics but for specific commercials
    const analytics = await getCommercialsAnalytics(req, res, next);
    // This would need to be implemented properly with the date filters
    // For now, returning basic structure
    
    res.json({
      success: true,
      message: 'Fonctionnalité de comparaison à implémenter',
      data: [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export analytics to PDF/Excel
 */
export const exportAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'pdf', startDate, endDate } = req.query;

    if (format !== 'pdf') {
      return res.status(400).json({
        success: false,
        message: 'التصدير بصيغة Excel غير متاح حالياً',
      });
    }

    // Get commercial
    const commercial = await User.findById(id);
    if (!commercial || commercial.role !== 'commercial') {
      return res.status(404).json({
        success: false,
        message: 'المندوب التجاري غير موجود',
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        dateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.date.$lte = end;
      }
    }

    // Get expenses
    const expenses = await Expense.find({
      commercialId: id,
      ...dateFilter,
    }).sort({ date: -1 });

    const expensesBreakdown = expenses.reduce((acc, exp) => {
      const sub = exp.subcategory || 'other';
      acc[sub] = (acc[sub] || 0) + exp.amount;
      return acc;
    }, {});

    // Get orders - orders have commercialId directly
    const orderDateFilter = {};
    if (startDate || endDate) {
      orderDateFilter.createdAt = {};
      if (startDate) {
        orderDateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        orderDateFilter.createdAt.$lte = end;
      }
    }

    // Get orders directly linked to commercial OR through clients
    const clientIds = await User.find({ commercialId: id }).distinct('_id');
    const orders = await Order.find({
      $or: [
        { commercialId: id },
        { clientId: { $in: clientIds } }
      ],
      ...orderDateFilter,
    });

    // Calculate metrics
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = orders.length;

    const metrics = {
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      expenseToRevenueRatio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
    };

    // Generate PDF
    let pdfPath;
    try {
      pdfPath = await generateCommercialAnalyticsPDF({
        commercial: {
          _id: commercial._id,
          name: commercial.name,
          email: commercial.email,
        },
        metrics,
        expenses: expenses.map(exp => ({
          _id: exp._id,
          amount: exp.amount,
          subcategory: exp.subcategory,
          customSubcategory: exp.customSubcategory,
          label: exp.label || '',
          date: exp.date,
        })),
        expensesBreakdown,
        orders: orders.map(order => ({
          _id: order._id,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        })),
        startDate,
        endDate,
      });
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إنشاء ملف PDF: ' + pdfError.message,
      });
    }

    // Send file
    const fullPath = path.join(__dirname, '..', pdfPath);
    
    // Wait a bit to ensure file is written
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!fs.existsSync(fullPath)) {
      console.error('PDF file not found at:', fullPath);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ: لم يتم إنشاء ملف PDF',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    const safeName = commercial.name.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${safeName}-${Date.now()}.pdf"`);
    
    const fileStream = fs.createReadStream(fullPath);
    fileStream.on('error', (streamError) => {
      console.error('Error streaming PDF file:', streamError);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'حدث خطأ أثناء قراءة ملف PDF',
        });
      }
    });
    fileStream.pipe(res);

    // Delete file after sending (optional - can keep for archive)
    // fileStream.on('end', () => {
    //   fs.unlinkSync(fullPath);
    // });
  } catch (error) {
    next(error);
  }
};

