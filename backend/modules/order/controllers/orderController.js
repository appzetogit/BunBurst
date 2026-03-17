import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import { createOrder as createRazorpayOrder, verifyPayment } from '../../payment/services/razorpayService.js';
import Cafe from '../../cafe/models/Cafe.js';
import Zone from '../../admin/models/Zone.js';
import mongoose from 'mongoose';
import winston from 'winston';
import { calculateOrderPricing } from '../services/orderCalculationService.js';
import { getRazorpayCredentials } from '../../../shared/utils/envService.js';
import { notifyCafeNewOrder, notifyCafeOrderUpdate } from '../services/cafeNotificationService.js';
import { notifyUserOrderStatusUpdate } from '../services/userNotificationService.js';
import { calculateOrderSettlement } from '../services/orderSettlementService.js';
import { holdEscrow } from '../services/escrowWalletService.js';
import { processCancellationRefund } from '../services/cancellationRefundService.js';
import etaCalculationService from '../services/etaCalculationService.js';
import etaWebSocketService from '../services/etaWebSocketService.js';
import OrderEvent from '../models/OrderEvent.js';
import UserWallet from '../../user/models/UserWallet.js';
import FeedbackExperience from '../../admin/models/FeedbackExperience.js';
import Coupon from '../../coupon/models/Coupon.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';

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
 * Helper to increment coupon usage count
 */
const incrementCouponUsage = async (code) => {
  if (!code) return;
  try {
    await Coupon.findOneAndUpdate(
      { code: code.toUpperCase() },
      { $inc: { usedCount: 1 } }
    );
    logger.info(`✅ Coupon usage incremented: ${code}`);
  } catch (error) {
    logger.error(`❌ Error incrementing coupon usage for ${code}:`, error);
  }
};

