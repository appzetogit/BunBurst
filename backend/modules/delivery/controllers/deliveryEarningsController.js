import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import Order from '../../order/models/Order.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import DeliveryTransaction from '../models/DeliveryTransaction.js';
import EarningAddon from '../../admin/models/EarningAddon.js';
import EarningAddonHistory from '../../admin/models/EarningAddonHistory.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get Delivery Partner Earnings
 * GET /api/delivery/earnings
 * Query params: period (today, week, month, all), page, limit, date (for specific date/week/month)
 */
export const getEarnings = asyncHandler(async (req, res) => {
  return successResponse(res, 200, 'Earnings are disabled for salaried delivery partners', {
    earnings: [],
    summary: {
      period: req.query?.period || 'all',
      startDate: null,
      endDate: null,
      totalOrders: 0,
      totalEarnings: 0,
      totalHours: 0,
      totalMinutes: 0,
      orderEarning: 0,
      incentive: 0,
      otherEarnings: 0
    },
    pagination: {
      page: parseInt(req.query?.page || 1),
      limit: parseInt(req.query?.limit || 1000),
      total: 0,
      pages: 0
    }
  });
});

/**
 * Get Active Earning Addon Offers for Delivery Partner
 * GET /api/delivery/earnings/active-offers
 */
export const getActiveEarningAddons = asyncHandler(async (req, res) => {
  return successResponse(res, 200, 'Active earning offers are disabled for salaried delivery partners', {
    activeOffers: []
  });
});

