import EarningAddon from '../../admin/models/EarningAddon.js';
import EarningAddonHistory from '../../admin/models/EarningAddonHistory.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import Order from '../../order/models/Order.js';
import mongoose from 'mongoose';

/**
 * Check and award earning addon bonuses when a delivery boy completes an order
 * @param {Object} deliveryId - Delivery partner ID
 * @param {Object} orderId - Order ID that was just completed
 * @param {Date} orderDeliveredAt - When the order was delivered
 * @returns {Promise<Object|null>} - Returns bonus details if awarded, null otherwise
 */
export const checkAndAwardEarningAddon = async (deliveryId, orderId, orderDeliveredAt = new Date()) => {
  // Salaried model: no earning addons
  return null;
};

/**
 * Get delivery boy's progress for all active offers
 * @param {Object} deliveryId - Delivery partner ID
 * @returns {Promise<Array>} - Array of offers with progress
 */
export const getDeliveryBoyOfferProgress = async (deliveryId) => {
  // Salaried model: no offer progress
  return [];
};
