import OrderSettlement from '../models/OrderSettlement.js';
import CafeWallet from '../../cafe/models/CafeWallet.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import mongoose from 'mongoose';

/**
 * Get pending settlements for cafes
 */
export const getPendingCafeSettlements = async (cafeId = null, startDate = null, endDate = null) => {
  try {
    const query = {
      'cafeEarning.status': 'credited',
      cafeSettled: false,
      settlementStatus: 'completed'
    };

    if (cafeId) {
      query.cafeId = cafeId;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const settlements = await OrderSettlement.find(query)
      .populate('orderId', 'orderId status deliveredAt')
      .populate('cafeId', 'name cafeId')
      .sort({ createdAt: -1 })
      .lean();

    return settlements;
  } catch (error) {
    console.error('Error getting pending cafe settlements:', error);
    throw error;
  }
};

/**
 * Get pending settlements for delivery partners
 */
export const getPendingDeliverySettlements = async (deliveryId = null, startDate = null, endDate = null) => {
  try {
    const query = {
      'deliveryPartnerEarning.status': 'credited',
      deliveryPartnerSettled: false,
      settlementStatus: 'completed',
      deliveryPartnerId: { $ne: null }
    };

    if (deliveryId) {
      query.deliveryPartnerId = deliveryId;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const settlements = await OrderSettlement.find(query)
      .populate('orderId', 'orderId status deliveredAt')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .lean();

    return settlements;
  } catch (error) {
    console.error('Error getting pending delivery settlements:', error);
    throw error;
  }
};

/**
 * Generate settlement report for cafes (daily/weekly)
 */
export const generateCafeSettlementReport = async (cafeId, startDate, endDate) => {
  try {
    const settlements = await OrderSettlement.find({
      cafeId: cafeId,
      'cafeEarning.status': 'credited',
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('orderId', 'orderId status deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = settlements.reduce((sum, s) => sum + s.cafeEarning.netEarning, 0);
    const totalOrders = settlements.length;
    const totalCommission = settlements.reduce((sum, s) => sum + s.cafeEarning.commission, 0);

    return {
      cafeId,
      period: {
        startDate,
        endDate
      },
      summary: {
        totalOrders,
        totalEarnings,
        totalCommission,
        averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0
      },
      settlements: settlements.map(s => ({
        orderNumber: s.orderNumber,
        orderDate: s.createdAt,
        foodPrice: s.cafeEarning.foodPrice,
        commission: s.cafeEarning.commission,
        netEarning: s.cafeEarning.netEarning,
        status: s.cafeEarning.status
      }))
    };
  } catch (error) {
    console.error('Error generating cafe settlement report:', error);
    throw error;
  }
};

/**
 * Generate settlement report for delivery partners (weekly)
 */
export const generateDeliverySettlementReport = async (deliveryId, startDate, endDate) => {
  try {
    const settlements = await OrderSettlement.find({
      deliveryPartnerId: deliveryId,
      'deliveryPartnerEarning.status': 'credited',
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('orderId', 'orderId status deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.totalEarning, 0);
    const totalOrders = settlements.length;
    const totalDistance = settlements.reduce((sum, s) => sum + (s.deliveryPartnerEarning.distance || 0), 0);
    const totalBasePayout = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.basePayout, 0);
    const totalDistanceCommission = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.distanceCommission, 0);
    const totalSurge = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.surgeAmount, 0);

    return {
      deliveryId,
      period: {
        startDate,
        endDate
      },
      summary: {
        totalOrders,
        totalEarnings,
        totalDistance: totalDistance.toFixed(2),
        totalBasePayout,
        totalDistanceCommission,
        totalSurge,
        averageEarningPerOrder: totalOrders > 0 ? totalEarnings / totalOrders : 0
      },
      settlements: settlements.map(s => ({
        orderNumber: s.orderNumber,
        orderDate: s.createdAt,
        distance: s.deliveryPartnerEarning.distance,
        basePayout: s.deliveryPartnerEarning.basePayout,
        distanceCommission: s.deliveryPartnerEarning.distanceCommission,
        surgeAmount: s.deliveryPartnerEarning.surgeAmount,
        totalEarning: s.deliveryPartnerEarning.totalEarning,
        status: s.deliveryPartnerEarning.status
      }))
    };
  } catch (error) {
    console.error('Error generating delivery settlement report:', error);
    throw error;
  }
};

/**
 * Mark settlements as processed (for weekly payouts)
 */
export const markSettlementsAsProcessed = async (settlementIds, actorType, actorId) => {
  try {
    const settlements = await OrderSettlement.find({
      _id: { $in: settlementIds }
    });

    for (const settlement of settlements) {
      if (settlement.cafeEarning.status === 'credited' && !settlement.cafeSettled) {
        settlement.cafeSettled = true;
      }
      if (settlement.deliveryPartnerEarning.status === 'credited' && !settlement.deliveryPartnerSettled) {
        settlement.deliveryPartnerSettled = true;
      }
      await settlement.save();
    }

    return settlements;
  } catch (error) {
    console.error('Error marking settlements as processed:', error);
    throw error;
  }
};

