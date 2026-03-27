/**
 * API Configuration
 * Centralized configuration for API base URL and endpoints
 */

// Get API base URL from environment variable or use default
// IMPORTANT: Backend runs on port 5000, frontend on port 5173
let rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Normalize URL - fix common issues like double slashes, missing protocols
if (rawApiBaseUrl && typeof rawApiBaseUrl === "string") {
  // Remove leading/trailing whitespace
  rawApiBaseUrl = rawApiBaseUrl.trim();

  // Fix duplicate protocols (https://https:// becomes https://)
  rawApiBaseUrl = rawApiBaseUrl.replace(
    /^(https?:\/\/)+(https?:\/\/)+/gi,
    (match) => {
      const protocol = match.match(/^(https?):\/\//i)?.[1] || "https";
      return `${protocol}://`;
    },
  );

  // Fix malformed protocol patterns:
  // - https:/ becomes https://
  // - https: becomes https://
  // - https://https becomes https://
  rawApiBaseUrl = rawApiBaseUrl.replace(
    /^(https?):\/?(?=\/|$)/i,
    (match, protocol) => {
      return `${protocol}://`;
    },
  );

  // Fix patterns like https://https:// or http://http://
  rawApiBaseUrl = rawApiBaseUrl.replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

  // Fix multiple slashes after protocol (https:/// becomes https://)
  rawApiBaseUrl = rawApiBaseUrl.replace(/(https?:\/\/)\/+/g, "$1");

  // Ensure it ends with /api if not already
  if (!rawApiBaseUrl.endsWith("/api")) {
    // Remove trailing slash if exists
    rawApiBaseUrl = rawApiBaseUrl.replace(/\/$/, "");
    // Add /api if not present
    if (!rawApiBaseUrl.endsWith("/api")) {
      rawApiBaseUrl = rawApiBaseUrl + "/api";
    }
  }
}

export const API_BASE_URL = rawApiBaseUrl;

// Validate URL format - catch malformed URLs like "https:/" or "https://https://"
try {
  const urlObj = new URL(API_BASE_URL);
  if (!urlObj.protocol || !urlObj.hostname) {
    console.error("? Invalid API_BASE_URL format:", API_BASE_URL);
    console.error(
      "?? Expected format: https://your-domain.com/api or http://localhost:5000/api",
    );
  }
} catch (urlError) {
  console.error("? Invalid API_BASE_URL format:", API_BASE_URL);
  console.error("?? URL validation error:", urlError.message);
  console.error(
    "?? Raw VITE_API_BASE_URL:",
    import.meta.env.VITE_API_BASE_URL || "Not set",
  );
  console.error(
    "?? Expected format: https://your-domain.com/api or http://localhost:5000/api",
  );

  // Try to auto-fix common malformed patterns
  let fixedUrl = API_BASE_URL;
  // Fix patterns like "https:/" or "https://https://"
  if (fixedUrl.includes("://https://") || fixedUrl.includes("://http://")) {
    const parts = fixedUrl.split("://");
    fixedUrl = parts[0] + "://" + parts[parts.length - 1]; // Take first protocol and last part
    console.warn("?? Auto-fixing malformed URL pattern, new URL:", fixedUrl);
  }

  // If still invalid, warn but don't change it
  try {
    new URL(fixedUrl);
    console.warn("?? Consider using fixed URL:", fixedUrl);
  } catch (e) {
    // Still invalid, keep original
  }
}

// Validate API base URL
if (API_BASE_URL.includes("5173")) {
  console.error(
    "? ERROR: API_BASE_URL is pointing to frontend port (5173) instead of backend port (5000)",
  );
  console.error(
    "?? Fix: Set VITE_API_BASE_URL=http://localhost:5000/api in .env file",
  );
  console.error(
    "?? Or remove VITE_API_BASE_URL to use default: http://localhost:5000/api",
  );
}

// Log API base URL in both development and production for debugging


// Warn if API_BASE_URL is localhost in production
if (
  import.meta.env.MODE === "production" &&
  API_BASE_URL.includes("localhost")
) {
  console.error("? WARNING: API_BASE_URL is set to localhost in production!");
  console.error(
    "?? Fix: Set VITE_API_BASE_URL environment variable to your production backend URL",
  );
  console.error(
    "?? Example: VITE_API_BASE_URL=https://your-backend-domain.com/api",
  );
}

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    SEND_OTP: "/auth/send-otp",
    VERIFY_OTP: "/auth/verify-otp",
    REGISTER: "/auth/register",
    LOGIN: "/auth/login",
    FIREBASE_GOOGLE_LOGIN: "/auth/firebase/google-login",
    REFRESH_TOKEN: "/auth/refresh-token",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
  },
  // User endpoints
  USER: {
    PROFILE: "/user/profile",
    ADDRESSES: "/user/addresses",
    PREFERENCES: "/user/preferences",
    WALLET: "/user/wallet",
    ORDERS: "/user/orders",
    LOCATION: "/user/location",
    COMPLAINTS: "/user/complaints",
    COMPLAINT_BY_ID: "/user/complaints/:id",
  },
  // Location endpoints
  LOCATION: {
    REVERSE_GEOCODE: "/location/reverse",
    NEARBY: "/location/nearby",
  },
  // Zone endpoints
  ZONE: {
    DETECT: "/zones/detect", // Public endpoint for zone detection
  },
  // Cafe endpoints
  CAFE: {
    AUTH: {
      SEND_OTP: "/cafe/auth/send-otp",
      VERIFY_OTP: "/cafe/auth/verify-otp",
      REGISTER: "/cafe/auth/register",
      LOGIN: "/cafe/auth/login",
      FIREBASE_GOOGLE_LOGIN: "/cafe/auth/firebase/google-login",
      REFRESH_TOKEN: "/cafe/auth/refresh-token",
      LOGOUT: "/cafe/auth/logout",
      ME: "/cafe/auth/me",
      REVERIFY: "/cafe/auth/reverify",
      RESET_PASSWORD: "/cafe/auth/reset-password",
    },
    PROFILE: "/cafe/profile",
    DELIVERY_STATUS: "/cafe/delivery-status",
    STAFF: "/cafe/staff",
    MENU: "/cafe/menu",
    MENU_BY_CAFE_ID: "/cafe/:id/menu",
    ADDONS_BY_CAFE_ID: "/cafe/:id/addons",
    MENU_ITEM_SCHEDULE: "/cafe/menu/item/schedule",
    MENU_ITEM_SCHEDULE_BY_ID: "/cafe/menu/item/schedule/:scheduleId",
    MENU_ITEM_SCHEDULE_BY_ITEM:
      "/cafe/menu/item/schedule/:sectionId/:itemId",
    ADDONS: "/cafe/menu/addons",
    ADDON: "/cafe/menu/addon",
    ADDON_BY_ID: "/cafe/menu/addon/:id",
    CATEGORIES: "/cafe/categories",
    CATEGORIES_ALL: "/cafe/categories/all",
    CATEGORY_BY_ID: "/cafe/categories/:id",
    CATEGORIES_REORDER: "/cafe/categories/reorder",
    INVENTORY: "/cafe/inventory",
    INVENTORY_BY_CAFE_ID: "/cafe/:id/inventory",
    OFFERS: "/cafe/offers",
    OFFERS_PUBLIC: "/cafe/offers/public",
    OFFER_BY_ID: "/cafe/offers/:id",
    OFFER_STATUS: "/cafe/offers/:id/status",
    COUPONS_BY_ITEM_ID: "/cafe/offers/item/:itemId/coupons",
    COUPONS_BY_ITEM_ID_PUBLIC:
      "/cafe/:cafeId/offers/item/:itemId/coupons",
    ORDERS: "/cafe/orders",
    ORDER_BY_ID: "/cafe/orders/:id",
    ORDER_ACCEPT: "/cafe/orders/:id/accept",
    ORDER_REJECT: "/cafe/orders/:id/reject",
    ORDER_PREPARING: "/cafe/orders/:id/preparing",
    ORDER_READY: "/cafe/orders/:id/ready",
    ORDER_RESEND_DELIVERY_NOTIFICATION:
      "/cafe/orders/:id/resend-delivery-notification",
    FINANCE: "/cafe/finance",
    WALLET: "/cafe/wallet",
    WALLET_TRANSACTIONS: "/cafe/wallet/transactions",
    WALLET_STATS: "/cafe/wallet/stats",
    WITHDRAWAL_REQUEST: "/cafe/withdrawal/request",
    WITHDRAWAL_REQUESTS: "/cafe/withdrawal/requests",
    COMPLAINTS: "/cafe/complaints",
    COMPLAINT_BY_ID: "/cafe/complaints/:id",
    COMPLAINT_RESPOND: "/cafe/complaints/:id/respond",
    ANALYTICS: "/cafe/analytics",
    LIST: "/cafe/list",
    UNDER_250: "/cafe/under-250",
    BY_ID: "/cafe/:id",
    BY_OWNER: "/cafe/owner/me",
  },
  // Delivery endpoints
  DELIVERY: {
    AUTH: {
      SEND_OTP: "/delivery/auth/send-otp",
      VERIFY_OTP: "/delivery/auth/verify-otp",
      REFRESH_TOKEN: "/delivery/auth/refresh-token",
      LOGOUT: "/delivery/auth/logout",
      ME: "/delivery/auth/me",
    },
    SIGNUP: {
      DETAILS: "/delivery/signup/details",
      DOCUMENTS: "/delivery/signup/documents",
    },
    DASHBOARD: "/delivery/dashboard",
    WALLET: "/delivery/wallet",
    WALLET_TRANSACTIONS: "/delivery/wallet/transactions",
    WALLET_STATS: "/delivery/wallet/stats",
    WALLET_WITHDRAW: "/delivery/wallet/withdraw",
    WALLET_EARNINGS: "/delivery/wallet/earnings",
    WALLET_COLLECT_PAYMENT: "/delivery/wallet/collect-payment",
    CLAIM_JOINING_BONUS: "/delivery/wallet/claim-joining-bonus",
    WALLET_DEPOSIT_CREATE_ORDER: "/delivery/wallet/deposit/create-order",
    WALLET_DEPOSIT_VERIFY: "/delivery/wallet/deposit/verify",
    ORDER_STATS: "/delivery/orders/stats",
    PROFILE: "/delivery/profile",
    ORDERS: "/delivery/orders",
    ORDER_BY_ID: "/delivery/orders/:orderId",
    ORDER_BILL: "/delivery/orders/:orderId/bill",
    ORDER_ACCEPT: "/delivery/orders/:orderId/accept",
    ORDER_REJECT: "/delivery/orders/:orderId/reject",
    ORDER_REACHED_PICKUP: "/delivery/orders/:orderId/reached-pickup",
    ORDER_CONFIRM_ID: "/delivery/orders/:orderId/confirm-order-id",
    ORDER_REACHED_DROP: "/delivery/orders/:orderId/reached-drop",
    ORDER_COMPLETE_DELIVERY: "/delivery/orders/:orderId/complete-delivery",
    TRIP_HISTORY: "/delivery/trip-history",
    TRIPS: "/delivery/orders/trips",
    EARNINGS: "/delivery/earnings",
    EARNINGS_ACTIVE_OFFERS: "/delivery/earnings/active-offers",
    LOCATION: "/delivery/location",
    ZONES_IN_RADIUS: "/delivery/zones/in-radius",
    REVERIFY: "/delivery/reverify",
    EMERGENCY_HELP: "/delivery/emergency-help",
    SUPPORT_TICKETS: "/delivery/support-tickets",
    SUPPORT_TICKET_BY_ID: "/delivery/support-tickets/:id",
    POCKET: "/delivery/pocket",
    POCKET_TRANSACTIONS: "/delivery/pocket/transactions",
  },
  // Admin endpoints
  ADMIN: {
    AUTH: {
      SIGNUP: "/admin/auth/signup",
      SIGNUP_OTP: "/admin/auth/signup/otp",
      LOGIN: "/admin/auth/login",
      LOGOUT: "/admin/auth/logout",
      ME: "/admin/auth/me",
    },
    PROFILE: "/admin/profile",
    CHANGE_PASSWORD: "/admin/settings/change-password",
    USERS: "/admin/users",
    USER_BY_ID: "/admin/users/:id",
    USER_STATUS: "/admin/users/:id/status",
    CAFES: "/admin/cafes",
    CAFE_BY_ID: "/admin/cafes/:id",
    CAFE_ANALYTICS: "/admin/cafe-analytics/:cafeId",
    CAFE_STATUS: "/admin/cafes/:id/status",
    CAFE_REQUESTS: "/admin/cafes/requests",
    CAFE_APPROVE: "/admin/cafes/:id/approve",
    CAFE_REJECT: "/admin/cafes/:id/reject",
    CAFE_DELETE: "/admin/cafes/:id",
    CAFE_MENU: "/admin/cafes/:id/menu",
    DELIVERY: "/admin/delivery",
    DELIVERY_PARTNERS: "/admin/delivery-partners",
    DELIVERY_PARTNERS_REQUESTS: "/admin/delivery-partners/requests",
    DELIVERY_PARTNER_BY_ID: "/admin/delivery-partners/:id",
    DELIVERY_PARTNER_APPROVE: "/admin/delivery-partners/:id/approve",
    DELIVERY_PARTNER_REJECT: "/admin/delivery-partners/:id/reject",
    DELIVERY_PARTNER_REVERIFY: "/admin/delivery-partners/:id/reverify",
    DELIVERY_PARTNER_STATUS: "/admin/delivery-partners/:id/status",
    DELIVERY_PARTNER_DELETE: "/admin/delivery-partners/:id",
    DELIVERY_PARTNER_BONUS: "/admin/delivery-partners/bonus",
    DELIVERY_PARTNER_REVIEWS: "/admin/delivery-partners/reviews",
    DELIVERY_PARTNER_BONUS_TRANSACTIONS:
      "/admin/delivery-partners/bonus/transactions",
    EARNING_ADDON: "/admin/earning-addon",
    EARNING_ADDON_BY_ID: "/admin/earning-addon/:id",
    EARNING_ADDON_STATUS: "/admin/earning-addon/:id/status",
    EARNING_ADDON_CHECK_COMPLETIONS: "/admin/earning-addon/check-completions",
    EARNING_ADDON_HISTORY: "/admin/earning-addon-history",
    EARNING_ADDON_HISTORY_BY_ID: "/admin/earning-addon-history/:id",
    EARNING_ADDON_HISTORY_CREDIT: "/admin/earning-addon-history/:id/credit",
    EARNING_ADDON_HISTORY_CANCEL: "/admin/earning-addon-history/:id/cancel",
    EARNING_ADDON_HISTORY_STATISTICS: "/admin/earning-addon-history/statistics",
    ABOUT: "/admin/about",
    ABOUT_PUBLIC: "/about/public",
    TERMS: "/admin/terms",
    TERMS_PUBLIC: "/terms/public",
    PRIVACY: "/admin/privacy",
    PRIVACY_PUBLIC: "/privacy/public",
    REFUND: "/admin/refund",
    REFUND_PUBLIC: "/refund/public",
    SHIPPING: "/admin/shipping",
    SHIPPING_PUBLIC: "/shipping/public",
    CANCELLATION: "/admin/cancellation",
    CANCELLATION_PUBLIC: "/cancellation/public",
    FEEDBACK: "/admin/feedback",
    FEEDBACK_CREATE: "/feedback",
    REVIEWS: "/admin/reviews",
    FEEDBACK_EXPERIENCE: "/admin/feedback-experience",
    FEEDBACK_EXPERIENCE_CREATE: "/feedback-experience",
    FEEDBACK_EXPERIENCE_BY_ID: "/admin/feedback-experience/:id",
    SAFETY_EMERGENCY: "/admin/safety-emergency",
    SAFETY_EMERGENCY_CREATE: "/safety-emergency",
    ENV_VARIABLES: "/admin/env-variables",
    ORDERS: "/admin/orders",
    ORDERS_SEARCHING_DELIVERYMAN: "/admin/orders/searching-deliveryman",
    ORDERS_ONGOING: "/admin/orders/ongoing",
    ORDERS_TRANSACTION_REPORT: "/admin/orders/transaction-report",
    ORDERS_CAFE_REPORT: "/admin/orders/cafe-report",
    ORDERS_ACCEPT: "/admin/orders/:orderId/accept",
    ORDERS_PREPARING: "/admin/orders/:orderId/preparing",
    ORDERS_READY_FOR_PICKUP: "/admin/orders/:orderId/ready-for-pickup",
    ORDERS_PICKED_UP: "/admin/orders/:orderId/picked-up",
    ORDERS_PAYMENT_COLLECTION: "/admin/orders/:orderId/payment-collection",
    CUSTOMER_WALLET_REPORT: "/admin/customer-wallet-report",
    WITHDRAWAL_REQUESTS: "/admin/withdrawal/requests",
    WITHDRAWAL_APPROVE: "/admin/withdrawal/:id/approve",
    WITHDRAWAL_REJECT: "/admin/withdrawal/:id/reject",
    BUSINESS_SETTINGS: "/admin/business-settings",
    BUSINESS_SETTINGS_PUBLIC: "/business-settings/public",
    ANALYTICS: "/admin/analytics",
    DASHBOARD_STATS: "/admin/dashboard/stats",
    CATEGORIES: "/admin/categories",
    CATEGORIES_PUBLIC: "/categories/public",
    CATEGORY_BY_ID: "/admin/categories/:id",
    CATEGORY_STATUS: "/admin/categories/:id/status",
    ADDONS: "/admin/addons",
    ADDON_BY_ID: "/admin/addons/:id",
    ADDON_STATUS: "/admin/addons/:id/status",
    ADDONS_BY_CATEGORY: "/addons/by-category/:categoryId",
    CATEGORY_PRIORITY: "/admin/categories/:id/priority",
    FEE_SETTINGS: "/admin/fee-settings",
    FEE_SETTINGS_PUBLIC: "/fee-settings/public",
    FEE_SETTINGS_HISTORY: "/admin/fee-settings/history",
    FEE_SETTINGS_BY_ID: "/admin/fee-settings/:id",
    DELIVERY_BOY_WALLET: "/admin/delivery-boy-wallet",
    DELIVERY_BOY_WALLET_ADJUSTMENT: "/admin/delivery-boy-wallet/adjustment",
    DELIVERY_WALLETS: "/admin/delivery-wallets",
    DELIVERY_WALLETS_SETTLE: "/admin/delivery-wallets/settle",
    DELIVERY_EMERGENCY_HELP: "/admin/delivery-emergency-help",
    DELIVERY_EMERGENCY_HELP_STATUS: "/admin/delivery-emergency-help/status",
    DELIVERY_SUPPORT_TICKETS: "/admin/delivery-support-tickets",
    DELIVERY_SUPPORT_TICKET_BY_ID: "/admin/delivery-support-tickets/:id",
    DELIVERY_SUPPORT_TICKETS_STATS: "/admin/delivery-support-tickets/stats",
    CAFE_COMMISSION: "/admin/cafe-commission",
    CAFE_COMMISSION_APPROVED_CAFES:
      "/admin/cafe-commission/approved-cafes",
    CAFE_COMMISSION_BY_CAFE_ID:
      "/admin/cafe-commission/cafe/:cafeId",
    CAFE_COMMISSION_BY_ID: "/admin/cafe-commission/:id",
    CAFE_COMMISSION_STATUS: "/admin/cafe-commission/:id/status",
    CAFE_COMMISSION_CALCULATE: "/admin/cafe-commission/calculate",
    CAFE_COMPLAINTS: "/admin/cafe-complaints",
    CAFE_COMPLAINT_BY_ID: "/admin/cafe-complaints/:id",
    CAFE_COMPLAINT_STATUS: "/admin/cafe-complaints/:id/status",
    CAFE_COMPLAINT_NOTES: "/admin/cafe-complaints/:id/notes",
    FOOD_APPROVALS: "/admin/food-approvals",
    FOOD_APPROVAL_APPROVE: "/admin/food-approvals/:id/approve",
    FOOD_APPROVAL_REJECT: "/admin/food-approvals/:id/reject",
    OFFERS: "/admin/offers",
    OFFERS_ITEM_UPDATE: "/admin/offers/:offerId/items",
    ZONES: "/admin/zones",
    ZONE_BY_ID: "/admin/zones/:id",
    ZONE_STATUS: "/admin/zones/:id/status",
    DINING_DATE: "/admin/dining/date",
    DINING_TIMESLOTS: "/admin/dining/timeslots",
    DINING_CONFIG: "/admin/dining/config/:cafeId",
    DINING_TABLES: "/admin/tables",
    DINING_BOOKING_REQUESTS: "/admin/dining/booking-requests",
    DINING_BOOKING_APPROVE: "/admin/dining/approve/:bookingId",
    DINING_BOOKING_REJECT: "/admin/dining/reject/:bookingId",
    COUPONS: "/admin/coupons",
    COUPON_BY_ID: "/admin/coupons/:id",
    COUPON_TOGGLE: "/admin/coupons/:id/toggle",
  },
  // Order endpoints
  ORDER: {
    CREATE: "/order",
    LIST: "/order",
    DETAILS: "/order/:id",
    CUSTOMER_REVIEW: "/order/:id/customer-review",
    UPDATE_STATUS: "/order/:id/status",
    VERIFY_PAYMENT: "/order/verify-payment",
    CALCULATE: "/order/calculate",
    CANCEL: "/order/:id/cancel",
    BILL: "/order/:id/bill",
  },
  // Payment endpoints
  PAYMENT: {
    METHODS: "/payment/methods",
    PROCESS: "/payment/process",
    WALLET: "/payment/wallet",
  },
  // Menu endpoints
  MENU: {
    CATEGORIES: "/menu/categories",
    ITEMS: "/menu/items",
    SEARCH: "/menu/search",
  },
  // Upload / media endpoints
  UPLOAD: {
    MEDIA: "/upload/media",
  },
  // Hero Banner endpoints
  HERO_BANNER: {
    PUBLIC: "/hero-banners/public",
    LIST: "/hero-banners",
    CREATE: "/hero-banners",
    DELETE: "/hero-banners/:id",
    UPDATE_ORDER: "/hero-banners/:id/order",
    TOGGLE_STATUS: "/hero-banners/:id/status",
    TOP_10_PUBLIC: "/hero-banners/top-10/public",
    GOURMET_PUBLIC: "/hero-banners/gourmet/public",
  },
  // Notification endpoints
  NOTIFICATION: {
    ADMIN_SEND: "/notification/admin/send",
    ADMIN_LIST: "/notification/admin",
    ADMIN_UPDATE: "/notification/admin/:id",
    ADMIN_STATUS: "/notification/admin/:id/status",
    ADMIN_DELETE: "/notification/admin/:id",
    USER_FCM_TOKEN: "/notification/user/token",
    DELIVERY_FCM_TOKEN: "/notification/delivery/token",
    CAFE_FCM_TOKEN: "/notification/cafe/token",
    TEST: "/notification/test-notification",
    REMOVE_USER_FCM_TOKEN: "/notification/user/token",
    REMOVE_DELIVERY_FCM_TOKEN: "/notification/delivery/token",
    REMOVE_CAFE_FCM_TOKEN: "/notification/cafe/token",
  },
  // Dining endpoints
  DINING: {
    CAFES: "/dining/cafes",
    CAFE_BY_SLUG: "/dining/cafes/:slug",
    CATEGORIES: "/dining/categories",
    LIMELIGHT: "/dining/limelight",
    BANK_OFFERS: "/dining/bank-offers",
    MUST_TRIES: "/dining/must-tries",
    OFFER_BANNERS: "/dining/offer-banners",
    STORIES: "/dining/stories",
    DATES: "/dining/dates",
    AVAILABILITY: "/dining/availability",
    BOOK: "/dining/book",
    MY_BOOKINGS: "/dining/my-bookings",
    CHECKIN: "/dining/checkin/:bookingId",
    BOOKING_CREATE: "/dining/bookings",
    BOOKING_MY: "/dining/bookings/my",
    BOOKING_CAFE: "/dining/bookings/cafe/:cafeId",
    BOOKING_STATUS: "/dining/bookings/:bookingId/status",
    BOOKING_STATUS_CAFE: "/dining/bookings/:bookingId/status/cafe",
    REVIEW_CREATE: "/dining/reviews",
  },
  COUPON: {
    APPLY: "/coupons/apply",
    LIST: "/coupons/active",
  },
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
