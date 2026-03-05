export async function resolveOrderPaymentMethod(order) {
  const rawMethod = (order?.payment?.method || '').toString().trim().toLowerCase();
  const CASH_METHODS = new Set(['cash', 'cod', 'cash on delivery']);
  if (CASH_METHODS.has(rawMethod)) return 'cash';
  return rawMethod || 'online';
}

export async function getDeliveryCashLimitContext(deliveryPartnerId) {
  return {
    totalCashLimit: 0,
    cashInHand: 0,
    availableCashLimit: 0
  };
}

export async function canDeliveryPartnerTakeCodOrder(deliveryPartnerId) {
  return {
    allowed: true,
    totalCashLimit: 0,
    cashInHand: 0,
    availableCashLimit: 0
  };
}