/**
 * Create a new order and initiate Razorpay payment
 */
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      items,
      address,
      cafeId,
      cafeName,
      pricing,
      note,
      sendCutlery,
      paymentMethod: bodyPaymentMethod,
      orderType: bodyOrderType
    } = req.body;
    // Support both camelCase and snake_case from client
    const paymentMethod = bodyPaymentMethod ?? req.body.payment_method;

    // Normalize payment method: 'cod' / 'COD' / 'Cash on Delivery' Ã¢â€ â€™ 'cash', 'wallet' Ã¢â€ â€™ 'wallet'
    const normalizedPaymentMethod = (() => {
      const m = (paymentMethod && String(paymentMethod).toLowerCase().trim()) || '';
      if (m === 'cash' || m === 'cod' || m === 'cash on delivery') return 'cash';
      if (m === 'wallet') return 'wallet';
      return paymentMethod || 'razorpay';
    })();
    logger.info('Order create paymentMethod:', { raw: paymentMethod, normalized: normalizedPaymentMethod, bodyKeys: Object.keys(req.body || {}).filter(k => k.toLowerCase().includes('payment')) });

    const normalizedOrderType = String(bodyOrderType || 'DELIVERY').toUpperCase() === 'PICKUP'
      ? 'PICKUP'
      : 'DELIVERY';

    // Check ordering options from business settings (enable/disable delivery/pickup)
    try {
      const settings = await BusinessSettings.getSettings();
      const orderingOptions = settings?.orderingOptions || {};
      const enableDelivery = orderingOptions.enableDelivery !== undefined ? orderingOptions.enableDelivery : true;
      const enablePickup = orderingOptions.enablePickup !== undefined ? orderingOptions.enablePickup : true;

      if (normalizedOrderType === 'DELIVERY' && !enableDelivery) {
        return res.status(400).json({
          success: false,
          message: 'Delivery orders are currently disabled'
        });
      }

      if (normalizedOrderType === 'PICKUP' && !enablePickup) {
        return res.status(400).json({
          success: false,
          message: 'Pickup orders are currently disabled'
        });
      }
    } catch (settingsError) {
      logger.warn('Unable to load ordering options. Proceeding with defaults.', {
        error: settingsError?.message
      });
    }

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item'
      });
    }

    if (normalizedOrderType === 'DELIVERY' && !address) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required'
      });
    }

    if (!pricing || !pricing.total) {
      return res.status(400).json({
        success: false,
        message: 'Order total is required'
      });
    }

    // Validate and assign cafe - order goes to the cafe whose food was ordered
    if (!cafeId || cafeId === 'unknown') {
      return res.status(400).json({
        success: false,
        message: 'Cafe ID is required. Please select a cafe.'
      });
    }

    let assignedCafeId = cafeId;
    let assignedCafeName = cafeName;

    // Log incoming cafe data for debugging
    logger.info('Ã°Å¸â€Â Order creation - Cafe lookup:', {
      incomingCafeId: cafeId,
      incomingCafeName: cafeName,
      cafeIdType: typeof cafeId,
      cafeIdLength: cafeId?.length
    });

    // Find and validate the cafe
    let cafe = null;
    // Try to find cafe by cafeId, _id, or slug
    if (mongoose.Types.ObjectId.isValid(cafeId) && cafeId.length === 24) {
      cafe = await Cafe.findById(cafeId);
      logger.info('Ã°Å¸â€Â Cafe lookup by _id:', {
        cafeId: cafeId,
        found: !!cafe,
        cafeName: cafe?.name
      });
    }
    if (!cafe) {
      cafe = await Cafe.findOne({
        $or: [
          { cafeId: cafeId },
          { slug: cafeId }
        ]
      });
      logger.info('Ã°Å¸â€Â Cafe lookup by cafeId/slug:', {
        cafeId: cafeId,
        found: !!cafe,
        cafeName: cafe?.name,
        cafe_cafeId: cafe?.cafeId,
        cafe__id: cafe?._id?.toString()
      });
    }

    if (!cafe) {
      logger.error('Ã¢ÂÅ’ Cafe not found:', {
        searchedCafeId: cafeId,
        searchedCafeName: cafeName
      });
      return res.status(404).json({
        success: false,
        message: 'Cafe not found'
      });
    }

    // CRITICAL: Validate cafe name matches
    if (cafeName && cafe.name !== cafeName) {
      logger.warn('Ã¢Å¡Â Ã¯Â¸Â Cafe name mismatch:', {
        incomingName: cafeName,
        foundCafeName: cafe.name,
        incomingCafeId: cafeId,
        foundCafeId: cafe._id?.toString() || cafe.cafeId
      });
      // Still proceed but log the mismatch
    }

    // Note: Removed isAcceptingOrders check - orders can come even when cafe is offline
    // Cafe can accept/reject orders manually, or orders will auto-reject after accept time expires
    // if (!cafe.isAcceptingOrders) {
    //   logger.warn('Ã¢Å¡Â Ã¯Â¸Â Cafe not accepting orders:', {
    //     cafeId: cafe._id?.toString() || cafe.cafeId,
    //     cafeName: cafe.name
    //   });
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Cafe is currently not accepting orders'
    //   });
    // }

    if (!cafe.isActive) {
      logger.warn('Ã¢Å¡Â Ã¯Â¸Â Cafe is inactive:', {
        cafeId: cafe._id?.toString() || cafe.cafeId,
        cafeName: cafe.name
      });
      return res.status(403).json({
        success: false,
        message: 'Cafe is currently inactive'
      });
    }

    // CRITICAL: Validate that cafe's location (pin) is within an active zone
    const cafeLat = cafe.location?.latitude || cafe.location?.coordinates?.[1];
    const cafeLng = cafe.location?.longitude || cafe.location?.coordinates?.[0];

    if (!cafeLat || !cafeLng) {
      logger.error('Ã¢ÂÅ’ Cafe location not found:', {
        cafeId: cafe._id?.toString() || cafe.cafeId,
        cafeName: cafe.name
      });
      return res.status(400).json({
        success: false,
        message: 'Cafe location is not set. Please contact support.'
      });
    }

    // Check if cafe is within any active zone
    const activeZones = await Zone.find({ isActive: true }).lean();
    let cafeInZone = false;
    let cafeZone = null;

    // If no active zones are configured, skip strict zone enforcement (dev/local safety).
    if (!activeZones || activeZones.length === 0) {
      logger.warn('No active zones found. Skipping cafe zone validation for this order.', {
        cafeId: cafe._id?.toString() || cafe.cafeId,
        cafeName: cafe.name
      });
      cafeInZone = true;
    }

    for (const zone of activeZones) {
      if (!zone.coordinates || zone.coordinates.length < 3) continue;

      let isInZone = false;
      if (typeof zone.containsPoint === 'function') {
        isInZone = zone.containsPoint(cafeLat, cafeLng);
      } else {
        // Ray casting algorithm
        let inside = false;
        for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
          const coordI = zone.coordinates[i];
          const coordJ = zone.coordinates[j];
          const xi = typeof coordI === 'object' ? (coordI.latitude || coordI.lat) : null;
          const yi = typeof coordI === 'object' ? (coordI.longitude || coordI.lng) : null;
          const xj = typeof coordJ === 'object' ? (coordJ.latitude || coordJ.lat) : null;
          const yj = typeof coordJ === 'object' ? (coordJ.longitude || coordJ.lng) : null;

          if (xi === null || yi === null || xj === null || yj === null) continue;

          const intersect = ((yi > cafeLng) !== (yj > cafeLng)) &&
            (cafeLat < (xj - xi) * (cafeLng - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        isInZone = inside;
      }

      if (isInZone) {
        cafeInZone = true;
        cafeZone = zone;
        break;
      }
    }

    if (!cafeInZone) {
      logger.warn('Ã¢Å¡Â Ã¯Â¸Â Cafe location is not within any active zone:', {
        cafeId: cafe._id?.toString() || cafe.cafeId,
        cafeName: cafe.name,
        cafeLat,
        cafeLng
      });
      return res.status(403).json({
        success: false,
        message: 'This cafe is not available in your area. Only cafes within active delivery zones can receive orders.'
      });
    }

    logger.info('Ã¢Å“â€¦ Cafe validated - location is within active zone:', {
      cafeId: cafe._id?.toString() || cafe.cafeId,
      cafeName: cafe.name,
      zoneId: cafeZone?._id?.toString(),
      zoneName: cafeZone?.name || cafeZone?.zoneName
    });

    // CRITICAL: Validate user's zone matches cafe's zone (strict zone matching)
    // Only applicable for DELIVERY orders
    const { zoneId: userZoneId } = req.body; // User's zone ID from frontend
    if (normalizedOrderType === 'DELIVERY') {
      if (userZoneId && cafeZone?._id) {
        const cafeZoneId = String(cafeZone._id);
        const requestedUserZoneId = String(userZoneId).trim();

        if (cafeZoneId !== requestedUserZoneId) {
          // Handle overlap/order edge-cases: if requested user zone also contains cafe, allow order.
          let requestedZoneContainsCafe = false;
          try {
            const point = { type: 'Point', coordinates: [cafeLng, cafeLat] };
            const existsByBoundary = await Zone.exists({
              _id: requestedUserZoneId,
              isActive: true,
              boundary: { $geoIntersects: { $geometry: point } }
            });

            if (existsByBoundary) {
              requestedZoneContainsCafe = true;
            } else {
              // Fallback for legacy zones without proper boundary
              const requestedZone = await Zone.findOne({ _id: requestedUserZoneId, isActive: true }).lean();
              if (requestedZone?.coordinates?.length >= 3) {
                let inside = false;
                for (let i = 0, j = requestedZone.coordinates.length - 1; i < requestedZone.coordinates.length; j = i++) {
                  const ci = requestedZone.coordinates[i];
                  const cj = requestedZone.coordinates[j];
                  const xi = typeof ci === 'object' ? (ci.longitude ?? ci.lng) : null; // x = lng
                  const yi = typeof ci === 'object' ? (ci.latitude ?? ci.lat) : null;  // y = lat
                  const xj = typeof cj === 'object' ? (cj.longitude ?? cj.lng) : null;
                  const yj = typeof cj === 'object' ? (cj.latitude ?? cj.lat) : null;
                  if (xi === null || yi === null || xj === null || yj === null) continue;
                  const intersect = ((yi > cafeLat) !== (yj > cafeLat)) &&
                    (cafeLng < ((xj - xi) * (cafeLat - yi)) / ((yj - yi) || 1e-12) + xi);
                  if (intersect) inside = !inside;
                }
                requestedZoneContainsCafe = inside;
              }
            }
          } catch (zoneRecheckError) {
            logger.warn('Zone mismatch recheck failed', {
              userZoneId: requestedUserZoneId,
              cafeZoneId,
              error: zoneRecheckError?.message
            });
          }

          if (!requestedZoneContainsCafe) {
            logger.warn('Zone mismatch - user and cafe are in different zones:', {
              userZoneId: requestedUserZoneId,
              cafeZoneId,
              cafeId: cafe._id?.toString() || cafe.cafeId,
              cafeName: cafe.name
            });
            return res.status(403).json({
              success: false,
              message: 'This cafe is not available in your zone. Please select a cafe from your current delivery zone.'
            });
          }

          // Prefer requested user zone in overlap scenario to keep FE/BE consistent.
          cafeZone._id = requestedUserZoneId;
        }

        logger.info('Zone match validated - user and cafe are in the same zone:', {
          zoneId: requestedUserZoneId,
          cafeId: cafe._id?.toString() || cafe.cafeId
        });
      } else if (userZoneId && !cafeZone?._id) {
        logger.warn('User zoneId provided but cafe zone context unavailable. Skipping strict zone match.', {
          userZoneId,
          cafeId: cafe._id?.toString() || cafe.cafeId
        });
      } else {
        logger.warn('User zoneId not provided in order request - zone validation skipped');
      }
    }

    assignedCafeId = cafe._id?.toString() || cafe.cafeId;
    assignedCafeName = cafe.name;

    // Log cafe assignment for debugging
    logger.info('Ã¢Å“â€¦ Cafe assigned to order:', {
      assignedCafeId: assignedCafeId,
      assignedCafeName: assignedCafeName,
      cafe_id: cafe._id?.toString(),
      cafe_cafeId: cafe.cafeId,
      incomingCafeId: cafeId,
      incomingCafeName: cafeName
    });

    // Generate order ID before creating order
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const generatedOrderId = `ORD-${timestamp}-${random}`;

    // Ensure couponCode is included in pricing
    if (!pricing.couponCode && pricing.appliedCoupon?.code) {
      pricing.couponCode = pricing.appliedCoupon.code;
    }

    const normalizedPricing = {
      ...pricing,
      deliveryFee: normalizedOrderType === 'PICKUP' ? 0 : pricing.deliveryFee
    };
    const normalizedAddress = normalizedOrderType === 'DELIVERY' ? address : (address || null);

    // Create order in database with pending status
    const order = new Order({
      orderId: generatedOrderId,
      userId,
      cafeId: assignedCafeId,
      cafeName: assignedCafeName,
      orderType: normalizedOrderType,
      items,
      address: normalizedAddress,
      pricing: {
        ...normalizedPricing,
        couponCode: normalizedPricing.couponCode || null
      },
      note: note || '',
      sendCutlery: sendCutlery !== false,
      status: 'pending',
      payment: {
        method: normalizedPaymentMethod,
        status: 'pending'
      },
      adminAcceptance: { status: false },
      paymentCollectionStatus:
        normalizedPaymentMethod === 'cash' || normalizedPaymentMethod === 'cod'
          ? 'Not Collected'
          : 'Collected'
    });

    // Parse preparation time from order items
    // Extract maximum preparation time from items (e.g., "20-25 mins" -> 25)
    let maxPreparationTime = 0;
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        if (item.preparationTime) {
          const prepTimeStr = String(item.preparationTime).trim();
          // Parse formats like "20-25 mins", "20-25", "25 mins", "25"
          const match = prepTimeStr.match(/(\d+)(?:\s*-\s*(\d+))?/);
          if (match) {
            const minTime = parseInt(match[1], 10);
            const maxTime = match[2] ? parseInt(match[2], 10) : minTime;
            maxPreparationTime = Math.max(maxPreparationTime, maxTime);
          }
        }
      });
    }
    order.preparationTime = maxPreparationTime;
    logger.info('Ã°Å¸â€œâ€¹ Preparation time extracted from items:', {
      maxPreparationTime,
      itemsCount: items?.length || 0
    });

    // Calculate initial ETA
    try {
      const cafeLocation = cafe.location
        ? {
          latitude: cafe.location.latitude,
          longitude: cafe.location.longitude
        }
        : null;

      const userLocation = address.location?.coordinates
        ? {
          latitude: address.location.coordinates[1],
          longitude: address.location.coordinates[0]
        }
        : null;

      if (normalizedOrderType === 'DELIVERY' && cafeLocation && userLocation) {
        const etaResult = await etaCalculationService.calculateInitialETA({
          cafeId: assignedCafeId,
          cafeLocation,
          userLocation
        });

        // Add preparation time to ETA (use max preparation time)
        const finalMinETA = etaResult.minETA + maxPreparationTime;
        const finalMaxETA = etaResult.maxETA + maxPreparationTime;

        // Update order with ETA (including preparation time)
        order.eta = {
          min: finalMinETA,
          max: finalMaxETA,
          lastUpdated: new Date(),
          additionalTime: 0 // Will be updated when cafe adds time
        };
        order.estimatedDeliveryTime = Math.ceil((finalMinETA + finalMaxETA) / 2);

        // Create order created event
        await OrderEvent.create({
          orderId: order._id,
          eventType: 'ORDER_CREATED',
          data: {
            initialETA: {
              min: finalMinETA,
              max: finalMaxETA
            },
            preparationTime: maxPreparationTime
          },
          timestamp: new Date()
        });

        logger.info('Ã¢Å“â€¦ ETA calculated for order:', {
          orderId: order.orderId,
          eta: `${finalMinETA}-${finalMaxETA} mins`,
          preparationTime: maxPreparationTime,
          baseETA: `${etaResult.minETA}-${etaResult.maxETA} mins`
        });
      } else {
        logger.warn('Ã¢Å¡Â Ã¯Â¸Â Could not calculate ETA - missing location data');
      }
    } catch (etaError) {
      logger.error('Ã¢ÂÅ’ Error calculating ETA:', etaError);
      // Continue with order creation even if ETA calculation fails
    }

    // Generate digital bill HTML
    order.digitalBillHtml = generateDigitalBillHtml(order);

    await order.save();

    // Log order creation for debugging
    logger.info('Order created successfully:', {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      cafeId: order.cafeId,
      userId: order.userId,
      status: order.status,
      total: order.pricing.total,
      eta: order.eta ? `${order.eta.min}-${order.eta.max} mins` : 'N/A',
      paymentMethod: normalizedPaymentMethod
    });

    // For wallet payments, check balance and deduct before creating order
    if (normalizedPaymentMethod === 'wallet') {
      try {
        // Find or create wallet
        const wallet = await UserWallet.findOrCreateByUserId(userId);

        // Check if sufficient balance
        if (pricing.total > wallet.balance) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient wallet balance',
            data: {
              required: pricing.total,
              available: wallet.balance,
              shortfall: pricing.total - wallet.balance
            }
          });
        }

        // Check if transaction already exists for this order (prevent duplicate)
        const existingTransaction = wallet.transactions.find(
          t => t.orderId && t.orderId.toString() === order._id.toString() && t.type === 'deduction'
        );

        if (existingTransaction) {
          logger.warn('Ã¢Å¡Â Ã¯Â¸Â Wallet payment already processed for this order', {
            orderId: order.orderId,
            transactionId: existingTransaction._id
          });
        } else {
          // Deduct money from wallet
          const transaction = wallet.addTransaction({
            amount: pricing.total,
            type: 'deduction',
            status: 'Completed',
            description: `Order payment - Order #${order.orderId}`,
            orderId: order._id
          });

          await wallet.save();

          // Update user's wallet balance in User model (for backward compatibility)
          const User = (await import('../../auth/models/User.js')).default;
          await User.findByIdAndUpdate(userId, {
            'wallet.balance': wallet.balance,
            'wallet.currency': wallet.currency
          });

          logger.info('Ã¢Å“â€¦ Wallet payment deducted for order:', {
            orderId: order.orderId,
            userId: userId,
            amount: pricing.total,
            transactionId: transaction._id,
            newBalance: wallet.balance
          });
        }

        // Create payment record
        try {
          const payment = new Payment({
            paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            orderId: order._id,
            userId,
            amount: pricing.total,
            currency: 'INR',
            method: 'wallet',
            status: 'completed',
            logs: [{
              action: 'completed',
              timestamp: new Date(),
              details: {
                previousStatus: 'new',
                newStatus: 'completed',
                note: 'Wallet payment completed'
              }
            }]
          });
          await payment.save();
        } catch (paymentError) {
          logger.error('Ã¢ÂÅ’ Error creating wallet payment record:', paymentError);
        }

        // Mark order as confirmed and payment as completed
        order.payment.method = 'wallet';
        order.payment.status = 'completed';
        order.status = 'confirmed';
        order.tracking.confirmed = {
          status: true,
          timestamp: new Date()
        };
        await order.save();

        // Increment coupon usage if used
        if (order.pricing?.couponCode) {
          await incrementCouponUsage(order.pricing.couponCode);
        }

        // Notify cafe about new wallet payment order
        try {
          const notifyCafeResult = await notifyCafeNewOrder(order, assignedCafeId, 'wallet');
          await notifyUserOrderStatusUpdate(order, 'confirmed');
          logger.info('Ã¢Å“â€¦ Wallet payment order notification sent to cafe', {
            orderId: order.orderId,
            cafeId: assignedCafeId,
            notifyCafeResult
          });
        } catch (notifyError) {
          logger.error('Ã¢ÂÅ’ Error notifying cafe about wallet payment order:', notifyError);
        }

        // Respond to client
        return res.status(201).json({
          success: true,
          data: {
            order: {
              id: order._id.toString(),
              orderId: order.orderId,
              status: order.status,
              total: pricing.total
            },
            razorpay: null,
            wallet: {
              balance: wallet.balance,
              deducted: pricing.total
            }
          }
        });
      } catch (walletError) {
        logger.error('Ã¢ÂÅ’ Error processing wallet payment:', walletError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process wallet payment',
          error: walletError.message
        });
      }
    }

    // For cash-on-delivery orders, confirm immediately and notify cafe.
    // Online (Razorpay) orders follow the existing verifyOrderPayment flow.
    if (normalizedPaymentMethod === 'cash') {
      // Best-effort payment record; even if it fails we still proceed with order.
      try {
        const payment = new Payment({
          paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderId: order._id,
          userId,
          amount: order.pricing.total,
          currency: 'INR',
          method: 'cash',
          status: 'pending',
          logs: [{
            action: 'pending',
            timestamp: new Date(),
            details: {
              previousStatus: 'new',
              newStatus: 'pending',
              note: 'Cash on delivery order created'
            }
          }]
        });
        await payment.save();
      } catch (paymentError) {
        logger.error('Ã¢ÂÅ’ Error creating COD payment record (continuing without blocking order):', {
          error: paymentError.message,
          stack: paymentError.stack
        });
      }

      // Mark order as confirmed so cafe can prepare it (ensure payment.method is cash for notification)
      order.payment.method = 'cash';
      order.payment.status = 'pending';
      order.status = 'confirmed';
      order.tracking.confirmed = {
        status: true,
        timestamp: new Date()
      };
      await order.save();

      // Increment coupon usage if used
      if (order.pricing?.couponCode) {
        await incrementCouponUsage(order.pricing.couponCode);
      }

      // Notify cafe about new COD order via Socket.IO (non-blocking)
      try {
        const notifyCafeResult = await notifyCafeNewOrder(order, assignedCafeId, 'cash');
        await notifyUserOrderStatusUpdate(order, 'confirmed');
        logger.info('Ã¢Å“â€¦ COD order notification sent to cafe', {
          orderId: order.orderId,
          cafeId: assignedCafeId,
          notifyCafeResult
        });
      } catch (notifyError) {
        logger.error('Ã¢ÂÅ’ Error notifying cafe about COD order (order still created):', {
          error: notifyError.message,
          stack: notifyError.stack
        });
      }

      // Respond to client (no Razorpay details for COD)
      return res.status(201).json({
        success: true,
        data: {
          order: {
            id: order._id.toString(),
            orderId: order.orderId,
            status: order.status,
            total: pricing.total
          },
          razorpay: null
        }
      });
    }

    // Note: For Razorpay / online payments, cafe notification will be sent
    // after payment verification in verifyOrderPayment. This ensures cafe
    // only receives prepaid orders after successful payment.

    // Create Razorpay order for online payments
    let razorpayOrder = null;
    if (normalizedPaymentMethod === 'razorpay' || !normalizedPaymentMethod) {
      try {
        razorpayOrder = await createRazorpayOrder({
          amount: Math.round(pricing.total * 100), // Convert to paise
          currency: 'INR',
          receipt: order.orderId,
          notes: {
            orderId: order.orderId,
            userId: userId.toString(),
            cafeId: cafeId || 'unknown'
          }
        });

        // Update order with Razorpay order ID
        order.payment.razorpayOrderId = razorpayOrder.id;
        await order.save();
      } catch (razorpayError) {
        logger.error(`Error creating Razorpay order: ${razorpayError.message}`);
        // Continue with order creation even if Razorpay fails
        // Payment can be handled later
      }
    }

    logger.info(`Order created: ${order.orderId}`, {
      orderId: order.orderId,
      userId,
      amount: pricing.total,
      razorpayOrderId: razorpayOrder?.id
    });

    // Get Razorpay key ID from env service
    let razorpayKeyId = null;
    if (razorpayOrder) {
      try {
        const credentials = await getRazorpayCredentials();
        razorpayKeyId = credentials.keyId || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY;
      } catch (error) {
        logger.warn(`Failed to get Razorpay key ID from env service: ${error.message}`);
        razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order._id.toString(),
          orderId: order.orderId,
          status: order.status,
          total: pricing.total
        },
        razorpay: razorpayOrder ? {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: razorpayKeyId
        } : null
      }
    });
  } catch (error) {
    logger.error(`Error creating order: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify payment and confirm order
 */
export const verifyOrderPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification fields'
      });
    }

    // Find order (support both MongoDB ObjectId and orderId string)
    let order;
    try {
      // Try to find by MongoDB ObjectId first
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findOne({
          _id: orderId,
          userId
        });
      }

      // If not found, try by orderId string
      if (!order) {
        order = await Order.findOne({
          orderId: orderId,
          userId
        });
      }
    } catch (error) {
      // Fallback: try both
      order = await Order.findOne({
        $or: [
          { _id: orderId },
          { orderId: orderId }
        ],
        userId
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Idempotency guard: prevent duplicate Payment rows / escrow holds on retries.
    const existingPayment = await Payment.findOne({
      orderId: order._id,
      status: 'completed',
      $or: [
        { transactionId: razorpayPaymentId },
        { 'razorpay.paymentId': razorpayPaymentId },
        { 'razorpay.orderId': razorpayOrderId }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existingPayment) {
      // Ensure order state matches the completed payment (best-effort).
      if (order.payment?.status !== 'completed' || order.status !== 'confirmed') {
        order.payment = {
          ...(order.payment || {}),
          method: order.payment?.method || 'razorpay',
          status: 'completed',
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          transactionId: razorpayPaymentId
        };
        order.status = 'confirmed';
        order.tracking.confirmed = order.tracking?.confirmed?.status
          ? order.tracking.confirmed
          : { status: true, timestamp: new Date() };
        await order.save();
      }

      // Best-effort recovery: if settlement/escrow missed previously, attempt once.
      try {
        const { default: OrderSettlement } = await import('../models/OrderSettlement.js');
        const settlement = await OrderSettlement.findOne({ orderId: order._id }).lean();
        if (!settlement || settlement.escrowStatus !== 'held') {
          await calculateOrderSettlement(order._id);
          await holdEscrow(order._id, userId, order.pricing.total);
        }
      } catch (settlementError) {
        logger.error(`Ã¢ÂÅ’ Idempotency recovery failed for order ${order.orderId}:`, settlementError);
      }

      return res.json({
        success: true,
        data: {
          order: {
            id: order._id.toString(),
            orderId: order.orderId,
            status: order.status
          },
          payment: {
            id: existingPayment._id?.toString?.() || existingPayment.paymentId,
            paymentId: existingPayment.paymentId,
            status: existingPayment.status
          },
          idempotent: true
        }
      });
    }

    // Verify payment signature
    const isValid = await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      // Update order payment status to failed
      order.payment.status = 'failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Create payment record
    const payment = new Payment({
      paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: order._id,
      userId,
      amount: order.pricing.total,
      currency: 'INR',
      method: 'razorpay',
      status: 'completed',
      razorpay: {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature
      },
      transactionId: razorpayPaymentId,
      completedAt: new Date(),
      logs: [{
        action: 'completed',
        timestamp: new Date(),
        details: {
          razorpayOrderId,
          razorpayPaymentId
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }]
    });

    await payment.save();

    // Update order status
    order.payment.status = 'completed';
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.transactionId = razorpayPaymentId;
    order.status = 'confirmed';
    order.tracking.confirmed = { status: true, timestamp: new Date() };
    await order.save();

    // Increment coupon usage if used
    if (order.pricing?.couponCode) {
      await incrementCouponUsage(order.pricing.couponCode);
    }

    // Calculate order settlement and hold escrow
    try {
      // Calculate settlement breakdown
      const { default: OrderSettlement } = await import('../models/OrderSettlement.js');
      const existingSettlement = await OrderSettlement.findOne({ orderId: order._id }).lean();

      if (!existingSettlement) {
        await calculateOrderSettlement(order._id);
      }

      if (!existingSettlement || existingSettlement.escrowStatus !== 'held') {
        await holdEscrow(order._id, userId, order.pricing.total);
      }

      logger.info(`Ã¢Å“â€¦ Order settlement calculated and escrow held for order ${order.orderId}`);
    } catch (settlementError) {
      logger.error(`Ã¢ÂÅ’ Error calculating settlement for order ${order.orderId}:`, settlementError);
      // Don't fail payment verification if settlement calculation fails
      // But log it for investigation
    }

    // Notify cafe about confirmed order (payment verified)
    try {
      const cafeId = order.cafeId?.toString() || order.cafeId;
      const cafeName = order.cafeName;

      // CRITICAL: Log detailed info before notification
      logger.info('Ã°Å¸â€â€ CRITICAL: Attempting to notify cafe about confirmed order:', {
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        cafeId: cafeId,
        cafeName: cafeName,
        cafeIdType: typeof cafeId,
        orderCafeId: order.cafeId,
        orderCafeIdType: typeof order.cafeId,
        orderStatus: order.status,
        orderCreatedAt: order.createdAt,
        orderItems: order.items.map(item => ({ name: item.name, quantity: item.quantity }))
      });

      // Verify order has cafeId before notifying
      if (!cafeId) {
        logger.error('Ã¢ÂÅ’ CRITICAL: Cannot notify cafe - order.cafeId is missing!', {
          orderId: order.orderId,
          order: {
            _id: order._id?.toString(),
            cafeId: order.cafeId,
            cafeName: order.cafeName
          }
        });
        throw new Error('Order cafeId is missing');
      }

      // Verify order has cafeName before notifying
      if (!cafeName) {
        logger.warn('Ã¢Å¡Â Ã¯Â¸Â Order cafeName is missing:', {
          orderId: order.orderId,
          cafeId: cafeId
        });
      }

      const notificationResult = await notifyCafeNewOrder(order, cafeId);
      await notifyUserOrderStatusUpdate(order, 'confirmed');

      logger.info(`Ã¢Å“â€¦ Successfully notified cafe about confirmed order:`, {
        orderId: order.orderId,
        cafeId: cafeId,
        cafeName: cafeName,
        notificationResult: notificationResult
      });
    } catch (notificationError) {
      logger.error(`Ã¢ÂÅ’ CRITICAL: Error notifying cafe after payment verification:`, {
        error: notificationError.message,
        stack: notificationError.stack,
        orderId: order.orderId,
        orderMongoId: order._id?.toString(),
        cafeId: order.cafeId,
        cafeName: order.cafeName,
        orderStatus: order.status
      });
      // Don't fail payment verification if notification fails
      // Order is still saved and cafe can fetch it via API
      // But log it as critical for debugging
    }

    logger.info(`Order payment verified: ${order.orderId}`, {
      orderId: order.orderId,
      paymentId: payment.paymentId,
      razorpayPaymentId
    });

    res.json({
      success: true,
      data: {
        order: {
          id: order._id.toString(),
          orderId: order.orderId,
          status: order.status
        },
        payment: {
          id: payment._id.toString(),
          paymentId: payment.paymentId,
          status: payment.status
        }
      }
    });
  } catch (error) {
    logger.error(`Error verifying order payment: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user orders
 */
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { status, limit = 20, page = 1 } = req.query;

    if (!userId) {
      logger.error('User ID not found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Build query - MongoDB should handle string/ObjectId conversion automatically
    // But we'll try both formats to be safe
    const mongoose = (await import('mongoose')).default;
    const query = { userId };

    // If userId is a string that looks like ObjectId, also try ObjectId format
    if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
      query.$or = [
        { userId: userId },
        { userId: new mongoose.Types.ObjectId(userId) }
      ];
      delete query.userId; // Remove direct userId since we're using $or
    }

    // Add status filter if provided
    if (status) {
      if (query.$or) {
        // Add status to each $or condition
        query.$or = query.$or.map(condition => ({ ...condition, status }));
      } else {
        query.status = status;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    logger.info(`Fetching orders for user: ${userId}, query: ${JSON.stringify(query)}`);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      // Explicitly exclude legacy/extra fields (e.g. `rating`) that may exist in DB from other modules.
      .select('-__v -rating')
      .populate('cafeId', 'name slug profileImage address location')
      .populate('userId', 'name phone email')
      .lean();

    const orderIds = orders.map(order => order._id).filter(Boolean);
    const paymentMap = new Map();

    if (orderIds.length > 0) {
      const payments = await Payment.find({ orderId: { $in: orderIds } })
        .select('orderId method status completedAt failedAt updatedAt')
        .lean();

      payments.forEach((payment) => {
        if (payment?.orderId) {
          paymentMap.set(payment.orderId.toString(), payment);
        }
      });
    }

    const reconciledOrders = orders.map((order) => {
      const paymentRecord = order._id ? paymentMap.get(order._id.toString()) : null;
      if (!paymentRecord) {
        return order;
      }

      const orderPaymentMethod = (order.payment?.method || '').toString().toLowerCase();
      const recordPaymentMethod = (paymentRecord.method || '').toString().toLowerCase();
      const isCashOrder = ['cash', 'cod'].includes(orderPaymentMethod) || ['cash', 'cod'].includes(recordPaymentMethod);

      if (!isCashOrder) {
        return order;
      }

      return {
        ...order,
        payment: {
          ...(order.payment || {}),
          method: order.payment?.method || paymentRecord.method,
          status: paymentRecord.status || order.payment?.status,
          completedAt: paymentRecord.completedAt || order.payment?.completedAt,
          failedAt: paymentRecord.failedAt || order.payment?.failedAt,
          updatedAt: paymentRecord.updatedAt || order.payment?.updatedAt
        }
      };
    });

    // Attach user order rating from FeedbackExperience (module: user), so UI doesn't depend on delivery module fields.
    // Prefer Order.review.rating if present.
    const orderMongoIds = reconciledOrders
      .map((order) => order?._id?.toString())
      .filter(Boolean);
    const orderIdStrings = reconciledOrders
      .map((order) => order?.orderId?.toString())
      .filter(Boolean);

    const ratingByOrderMongoId = new Map();
    const ratingByOrderId = new Map();

    if (orderMongoIds.length > 0 || orderIdStrings.length > 0) {
      const feedbackUserId =
        typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
          ? new mongoose.Types.ObjectId(userId)
          : userId;

      const feedbackQuery = {
        userId: feedbackUserId,
        module: 'user',
        $or: [
          ...(orderMongoIds.length > 0
            ? [{ 'metadata.orderMongoId': { $in: orderMongoIds } }]
            : []),
          ...(orderIdStrings.length > 0
            ? [{ 'metadata.orderId': { $in: orderIdStrings } }]
            : [])
        ]
      };

      const feedbacks = await FeedbackExperience.find(feedbackQuery)
        .select('rating metadata createdAt')
        .sort({ createdAt: -1 })
        .lean();

      for (const feedback of feedbacks) {
        const mongoIdKey = feedback?.metadata?.orderMongoId?.toString();
        const orderIdKey = feedback?.metadata?.orderId?.toString();
        const ratingValue = feedback?.rating;

        if (mongoIdKey && !ratingByOrderMongoId.has(mongoIdKey)) {
          ratingByOrderMongoId.set(mongoIdKey, ratingValue);
        }
        if (orderIdKey && !ratingByOrderId.has(orderIdKey)) {
          ratingByOrderId.set(orderIdKey, ratingValue);
        }
      }
    }

    const enrichedOrders = reconciledOrders.map((order) => {
      const mongoIdKey = order?._id?.toString();
      const orderIdKey = order?.orderId?.toString();
      const feedbackRating =
        (mongoIdKey && ratingByOrderMongoId.get(mongoIdKey)) ||
        (orderIdKey && ratingByOrderId.get(orderIdKey)) ||
        null;

      const reviewRating = order?.review?.rating ?? null;
      const paymentMethod = order?.payment?.method;
      const isCod = paymentMethod === 'cash' || paymentMethod === 'cod';
      const fallbackCollectionStatus = isCod
        ? (order.status === 'delivered' || order.status === 'picked_up' ? 'Collected' : 'Not Collected')
        : 'Collected';

      return {
        ...order,
        userRating: reviewRating ?? feedbackRating,
        paymentCollectionStatus: order.paymentCollectionStatus || fallbackCollectionStatus
      };
    });

    const total = await Order.countDocuments(query);

    logger.info(`Found ${orders.length} orders for user ${userId} (total: ${total})`);

    res.json({
      success: true,
      data: {
        orders: enrichedOrders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error(`Error fetching user orders: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

/**
 * Get order details
 */
export const getOrderDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        userId
      })
        .populate('deliveryPartnerId', 'name email phone')
        .populate('userId', 'name fullName phone email')
        .lean();
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        userId
      })
        .populate('deliveryPartnerId', 'name email phone')
        .populate('userId', 'name fullName phone email')
        .lean();
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get payment details
    const payment = await Payment.findOne({
      orderId: order._id
    }).lean();

    res.json({
      success: true,
      data: {
        order,
        payment
      }
    });
  } catch (error) {
    logger.error(`Error fetching order details: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
};

/**
 * Cancel order by user
 * PATCH /api/order/:id/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    // Find order by MongoDB _id or orderId
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        userId
      });
    }

    if (!order) {
      order = await Order.findOne({
        orderId: id,
        userId
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    if (order.status === 'delivered' || order.status === 'picked_up') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a delivered order'
      });
    }

    // Get payment method from order or payment record
    const paymentMethod = order.payment?.method;
    const payment = await Payment.findOne({ orderId: order._id });
    const paymentMethodFromPayment = payment?.method || payment?.paymentMethod;

    // Determine the actual payment method
    const actualPaymentMethod = paymentMethod || paymentMethodFromPayment;

    // Allow cancellation for all payment methods (Razorpay, COD, Wallet)
    // Only restrict if order is already cancelled or delivered (checked above)

    // Update order status
    order.status = 'cancelled';
    order.cancellationReason = reason.trim();
    order.cancelledBy = 'user';
    order.cancelledAt = new Date();
    await order.save();

    // Notify user about cancellation
    try {
      await notifyUserOrderStatusUpdate(order, 'cancelled');
      // Also notify cafe
      await notifyCafeOrderUpdate(order._id.toString(), 'cancelled');
    } catch (notifError) {
      logger.error('Error sending cancellation notification:', notifError);
    }

    // Calculate refund amount only for online payments (Razorpay) and wallet
    // COD orders don't need refund since payment hasn't been made
    let refundMessage = '';
    if (actualPaymentMethod === 'razorpay' || actualPaymentMethod === 'wallet') {
      try {
        const { calculateCancellationRefund } = await import('../services/cancellationRefundService.js');
        await calculateCancellationRefund(order._id, reason);
        logger.info(`Cancellation refund calculated for order ${order.orderId} - awaiting admin approval`);
        refundMessage = ' Refund will be processed after admin approval.';
      } catch (refundError) {
        logger.error(`Error calculating cancellation refund for order ${order.orderId}:`, refundError);
        // Don't fail the cancellation if refund calculation fails
      }
    } else if (actualPaymentMethod === 'cash') {
      refundMessage = ' No refund required as payment was not made.';
    }

    res.json({
      success: true,
      message: `Order cancelled successfully.${refundMessage}`,
      data: {
        order: {
          orderId: order.orderId,
          status: order.status,
          cancellationReason: order.cancellationReason,
          cancelledAt: order.cancelledAt
        }
      }
    });
  } catch (error) {
    logger.error(`Error cancelling order: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    });
  }
};

/**
 * Calculate order pricing
 */
export const calculateOrder = async (req, res) => {
  try {
    const { items, cafeId, deliveryAddress, couponCode, orderType } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item'
      });
    }

    // Calculate pricing
    const pricing = await calculateOrderPricing({
      items,
      cafeId,
      deliveryAddress,
      couponCode,
      orderType
    });

    res.json({
      success: true,
      data: {
        pricing
      }
    });
  } catch (error) {
    logger.error(`Error calculating order pricing: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate order pricing',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get digital bill for an order
 * GET /api/order/:id/bill
 */
export const getOrderBill = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    // Check if user is admin or cafe owner or delivery boy or customer
    // For now, we'll assume basic auth handles user identification

    // Find order
    let order = null;
    let mongoose = (await import('mongoose')).default;

    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findById(id)
        .populate('cafeId', 'name address phone')
        .populate('userId', 'name phone')
        .lean();
    }

    if (!order) {
      order = await Order.findOne({ orderId: id })
        .populate('cafeId', 'name address phone')
        .populate('userId', 'name phone')
        .lean();
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if bill already exists
    if (order.billUrl) {
      return res.json({
        success: true,
        data: {
          billUrl: order.billUrl
        }
      });
    }

    // Generate bill if not exists
    const { generateBill } = await import('../services/billGenerationService.js');
    const billUrl = await generateBill(order);

    // Save bill URL to order
    await Order.findByIdAndUpdate(order._id, { billUrl });

    res.json({
      success: true,
      data: {
        billUrl
      }
    });

  } catch (error) {
    logger.error(`Error fetching order bill: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to generate/retrieve bill'
    });
  }
};

/**
 * Get digital bill HTML
 * GET /api/orders/:id/digital-bill
 */
export const getDigitalBillHtml = async (req, res) => {
  try {
    const { id } = req.params;

    // Find order
    let order = await Order.findById(id);
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (!order.digitalBillHtml) {
      // Try to generate it if missing
      order.digitalBillHtml = generateDigitalBillHtml(order);
      await order.save();
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(order.digitalBillHtml);
  } catch (error) {
    logger.error(`Error fetching digital bill: ${error.message}`);
    res.status(500).send('Server Error');
  }
};

/**
 * Helper to generate Digital Bill HTML
 */
function generateDigitalBillHtml(order) {
  try {
    const date = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const itemsHtml = (order.items || []).map(item => {
      const addonText = item.addons && item.addons.length > 0
        ? `<br><span style="font-size: 12px; color: #666;">Addons: ${item.addons.map(a => a.name).join(', ')}</span>`
        : '';
      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">
            <div style="font-weight: 500;">${item.name}</div>
            ${addonText}
          </td>
          <td style="padding: 10px; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; text-align: right;">Ã¢â€šÂ¹${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Bill #${order.orderId}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #f97316; margin-bottom: 10px; }
          .bill-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .bill-to { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; padding: 10px; background: #f8f9fa; border-bottom: 2px solid #ddd; }
          .totals { text-align: right; margin-top: 20px; }
          .total-row { display: flex; justify-content: flex-end; padding: 5px 0; }
          .total-label { width: 150px; }
          .total-value { width: 100px; font-weight: bold; }
          .grand-total { font-size: 1.2em; color: #f97316; border-top: 2px solid #eee; padding-top: 10px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Bun Burst</div>
          <div>Digital Bill</div>
        </div>
        
        <div class="bill-info">
          <div>
            <strong>Order ID:</strong> ${order.orderId}<br>
            <strong>Date:</strong> ${date}
          </div>
          <div style="text-align: right;">
            <strong>Status:</strong> ${(order.status || 'PENDING').toUpperCase()}
          </div>
        </div>

        <div class="bill-to">
          <strong>Bill To:</strong><br>
          ${order.customerName || 'Customer'}<br>
          ${order.address ? (order.address.formattedAddress || `${order.address.flat || ''} ${order.address.area || ''} ${order.address.city || ''}`) : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">Ã¢â€šÂ¹${(order.pricing.subtotal || 0).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Delivery Fee:</span>
            <span class="total-value">Ã¢â€šÂ¹${(order.pricing.deliveryFee || 0).toFixed(2)}</span>
          </div>
          ${order.pricing.tax > 0 ? `
          <div class="total-row">
            <span class="total-label">Tax:</span>
            <span class="total-value">Ã¢â€šÂ¹${order.pricing.tax.toFixed(2)}</span>
          </div>` : ''}
          ${order.pricing.discount > 0 ? `
          <div class="total-row" style="color: green;">
            <span class="total-label">Discount:</span>
            <span class="total-value">-Ã¢â€šÂ¹${order.pricing.discount.toFixed(2)}</span>
          </div>` : ''}
          <div class="total-row grand-total">
            <span class="total-label">Total:</span>
            <span class="total-value">Ã¢â€šÂ¹${(order.pricing.total || 0).toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for ordering with Bun Burst!</p>
          <p>This is a computer generated bill and does not require a physical signature.</p>
        </div>
      </body>
      </html>
    `;
  } catch (e) {
    console.error('Error generating bill HTML', e);
    return '<p>Error generating bill. Please contact support.</p>';
  }
}


