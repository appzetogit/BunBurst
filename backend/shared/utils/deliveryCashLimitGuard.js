import BusinessSettings from '../../modules/admin/models/BusinessSettings.js';
import DeliveryWallet from '../../modules/delivery/models/DeliveryWallet.js';
import Payment from '../../modules/payment/models/Payment.js';

const CASH_METHODS = new Set(['cash', 'cod', 'cash on delivery']);

export async function resolveOrderPaymentMethod(order) {
  const rawMethod = (order?.payment?.method || '').toString().trim().toLowerCase();
  if (CASH_METHODS.has(rawMethod)) return 'cash';

  try {
    if (order?._id) {
      const paymentRecord = await Payment.findOne({ orderId: order._id }).select('method').lean();
      const paymentMethod = (paymentRecord?.method || '').toString().trim().toLowerCase();
      if (CASH_METHODS.has(paymentMethod)) return 'cash';
    }
  } catch (error) {
    console.warn('⚠️ Failed to resolve payment method from Payment collection:', error?.message || error);
  }

  return rawMethod || 'online';
}

export async function getDeliveryCashLimitContext(deliveryPartnerId) {
  const [settings, wallet] = await Promise.all([
    BusinessSettings.getSettings(),
    DeliveryWallet.findOne({ deliveryPartnerId }).select('cashInHand').lean()
  ]);

  const totalCashLimit = Math.max(0, Number(settings?.deliveryCashLimit) || 0);
  const cashInHand = Math.max(0, Number(wallet?.cashInHand) || 0);
  const availableCashLimit = Math.max(0, totalCashLimit - cashInHand);

  return {
    totalCashLimit,
    cashInHand,
    availableCashLimit
  };
}

export async function canDeliveryPartnerTakeCodOrder(deliveryPartnerId) {
  const context = await getDeliveryCashLimitContext(deliveryPartnerId);
  return {
    allowed: context.availableCashLimit > 0,
    ...context
  };
}

