import crypto from 'crypto';
import Payment from '../models/Payment.js';
import OrderSettlement from '../../order/models/OrderSettlement.js';
import { getRazorpayWebhookSecret } from '../../../shared/utils/envService.js';

function safeJsonBuffer(value) {
  try {
    return Buffer.from(JSON.stringify(value ?? {}));
  } catch {
    return Buffer.from('{}');
  }
}

function verifyRazorpaySignature({ rawBody, signature, secret }) {
  if (!secret || typeof secret !== 'string') return false;
  if (!signature || typeof signature !== 'string') return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function getRefundEntity(payload) {
  return (
    payload?.refund?.entity ||
    payload?.refund ||
    payload?.payload?.refund?.entity ||
    null
  );
}

function getPaymentEntity(payload) {
  return (
    payload?.payment?.entity ||
    payload?.payment ||
    payload?.payload?.payment?.entity ||
    null
  );
}

export async function handleRazorpayWebhook(req, res) {
  try {
    const secret = await getRazorpayWebhookSecret();
    if (!secret) {
      // Non-breaking: acknowledge webhook even if secret is not configured.
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'RAZORPAY_WEBHOOK_SECRET not configured'
      });
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : safeJsonBuffer(req.body);

    const isValid = verifyRazorpaySignature({
      rawBody,
      signature,
      secret
    });

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = String(req.body?.event || '');
    const payload = req.body?.payload || {};

    // Refund lifecycle: update settlement + payment refund fields (best-effort, idempotent).
    if (event.startsWith('refund.')) {
      const refund = getRefundEntity(payload);
      const refundId = refund?.id ? String(refund.id) : '';
      const refundStatusRaw = refund?.status ? String(refund.status) : '';
      const paymentId = refund?.payment_id ? String(refund.payment_id) : '';
      const refundAmount = typeof refund?.amount === 'number' ? refund.amount / 100 : null; // paise -> INR

      if (refundId) {
        const nextStatus =
          refundStatusRaw === 'processed'
            ? 'processed'
            : refundStatusRaw === 'failed'
              ? 'failed'
              : null;

        if (nextStatus) {
          await OrderSettlement.updateOne(
            { 'cancellationDetails.razorpayRefundId': refundId },
            {
              $set: {
                'cancellationDetails.refundStatus': nextStatus,
                ...(nextStatus === 'processed'
                  ? { 'cancellationDetails.refundProcessedAt': new Date() }
                  : {}),
                ...(nextStatus === 'failed'
                  ? { 'cancellationDetails.refundFailureReason': refund?.failure_reason || refund?.error_reason || '' }
                  : {})
              }
            }
          );
        }
      }

      if (paymentId) {
        const payment = await Payment.findOne({
          $or: [
            { transactionId: paymentId },
            { 'razorpay.paymentId': paymentId }
          ]
        });

        if (payment) {
          if (typeof refundAmount === 'number') {
            payment.refund = payment.refund || {};
            payment.refund.amount = refundAmount;
            payment.refund.refundId = refundId || payment.refund.refundId;

            const isFull = payment.amount && refundAmount >= payment.amount;
            payment.refund.status = isFull ? 'full' : 'partial';
            payment.refund.refundedAt = new Date();
          }
          if (refundStatusRaw === 'processed') {
            payment.status = 'refunded';
          }
          await payment.save();
        }
      }

      return res.status(200).json({ success: true });
    }

    // Payment failure webhook: update Payment record if it exists (do not auto-confirm orders here).
    if (event === 'payment.failed') {
      const paymentEntity = getPaymentEntity(payload);
      const paymentId = paymentEntity?.id ? String(paymentEntity.id) : '';
      if (paymentId) {
        await Payment.updateMany(
          { $or: [{ transactionId: paymentId }, { 'razorpay.paymentId': paymentId }] },
          { $set: { status: 'failed', failedAt: new Date(), failureReason: paymentEntity?.error_description || '' } }
        );
      }
      return res.status(200).json({ success: true });
    }

    // Default: acknowledge without mutating core business flow.
    return res.status(200).json({ success: true });
  } catch (error) {
    // Webhook endpoints should still return 200 to prevent repeated retries on internal errors,
    // but include an error marker for observability.
    return res.status(200).json({ success: false, error: error?.message || 'Webhook handler error' });
  }
}

