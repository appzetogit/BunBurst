/**
 * API Client
 * Centralized API client for all modules (user, cafe, delivery, admin)
 *
 * Usage:
 * import api from '@/lib/api'
 *
 * // GET request
 * const response = await api.get('/user/profile')
 *
 * // POST request
 * const response = await api.post('/auth/login', { email, password })
 *
 * // PUT request
 * const response = await api.put('/user/profile', { name, email })
 *
 * // DELETE request
 * const response = await api.delete('/user/addresses/:id')
 */

import apiClient from "./axios.js";
import { API_ENDPOINTS } from "./config.js";

// Export the configured axios instance
export default apiClient;

// Export API endpoints and base URL for convenience
export { API_ENDPOINTS, API_BASE_URL } from "./config.js";

// Export helper functions for common operations
export const api = {
  // GET request
  get: (url, config = {}) => {
    return apiClient.get(url, config);
  },

  // POST request
  post: (url, data = {}, config = {}) => {
    return apiClient.post(url, data, config);
  },

  // PUT request
  put: (url, data = {}, config = {}) => {
    return apiClient.put(url, data, config);
  },

  // PATCH request
  patch: (url, data = {}, config = {}) => {
    return apiClient.patch(url, data, config);
  },

  // DELETE request
  delete: (url, config = {}) => {
    return apiClient.delete(url, config);
  },
};

// Export auth helper functions
export const authAPI = {
  // Send OTP (supports both phone and email)
  sendOTP: (phone = null, purpose = "login", email = null) => {
    const payload = { purpose };
    if (phone) payload.phone = phone;
    if (email) payload.email = email;
    return apiClient.post(API_ENDPOINTS.AUTH.SEND_OTP, payload);
  },

  // Verify OTP (supports both phone and email)
  // 'password' is used only for email/password registrations (e.g. admin signup)
  verifyOTP: (
    phone = null,
    otp,
    purpose = "login",
    name = null,
    email = null,
    role = "user",
    password = null,
  ) => {
    const payload = {
      otp,
      purpose,
      role,
    };
    if (phone != null) payload.phone = phone;
    if (email != null) payload.email = email;
    if (name != null) payload.name = name;
    if (password != null) payload.password = password; // don't send null, Joi expects string
    return apiClient.post(API_ENDPOINTS.AUTH.VERIFY_OTP, payload);
  },

  // Register with email/password
  register: (name, email, password, phone = null, role = "user") => {
    return apiClient.post(API_ENDPOINTS.AUTH.REGISTER, {
      name,
      email,
      password,
      phone,
      role,
    });
  },

  // Login with email/password
  login: (email, password, role = null) => {
    const payload = { email, password };
    if (role) payload.role = role;
    return apiClient.post(API_ENDPOINTS.AUTH.LOGIN, payload);
  },

  // Login/Register via Firebase Google ID token
  firebaseGoogleLogin: (idToken, role = "cafe") => {
    return apiClient.post(API_ENDPOINTS.AUTH.FIREBASE_GOOGLE_LOGIN, {
      idToken,
      role,
    });
  },

  // Refresh token
  refreshToken: () => {
    return apiClient.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN);
  },

  // Logout
  logout: () => {
    return apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  // Get current user
  getCurrentUser: () => {
    return apiClient.get(API_ENDPOINTS.AUTH.ME);
  },
};

// Export user API helper functions
export const userAPI = {
  // Get user profile
  getProfile: () => {
    return apiClient.get(API_ENDPOINTS.USER.PROFILE);
  },

  // Update user profile
  updateProfile: (data) => {
    return apiClient.put(API_ENDPOINTS.USER.PROFILE, data);
  },

  // Upload profile image
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.post("/user/profile/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Get user addresses
  getAddresses: () => {
    return apiClient.get(API_ENDPOINTS.USER.ADDRESSES);
  },

  // Add address
  addAddress: (address) => {
    return apiClient.post(API_ENDPOINTS.USER.ADDRESSES, address);
  },

  // Update address
  updateAddress: (addressId, address) => {
    return apiClient.put(
      `${API_ENDPOINTS.USER.ADDRESSES}/${addressId}`,
      address,
    );
  },

  // Delete address
  deleteAddress: (addressId) => {
    return apiClient.delete(`${API_ENDPOINTS.USER.ADDRESSES}/${addressId}`);
  },

  // Get user preferences
  getPreferences: () => {
    return apiClient.get(API_ENDPOINTS.USER.PREFERENCES);
  },

  // Update preferences
  updatePreferences: (preferences) => {
    return apiClient.put(API_ENDPOINTS.USER.PREFERENCES, preferences);
  },

  // Get wallet
  getWallet: () => {
    return apiClient.get(API_ENDPOINTS.USER.WALLET);
  },

  // Get wallet transactions
  getWalletTransactions: (params = {}) => {
    return apiClient.get(`${API_ENDPOINTS.USER.WALLET}/transactions`, {
      params,
    });
  },

  // Test Push Notifications
  testPushNotification: (token) => {
    return apiClient.post(API_ENDPOINTS.NOTIFICATION.TEST, { token });
  },

  // Create Razorpay order for wallet top-up
  createWalletTopupOrder: (amount) => {
    return apiClient.post(`${API_ENDPOINTS.USER.WALLET}/create-topup-order`, {
      amount,
    });
  },

  // Verify payment and add money to wallet
  verifyWalletTopupPayment: (data) => {
    return apiClient.post(
      `${API_ENDPOINTS.USER.WALLET}/verify-topup-payment`,
      data,
    );
  },

  // Add money to wallet (direct - internal use)
  addMoneyToWallet: (data) => {
    return apiClient.post(`${API_ENDPOINTS.USER.WALLET}/add-money`, data);
  },

  // Get user orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.USER.ORDERS, { params });
  },

  // Get user location
  getLocation: () => {
    return apiClient.get(API_ENDPOINTS.USER.LOCATION);
  },

  // Update user location
  updateLocation: (locationData) => {
    return apiClient.put(API_ENDPOINTS.USER.LOCATION, locationData);
  },

  // Save user FCM token
  saveFcmToken: (token, platform = "web") => {
    return apiClient.post(API_ENDPOINTS.NOTIFICATION.USER_FCM_TOKEN, {
      token,
      platform,
    });
  },
  // Remove user FCM token (for logout)
  removeFcmToken: (token, platform = "web") => {
    return apiClient.delete(API_ENDPOINTS.NOTIFICATION.REMOVE_USER_FCM_TOKEN, {
      data: { token, platform },
    });
  },
};

// Export location API helper functions
export const locationAPI = {
  // Reverse geocode coordinates to address
  reverseGeocode: (lat, lng) => {
    return apiClient.get(API_ENDPOINTS.LOCATION.REVERSE_GEOCODE, {
      params: { lat, lng },
    });
  },
  // Get nearby locations
  getNearbyLocations: (lat, lng, radius = 500, query = "") => {
    return apiClient.get(API_ENDPOINTS.LOCATION.NEARBY, {
      params: { lat, lng, radius, query },
    });
  },
};

// Export zone API helper functions
export const zoneAPI = {
  // Detect user's zone based on location
  detectZone: (lat, lng) => {
    return apiClient.get(API_ENDPOINTS.ZONE.DETECT, {
      params: { lat, lng },
    });
  },
};

// Export cafe API helper functions
export const cafeAPI = {
  // Cafe Authentication
  sendOTP: (phone = null, purpose = "login", email = null) => {
    const payload = { purpose };
    if (phone) payload.phone = phone;
    if (email) payload.email = email;
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.SEND_OTP, payload);
  },

  verifyOTP: (
    phone = null,
    otp,
    purpose = "login",
    name = null,
    email = null,
    password = null,
  ) => {
    const payload = {
      otp,
      purpose,
    };
    if (phone != null) payload.phone = phone;
    if (email != null) payload.email = email;
    if (name != null) payload.name = name;
    if (password != null) payload.password = password;
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.VERIFY_OTP, payload);
  },

  register: (
    name,
    email,
    password,
    phone = null,
    ownerName = null,
    ownerEmail = null,
    ownerPhone = null,
  ) => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.REGISTER, {
      name,
      email,
      password,
      phone,
      ownerName,
      ownerEmail,
      ownerPhone,
    });
  },

  login: (email, password) => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.LOGIN, {
      email,
      password,
    });
  },

  firebaseGoogleLogin: (idToken) => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.FIREBASE_GOOGLE_LOGIN, {
      idToken,
    });
  },

  refreshToken: () => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.REFRESH_TOKEN);
  },

  logout: () => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.LOGOUT);
  },

  getCurrentCafe: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.AUTH.ME);
  },

  reverify: () => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.REVERIFY);
  },

  resetPassword: (email, otp, newPassword) => {
    return apiClient.post(API_ENDPOINTS.CAFE.AUTH.RESET_PASSWORD, {
      email,
      otp,
      newPassword,
    });
  },

  // Get cafe profile
  getProfile: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.PROFILE);
  },

  // Update cafe profile
  updateProfile: (data) => {
    return apiClient.put(API_ENDPOINTS.CAFE.PROFILE, data);
  },

  // Delete cafe account
  deleteAccount: () => {
    return apiClient.delete(API_ENDPOINTS.CAFE.PROFILE);
  },

  // Update delivery status (isAcceptingOrders)
  updateDeliveryStatus: (isAcceptingOrders) => {
    return apiClient.put(API_ENDPOINTS.CAFE.DELIVERY_STATUS, {
      isAcceptingOrders,
    });
  },

  // Upload profile image
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post(
      `${API_ENDPOINTS.CAFE.PROFILE}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },

  // Upload menu image
  uploadMenuImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post(
      `${API_ENDPOINTS.CAFE.PROFILE}/menu-image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },

  // Staff Management
  addStaff: (data) => {
    // If data is FormData, set appropriate headers
    const config =
      data instanceof FormData
        ? {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
        : {};
    return apiClient.post(API_ENDPOINTS.CAFE.STAFF, data, config);
  },
  getStaff: (role) => {
    const url = role
      ? `${API_ENDPOINTS.CAFE.STAFF}?role=${role}`
      : API_ENDPOINTS.CAFE.STAFF;
    return apiClient.get(url);
  },
  getStaffById: (id) => {
    return apiClient.get(`${API_ENDPOINTS.CAFE.STAFF}/${id}`);
  },
  updateStaff: (id, data) => {
    return apiClient.put(`${API_ENDPOINTS.CAFE.STAFF}/${id}`, data);
  },
  deleteStaff: (id) => {
    return apiClient.delete(`${API_ENDPOINTS.CAFE.STAFF}/${id}`);
  },

  // Menu operations
  getMenu: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.MENU);
  },
  updateMenu: (menuData) => {
    return apiClient.put(API_ENDPOINTS.CAFE.MENU, menuData);
  },
  addSection: (name) => {
    return apiClient.post(`${API_ENDPOINTS.CAFE.MENU}/section`, { name });
  },
  addItemToSection: (sectionId, item) => {
    return apiClient.post(`${API_ENDPOINTS.CAFE.MENU}/section/item`, {
      sectionId,
      item,
    });
  },
  addSubsectionToSection: (sectionId, name) => {
    return apiClient.post(
      `${API_ENDPOINTS.CAFE.MENU}/section/subsection`,
      { sectionId, name },
    );
  },
  addItemToSubsection: (sectionId, subsectionId, item) => {
    return apiClient.post(`${API_ENDPOINTS.CAFE.MENU}/subsection/item`, {
      sectionId,
      subsectionId,
      item,
    });
  },
  getMenuByCafeId: (cafeId, params = {}) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.MENU_BY_CAFE_ID.replace(
        ":id",
        cafeId,
      ),
      { params },
    );
  },

  // Get orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.ORDERS, { params });
  },

  // Get order by ID
  getOrderById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.ORDER_BY_ID.replace(":id", id),
    );
  },

  // Accept order
  acceptOrder: (id, preparationTime = null) => {
    return apiClient.patch(
      API_ENDPOINTS.CAFE.ORDER_ACCEPT.replace(":id", id),
      {
        preparationTime,
      },
    );
  },

  // Reject order
  rejectOrder: (id, reason = "") => {
    return apiClient.patch(
      API_ENDPOINTS.CAFE.ORDER_REJECT.replace(":id", id),
      {
        reason,
      },
    );
  },

  // Mark order as preparing
  markOrderPreparing: (id, options = {}) => {
    const url = API_ENDPOINTS.CAFE.ORDER_PREPARING.replace(":id", id);
    // Add resend query parameter if provided
    if (options.resend) {
      return apiClient.patch(`${url}?resend=true`);
    }
    return apiClient.patch(url);
  },

  // Mark order as ready
  markOrderReady: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.CAFE.ORDER_READY.replace(":id", id),
    );
  },

  // Resend delivery notification for unassigned order
  resendDeliveryNotification: (id) => {
    return apiClient.post(
      API_ENDPOINTS.CAFE.ORDER_RESEND_DELIVERY_NOTIFICATION.replace(
        ":id",
        id,
      ),
    );
  },

  // Get wallet
  getWallet: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.WALLET);
  },
  getWalletTransactions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.WALLET_TRANSACTIONS, {
      params,
    });
  },
  getWalletStats: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.WALLET_STATS, { params });
  },
  // Withdrawal
  createWithdrawalRequest: (amount) => {
    return apiClient.post(API_ENDPOINTS.CAFE.WITHDRAWAL_REQUEST, {
      amount,
    });
  },
  getWithdrawalRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.WITHDRAWAL_REQUESTS, {
      params,
    });
  },

  // Get analytics
  getAnalytics: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.ANALYTICS, { params });
  },

  // Get all cafes (for user module)
  getCafes: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.LIST, { params });
  },

  // Get cafes with dishes under ?250
  getCafesUnder250: (zoneId) => {
    const params = zoneId ? { zoneId } : {};
    return apiClient.get(API_ENDPOINTS.CAFE.UNDER_250, { params });
  },

  // Get cafe by ID or slug
  getCafeById: (id) => {
    return apiClient.get(API_ENDPOINTS.CAFE.BY_ID.replace(":id", id));
  },
  // Get coupons for item (public - for user cart)
  getCouponsByItemIdPublic: (cafeId, itemId) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.COUPONS_BY_ITEM_ID_PUBLIC.replace(
        ":cafeId",
        cafeId,
      ).replace(":itemId", itemId),
    );
  },
  // Get public offers (for user offers page)
  getPublicOffers: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.OFFERS_PUBLIC);
  },

  // Get cafe by owner (for cafe module)
  getCafeByOwner: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.BY_OWNER);
  },

  // Menu operations (for cafe module)
  getMenu: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.MENU);
  },
  updateMenu: (menuData) => {
    return apiClient.put(API_ENDPOINTS.CAFE.MENU, menuData);
  },
  addSection: (name) => {
    return apiClient.post(`${API_ENDPOINTS.CAFE.MENU}/section`, { name });
  },
  addItemToSection: (sectionId, item) => {
    return apiClient.post(`${API_ENDPOINTS.CAFE.MENU}/section/item`, {
      sectionId,
      item,
    });
  },
  addSubsectionToSection: (sectionId, name) => {
    return apiClient.post(
      `${API_ENDPOINTS.CAFE.MENU}/section/subsection`,
      { sectionId, name },
    );
  },
  addItemToSubsection: (sectionId, subsectionId, item) => {
    return apiClient.post(`${API_ENDPOINTS.CAFE.MENU}/subsection/item`, {
      sectionId,
      subsectionId,
      item,
    });
  },

  // Add-on operations
  addAddon: (addonData) => {
    return apiClient.post(API_ENDPOINTS.CAFE.ADDON, addonData);
  },
  getAddons: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.ADDONS);
  },
  updateAddon: (id, addonData) => {
    return apiClient.put(
      API_ENDPOINTS.CAFE.ADDON_BY_ID.replace(":id", id),
      addonData,
    );
  },
  deleteAddon: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.CAFE.ADDON_BY_ID.replace(":id", id),
    );
  },
  getAddonsByCafeId: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.ADDONS_BY_CAFE_ID.replace(
        ":id",
        cafeId,
      ),
    );
  },

  getMenuByCafeId: (cafeId, params = {}) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.MENU_BY_CAFE_ID.replace(
        ":id",
        cafeId,
      ),
      { params },
    );
  },

  // Menu item scheduling operations
  scheduleItemAvailability: (scheduleData) => {
    return apiClient.post(
      API_ENDPOINTS.CAFE.MENU_ITEM_SCHEDULE,
      scheduleData,
    );
  },
  cancelScheduledAvailability: (scheduleId) => {
    return apiClient.delete(
      API_ENDPOINTS.CAFE.MENU_ITEM_SCHEDULE_BY_ID.replace(
        ":scheduleId",
        scheduleId,
      ),
    );
  },
  getItemSchedule: (sectionId, itemId) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.MENU_ITEM_SCHEDULE_BY_ITEM.replace(
        ":sectionId",
        sectionId,
      ).replace(":itemId", itemId),
    );
  },

  // Category operations (for cafe module)
  getCategories: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.CATEGORIES);
  },
  getAllCategories: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.CATEGORIES_ALL);
  },
  createCategory: (categoryData) => {
    return apiClient.post(API_ENDPOINTS.CAFE.CATEGORIES, categoryData);
  },
  updateCategory: (id, categoryData) => {
    return apiClient.put(
      API_ENDPOINTS.CAFE.CATEGORY_BY_ID.replace(":id", id),
      categoryData,
    );
  },
  deleteCategory: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.CAFE.CATEGORY_BY_ID.replace(":id", id),
    );
  },
  reorderCategories: (categories) => {
    return apiClient.put(API_ENDPOINTS.CAFE.CATEGORIES_REORDER, {
      categories,
    });
  },

  // Inventory operations (for cafe module)
  getInventory: () => {
    return apiClient.get(API_ENDPOINTS.CAFE.INVENTORY);
  },
  updateInventory: (inventoryData) => {
    return apiClient.put(API_ENDPOINTS.CAFE.INVENTORY, inventoryData);
  },
  getInventoryByCafeId: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.INVENTORY_BY_CAFE_ID.replace(
        ":id",
        cafeId,
      ),
    );
  },

  // Offer operations (for cafe module)
  createOffer: (offerData) => {
    return apiClient.post(API_ENDPOINTS.CAFE.OFFERS, offerData);
  },
  getOffers: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.OFFERS, { params });
  },
  getOfferById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.OFFER_BY_ID.replace(":id", id),
    );
  },
  updateOfferStatus: (id, status) => {
    return apiClient.put(
      API_ENDPOINTS.CAFE.OFFER_STATUS.replace(":id", id),
      { status },
    );
  },
  deleteOffer: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.CAFE.OFFER_BY_ID.replace(":id", id),
    );
  },
  getCouponsByItemId: (itemId) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.COUPONS_BY_ITEM_ID.replace(":itemId", itemId),
    );
  },

  // Finance operations (for cafe module)
  getFinance: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.FINANCE, { params });
  },

  // Complaint operations
  getComplaints: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.CAFE.COMPLAINTS, { params });
  },
  getComplaintById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.CAFE.COMPLAINT_BY_ID.replace(":id", id),
    );
  },
  respondToComplaint: (id, response) => {
    return apiClient.put(
      API_ENDPOINTS.CAFE.COMPLAINT_BY_ID.replace(":id", id),
      { response },
    );
  },

  // FCM Token operations
  saveFcmToken: (token, platform = "web") => {
    return apiClient.post(API_ENDPOINTS.NOTIFICATION.CAFE_FCM_TOKEN, {
      token,
      platform,
    });
  },
  removeFcmToken: (token, platform = "web") => {
    return apiClient.delete(
      API_ENDPOINTS.NOTIFICATION.REMOVE_CAFE_FCM_TOKEN,
      {
        data: { token, platform },
      },
    );
  },
};

// Export delivery API helper functions
export const deliveryAPI = {
  // Delivery Authentication
  sendOTP: (phone, purpose = "login") => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.SEND_OTP, {
      phone,
      purpose,
    });
  },
  verifyOTP: (phone, otp, purpose = "login", name = null) => {
    const payload = { phone, otp, purpose };
    // Only include name if it's provided and is a string
    if (name && typeof name === "string" && name.trim()) {
      payload.name = name.trim();
    }
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.VERIFY_OTP, payload);
  },
  refreshToken: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.REFRESH_TOKEN);
  },
  logout: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.LOGOUT);
  },
  getCurrentDelivery: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.AUTH.ME);
  },

  // Save delivery FCM token
  saveFcmToken: (token, platform = "web") => {
    return apiClient.post(API_ENDPOINTS.NOTIFICATION.DELIVERY_FCM_TOKEN, {
      token,
      platform,
    });
  },
  // Remove delivery FCM token (for logout)
  removeFcmToken: (token, platform = "web") => {
    return apiClient.delete(
      API_ENDPOINTS.NOTIFICATION.REMOVE_DELIVERY_FCM_TOKEN,
      {
        data: { token, platform },
      },
    );
  },

  // Dashboard
  getDashboard: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.DASHBOARD);
  },

  // Wallet
  getWallet: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET);
  },
  getWalletBalance: () => {
    // Backward compatibility - use getWallet instead
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET);
  },
  getWalletTransactions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET_TRANSACTIONS, {
      params,
    });
  },
  getWalletStats: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET_STATS, { params });
  },
  createWithdrawalRequest: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_WITHDRAW, data);
  },
  addEarning: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_EARNINGS, data);
  },
  collectPayment: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_COLLECT_PAYMENT, data);
  },
  claimJoiningBonus: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.CLAIM_JOINING_BONUS);
  },
  createDepositOrder: (amount) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_DEPOSIT_CREATE_ORDER, {
      amount,
    });
  },
  verifyDepositPayment: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_DEPOSIT_VERIFY, data);
  },
  getOrderStats: (period = "all") => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ORDER_STATS, {
      params: { period },
    });
  },

  // Get emergency help numbers
  getEmergencyHelp: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.EMERGENCY_HELP);
  },

  // Support Tickets
  getSupportTickets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.SUPPORT_TICKETS, { params });
  },

  getSupportTicketById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.DELIVERY.SUPPORT_TICKET_BY_ID.replace(":id", id),
    );
  },

  createSupportTicket: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.SUPPORT_TICKETS, data);
  },

  // Get delivery profile
  getProfile: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.PROFILE);
  },

  // Update delivery profile
  updateProfile: (data) => {
    return apiClient.put(API_ENDPOINTS.DELIVERY.PROFILE, data);
  },

  // Get orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ORDERS, { params });
  },
  getOrderDetails: (orderId) => {
    return apiClient.get(
      API_ENDPOINTS.DELIVERY.ORDER_BY_ID.replace(":orderId", orderId),
    );
  },
  getOrderBill: (orderId) => {
    return apiClient.get(
      API_ENDPOINTS.DELIVERY.ORDER_BILL.replace(":orderId", orderId),
    );
  },
  acceptOrder: (orderId, currentLocation = {}) => {
    const payload = {};
    if (currentLocation.lat !== undefined && currentLocation.lat !== null) {
      payload.currentLat = currentLocation.lat;
    }
    if (currentLocation.lng !== undefined && currentLocation.lng !== null) {
      payload.currentLng = currentLocation.lng;
    }
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_ACCEPT.replace(":orderId", orderId),
      payload,
    );
  },
  rejectOrder: (orderId, reason) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_REJECT.replace(":orderId", orderId),
      { reason }
    );
  },
  confirmReachedPickup: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_REACHED_PICKUP.replace(":orderId", orderId),
    );
  },
  confirmOrderId: (
    orderId,
    confirmedOrderId,
    currentLocation = {},
    additionalData = {},
  ) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_CONFIRM_ID.replace(":orderId", orderId),
      {
        confirmedOrderId,
        currentLat: currentLocation.lat,
        currentLng: currentLocation.lng,
        ...additionalData,
      },
    );
  },
  confirmReachedDrop: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_REACHED_DROP.replace(":orderId", orderId),
    );
  },
  completeDelivery: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_COMPLETE_DELIVERY.replace(
        ":orderId",
        orderId,
      ),
    );
  },

  // Get trip history
  getTripHistory: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.TRIP_HISTORY, { params });
  },
  // Get delivered trips (COD/ONLINE)
  getDeliveredTrips: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.TRIPS, { params });
  },

  // Get earnings
  getEarnings: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.EARNINGS, { params });
  },

  // Get active earning addon offers
  getActiveEarningAddons: () => {
    const endpoint = API_ENDPOINTS.DELIVERY.EARNINGS_ACTIVE_OFFERS;
    if (import.meta.env.DEV) {

    }
    return apiClient.get(endpoint);
  },

  // Update location
  updateLocation: (latitude, longitude, isOnline = null, extraData = {}) => {
    const payload = {
      latitude,
      longitude,
      ...(extraData && typeof extraData === "object" ? extraData : {}),
    };
    if (typeof isOnline === "boolean") {
      payload.isOnline = isOnline;
    }
    return apiClient.post(API_ENDPOINTS.DELIVERY.LOCATION, payload);
  },

  // Update online status
  updateOnlineStatus: (isOnline) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.LOCATION, {
      isOnline,
    });
  },

  // Signup
  submitSignupDetails: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.SIGNUP.DETAILS, data);
  },
  submitSignupDocuments: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.SIGNUP.DOCUMENTS, data);
  },

  // Reverify (resubmit for approval)
  reverify: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.REVERIFY);
  },

  // Get zones within radius (for delivery boy to see nearby zones)
  // Pocket (COD Wallet)
  getPocketSummary: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.POCKET);
  },
  getPocketTransactions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.POCKET_TRANSACTIONS, { params });
  },

  getZonesInRadius: (latitude, longitude, radius = 70) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ZONES_IN_RADIUS, {
      params: { latitude, longitude, radius },
    });
  },
};

// Export admin API helper functions
export const adminAPI = {
  // Admin Auth
  signup: (name, email, password, phone = null) => {
    const payload = { name, email, password };
    if (phone) payload.phone = phone;
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.SIGNUP, payload);
  },

  signupWithOTP: (name, email, password, otp, phone = null) => {
    const payload = { name, email, password, otp };
    if (phone) payload.phone = phone;
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.SIGNUP_OTP, payload);
  },

  login: (email, password) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.LOGIN, { email, password });
  },

  logout: () => {
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.LOGOUT);
  },

  getCurrentAdmin: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.AUTH.ME);
  },

  // Get admin profile
  getAdminProfile: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.PROFILE);
  },

  // Update admin profile
  updateAdminProfile: (profileData) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.PROFILE, profileData);
  },

  // Change admin password
  changePassword: (currentPassword, newPassword) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });
  },

  // Get dashboard stats
  getDashboardStats: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DASHBOARD_STATS);
  },

  // Send push notification
  sendPushNotification: (payload) => {
    return apiClient.post(API_ENDPOINTS.NOTIFICATION.ADMIN_SEND, payload);
  },

  // Get admin notifications
  getAdminNotifications: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.NOTIFICATION.ADMIN_LIST, { params });
  },

  // Update admin notification status
  updateAdminNotificationStatus: (id, status) => {
    return apiClient.patch(API_ENDPOINTS.NOTIFICATION.ADMIN_STATUS.replace(":id", id), { status });
  },

  // Update admin notification
  updateAdminNotification: (id, payload) => {
    return apiClient.patch(API_ENDPOINTS.NOTIFICATION.ADMIN_UPDATE.replace(":id", id), payload);
  },

  // Delete admin notification
  deleteAdminNotification: (id) => {
    return apiClient.delete(API_ENDPOINTS.NOTIFICATION.ADMIN_DELETE.replace(":id", id));
  },

  // Get users
  getUsers: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.USERS, { params });
  },

  // Get user by ID
  getUserById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.USER_BY_ID.replace(":id", id));
  },

  // Update user status
  updateUserStatus: (id, isActive) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.USER_STATUS.replace(":id", id), {
      isActive,
    });
  },

  // Get cafes
  getCafes: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CAFES, { params });
  },

  // Create cafe
  createCafe: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.CAFES, data);
  },

  // Update cafe
  updateCafe: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CAFE_BY_ID.replace(":id", id),
      data,
    );
  },

  // Get cafe by ID
  getCafeById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_BY_ID.replace(":id", id),
    );
  },

  // Get cafe analytics
  getCafeAnalytics: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_ANALYTICS.replace(
        ":cafeId",
        cafeId,
      ),
    );
  },

  // Update cafe status
  updateCafeStatus: (id, isActive) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CAFE_STATUS.replace(":id", id),
      { isActive },
    );
  },

  // Update cafe dining settings
  updateCafeDiningSettings: (id, diningSettings) => {
    return apiClient.put(`/admin/cafes/${id}/dining-settings`, {
      diningSettings,
    });
  },

  // Update cafe zone
  updateCafeZone: (id, zoneId) => {
    return apiClient.put(`/admin/cafes/${id}/zone`, { zoneId });
  },

  // Get dining categories
  getDiningCategories: () => {
    return apiClient.get("/admin/dining/categories");
  },

  // Get cafe join requests
  getCafeJoinRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CAFE_REQUESTS, { params });
  },

  // Approve cafe
  approveCafe: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.CAFE_APPROVE.replace(":id", id),
    );
  },

  // Reject cafe
  rejectCafe: (id, reason) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.CAFE_REJECT.replace(":id", id),
      { reason },
    );
  },

  // Delete cafe
  deleteCafe: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.CAFE_DELETE.replace(":id", id),
    );
  },

  // Get all offers (with cafe and dish details)
  getAllOffers: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.OFFERS, { params });
  },

  // Create offer (admin)
  createOffer: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.OFFERS, data);
  },
  updateOfferItem: (offerId, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.OFFERS_ITEM_UPDATE.replace(":offerId", offerId),
      data,
    );
  },

  // Cafe Commission Management
  getCafeCommissions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CAFE_COMMISSION, { params });
  },

  getApprovedCafes: (params = {}) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_COMMISSION_APPROVED_CAFES,
      { params },
    );
  },

  getCafeCommissionById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_COMMISSION_BY_ID.replace(":id", id),
    );
  },

  getCommissionByCafeId: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_COMMISSION_BY_CAFE_ID.replace(
        ":cafeId",
        cafeId,
      ),
    );
  },

  createCafeCommission: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.CAFE_COMMISSION, data);
  },

  updateCafeCommission: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CAFE_COMMISSION_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteCafeCommission: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.CAFE_COMMISSION_BY_ID.replace(":id", id),
    );
  },

  toggleCafeCommissionStatus: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.CAFE_COMMISSION_STATUS.replace(":id", id),
    );
  },

  calculateCafeCommission: (cafeId, orderAmount) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.CAFE_COMMISSION_CALCULATE, {
      cafeId,
      orderAmount,
    });
  },

  // Cafe Complaint Management
  getCafeComplaints: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CAFE_COMPLAINTS, { params });
  },

  // Addon Management
  getAddons: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ADDONS, { params });
  },
  getAddonsByCategory: (categoryId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.ADDONS_BY_CATEGORY.replace(":categoryId", categoryId),
    );
  },
  getAddonById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ADDON_BY_ID.replace(":id", id));
  },
  createAddon: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.ADDONS, data);
  },
  updateAddon: (id, data) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.ADDON_BY_ID.replace(":id", id), data);
  },
  deleteAddon: (id) => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.ADDON_BY_ID.replace(":id", id));
  },
  toggleAddonStatus: (id) => {
    return apiClient.patch(API_ENDPOINTS.ADMIN.ADDON_STATUS.replace(":id", id));
  },
  getCafeComplaintById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_COMPLAINT_BY_ID.replace(":id", id),
    );
  },
  updateCafeComplaintStatus: (
    id,
    status,
    adminResponse,
    internalNotes,
  ) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CAFE_COMPLAINT_STATUS.replace(":id", id),
      {
        status,
        adminResponse,
        internalNotes,
      },
    );
  },
  updateCafeComplaintNotes: (id, internalNotes) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CAFE_COMPLAINT_NOTES.replace(":id", id),
      {
        internalNotes,
      },
    );
  },

  // Get delivery partners
  getDelivery: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY, { params });
  },

  // Get delivery partner join requests
  getDeliveryPartnerJoinRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PARTNERS_REQUESTS, {
      params,
    });
  },

  // Get delivery partner by ID
  getDeliveryPartnerById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_BY_ID.replace(":id", id),
    );
  },

  // Approve delivery partner
  approveDeliveryPartner: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_APPROVE.replace(":id", id),
    );
  },

  // Reject delivery partner
  rejectDeliveryPartner: (id, reason) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_REJECT.replace(":id", id),
      { reason },
    );
  },

  // Reverify delivery partner
  reverifyDeliveryPartner: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_REVERIFY.replace(":id", id),
    );
  },

  // Get all delivery partners
  getDeliveryEarnings: (params = {}) => {
    return apiClient.get("/admin/delivery-partners/earnings", { params });
  },

  getDeliveryPartners: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PARTNERS, { params });
  },

  // Add delivery partner
  addDeliveryPartner: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_PARTNERS, data);
  },

  // Update delivery partner details (including salary)
  updateDeliveryPartner: (id, data) => {
    return apiClient.put(`${API_ENDPOINTS.ADMIN.DELIVERY_PARTNERS}/${id}`, data);
  },

  // Update delivery partner status
  updateDeliveryPartnerStatus: (id, status, isActive = null) => {
    const payload = {};
    if (status) payload.status = status;
    if (isActive !== null) payload.isActive = isActive;
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_STATUS.replace(":id", id),
      payload,
    );
  },

  // Delete delivery partner
  deleteDeliveryPartner: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_DELETE.replace(":id", id),
    );
  },

  // Add bonus to delivery partner
  addDeliveryPartnerBonus: (deliveryPartnerId, amount, reference = "") => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_BONUS, {
      deliveryPartnerId,
      amount: parseFloat(amount),
      reference,
    });
  },

  // Get bonus transactions
  getDeliveryPartnerBonusTransactions: (params = {}) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_BONUS_TRANSACTIONS,
      { params },
    );
  },

  // Get deliveryman reviews
  getDeliverymanReviews: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_REVIEWS, {
      params,
    });
  },

  // Get orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS, { params });
  },

  // Get single order details
  getOrderById: (id) => {
    return apiClient.get(`/admin/orders/${encodeURIComponent(id)}`);
  },

  // Get orders searching for deliveryman
  getSearchingDeliverymanOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_SEARCHING_DELIVERYMAN, {
      params,
    });
  },

  // Get ongoing orders
  getOngoingOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_ONGOING, { params });
  },

  // Get transaction report
  getTransactionReport: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_TRANSACTION_REPORT, {
      params,
    });
  },

  // Get cafe report
  getCafeReport: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_CAFE_REPORT, {
      params,
    });
  },

  // Assign delivery partner manually
  assignOrder: (orderId, deliveryBoyId) => {
    return apiClient.post(`/admin/orders/${orderId}/assign`, { deliveryBoyId });
  },

  // Accept order (admin)
  acceptOrder: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.ORDERS_ACCEPT.replace(":orderId", orderId),
    );
  },

  // Update payment collection status (admin)
  updatePaymentCollectionStatus: (orderId, status) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.ORDERS_PAYMENT_COLLECTION.replace(":orderId", orderId),
      { status },
    );
  },

  // Get refund requests
  getRefundRequests: (params = {}) => {
    return apiClient.get("/api/admin/refund-requests", { params });
  },

  // Process refund (supports both old and new endpoints)
  processRefund: (orderId, data = {}) => {
    // Backend accepts either MongoDB ObjectId (24 chars) or orderId string
    // Note: Don't include /api prefix - apiClient baseURL already includes it
    if (!orderId) {
      return Promise.reject(new Error("Order ID is required"));
    }
    // Use the working endpoint: /admin/refund-requests/:orderId/process
    // apiClient baseURL is already /api, so this becomes /api/admin/refund-requests/:orderId/process
    return apiClient.post(
      `/admin/refund-requests/${encodeURIComponent(orderId)}/process`,
      data,
    );
  },

  // Withdrawal Request Management
  getWithdrawalRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.WITHDRAWAL_REQUESTS, { params });
  },
  approveWithdrawalRequest: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.WITHDRAWAL_APPROVE.replace(":id", id),
    );
  },
  rejectWithdrawalRequest: (id, rejectionReason = "") => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.WITHDRAWAL_REJECT.replace(":id", id),
      { rejectionReason },
    );
  },

  // Menu Management
  getCafeMenu: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.CAFE_MENU.replace(":id", cafeId),
    );
  },

  updateCafeMenu: (cafeId, menuData) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CAFE_MENU.replace(":id", cafeId),
      menuData,
    );
  },

  // Get customer wallet report
  getCustomerWalletReport: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CUSTOMER_WALLET_REPORT, {
      params,
    });
  },

  // Business Settings Management
  getBusinessSettings: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS);
  },

  updateBusinessSettings: (data, files = {}) => {
    const formData = new FormData();

    // Add text fields
    Object.keys(data).forEach((key) => {
      if (key !== "logo" && key !== "favicon") {
        formData.append(key, data[key]);
      }
    });

    // Add files
    if (files.logo) {
      formData.append("logo", files.logo);
    }
    if (files.favicon) {
      formData.append("favicon", files.favicon);
    }

    return apiClient.put(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Pickup order status updates
  markOrderPreparing: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.ORDERS_PREPARING.replace(":orderId", orderId),
    );
  },
  markOrderReadyForPickup: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.ORDERS_READY_FOR_PICKUP.replace(":orderId", orderId),
    );
  },
  markOrderPickedUp: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.ORDERS_PICKED_UP.replace(":orderId", orderId),
    );
  },

  // Get analytics
  getAnalytics: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ANALYTICS, { params });
  },

  // Category Management
  getCategories: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CATEGORIES, { params });
  },

  // Get public categories (for user frontend)
  getPublicCategories: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CATEGORIES_PUBLIC);
  },

  getCategoryById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CATEGORY_BY_ID.replace(":id", id));
  },

  createCategory: (data) => {
    // Axios will automatically handle FormData headers (including boundary)
    // No need to manually set Content-Type for FormData
    return apiClient.post(API_ENDPOINTS.ADMIN.CATEGORIES, data);
  },

  updateCategory: (id, data) => {
    // Axios will automatically handle FormData headers (including boundary)
    // No need to manually set Content-Type for FormData
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CATEGORY_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteCategory: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.CATEGORY_BY_ID.replace(":id", id),
    );
  },

  toggleCategoryStatus: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.CATEGORY_STATUS.replace(":id", id),
    );
  },

  updateCategoryPriority: (id, priority) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.CATEGORY_PRIORITY.replace(":id", id),
      { priority },
    );
  },
  getCategoryTypes: () => {
    return apiClient.get('/admin/category-types');
  },
  createCategoryType: (name) => {
    return apiClient.post('/admin/category-types', { name });
  },
  deleteCategoryType: (id) => {
    return apiClient.delete(`/admin/category-types/${id}`);
  },

  // Fee Settings Management (Delivery & Platform Fee)
  getFeeSettings: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEE_SETTINGS);
  },

  getPublicFeeSettings: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEE_SETTINGS_PUBLIC);
  },

  getFeeSettingsHistory: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEE_SETTINGS_HISTORY, { params });
  },

  createOrUpdateFeeSettings: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.FEE_SETTINGS, data);
  },

  updateFeeSettings: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.FEE_SETTINGS_BY_ID.replace(":id", id),
      data,
    );
  },

  // Zone Management
  getZones: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ZONES, { params });
  },

  // Dining Config Management
  createDiningDate: (payload) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DINING_DATE, payload);
  },
  addDiningTimeSlots: (payload) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DINING_TIMESLOTS, payload);
  },
  addDiningTable: (payload) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DINING_TABLES, payload);
  },
  getDiningConfig: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DINING_CONFIG.replace(":cafeId", cafeId),
    );
  },
  getDiningBookingRequests: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DINING_BOOKING_REQUESTS);
  },
  approveDiningBooking: (bookingId) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.DINING_BOOKING_APPROVE.replace(":bookingId", bookingId),
    );
  },
  rejectDiningBooking: (bookingId) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.DINING_BOOKING_REJECT.replace(":bookingId", bookingId),
    );
  },

  getZoneById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ZONE_BY_ID.replace(":id", id));
  },

  createZone: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.ZONES, data);
  },

  updateZone: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.ZONE_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteZone: (id) => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.ZONE_BY_ID.replace(":id", id));
  },

  toggleZoneStatus: (id) => {
    return apiClient.patch(API_ENDPOINTS.ADMIN.ZONE_STATUS.replace(":id", id));
  },

  // Earning Addon Management
  createEarningAddon: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.EARNING_ADDON, data);
  },

  getEarningAddons: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.EARNING_ADDON, { params });
  },

  getEarningAddonById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_BY_ID.replace(":id", id),
    );
  },

  updateEarningAddon: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteEarningAddon: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_BY_ID.replace(":id", id),
    );
  },

  toggleEarningAddonStatus: (id, status) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_STATUS.replace(":id", id),
      { status },
    );
  },

  checkEarningAddonCompletions: (deliveryPartnerId, debug = false) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.EARNING_ADDON_CHECK_COMPLETIONS, {
      deliveryPartnerId,
      debug,
    });
  },

  // Earning Addon History Management
  getEarningAddonHistory: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY, { params });
  },

  getEarningAddonHistoryById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_BY_ID.replace(":id", id),
    );
  },

  creditEarningToWallet: (id, notes = "") => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_CREDIT.replace(":id", id),
      { notes },
    );
  },

  cancelEarningAddonHistory: (id, reason = "") => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_CANCEL.replace(":id", id),
      { reason },
    );
  },

  getEarningAddonHistoryStatistics: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_STATISTICS, {
      params,
    });
  },

  // Environment Variables Management
  getEnvVariables: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ENV_VARIABLES);
  },

  saveEnvVariables: (envData) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.ENV_VARIABLES, envData);
  },

  // Public Environment Variables (for frontend use)
  getPublicEnvVariables: () => {
    return apiClient.get("/env/public");
  },



  getDeliveryBoyWallets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_BOY_WALLET, { params });
  },
  addDeliveryBoyWalletAdjustment: (data) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_WALLET_ADJUSTMENT,
      data,
    );
  },

  // Delivery Emergency Help Management
  getEmergencyHelp: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_EMERGENCY_HELP);
  },

  createOrUpdateEmergencyHelp: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_EMERGENCY_HELP, data);
  },

  toggleEmergencyHelpStatus: () => {
    return apiClient.patch(API_ENDPOINTS.ADMIN.DELIVERY_EMERGENCY_HELP_STATUS);
  },

  // Delivery Support Tickets Management
  getDeliverySupportTickets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKETS, {
      params,
    });
  },

  getDeliverySupportTicketById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKET_BY_ID.replace(":id", id),
    );
  },

  updateDeliverySupportTicket: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKET_BY_ID.replace(":id", id),
      data,
    );
  },

  getDeliverySupportTicketStats: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKETS_STATS);
  },

  // Food Approval
  getPendingFoodApprovals: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FOOD_APPROVALS, { params });
  },

  approveFoodItem: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.FOOD_APPROVAL_APPROVE.replace(":id", id),
    );
  },

  rejectFoodItem: (id, reason) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.FOOD_APPROVAL_REJECT.replace(":id", id),
      { reason },
    );
  },

  // Feedback Experience Management
  createFeedbackExperience: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE, data);
  },

  getFeedbackExperiences: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE, { params });
  },

  getFeedbackExperienceById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE_BY_ID.replace(":id", id),
    );
  },

  // COD Pocket Wallets
  getDeliveryWallets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_WALLETS, { params });
  },
  settleDeliveryWallet: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_WALLETS_SETTLE, data);
  },

  deleteFeedbackExperience: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE_BY_ID.replace(":id", id),
    );
  },

  // Global Coupons
  // Global Coupon Management Methods
  getGlobalCoupons: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.COUPONS);
  },
  createGlobalCoupon: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.COUPONS, data);
  },
  updateGlobalCoupon: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.COUPON_BY_ID.replace(":id", id),
      data,
    );
  },
  toggleGlobalCoupon: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.COUPON_TOGGLE.replace(":id", id),
    );
  },
  deleteGlobalCoupon: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.COUPON_BY_ID.replace(":id", id),
    );
  },
};

// Upload / media helper functions
export const uploadAPI = {
  /**
   * Upload a single image/video file to Cloudinary via backend
   * @param {File} file - Browser File object
   * @param {Object} options - Optional { folder }
   */
  uploadMedia: (file, options = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.folder) {
      formData.append("folder", options.folder);
    }

    return apiClient.post(API_ENDPOINTS.UPLOAD.MEDIA, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};


// Export order API helper functions
export const orderAPI = {
  // Calculate order pricing
  calculateOrder: (orderData) => {
    return apiClient.post(API_ENDPOINTS.ORDER.CALCULATE, orderData);
  },

  // Create order and get Razorpay order
  createOrder: (orderData) => {
    return apiClient.post(API_ENDPOINTS.ORDER.CREATE, orderData);
  },

  // Verify payment
  verifyPayment: (paymentData) => {
    return apiClient.post(API_ENDPOINTS.ORDER.VERIFY_PAYMENT, paymentData);
  },

  // Get user orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ORDER.LIST, { params });
  },

  // Complaint operations
  submitComplaint: (data) => {
    return apiClient.post(API_ENDPOINTS.USER.COMPLAINTS, data);
  },
  getUserComplaints: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.USER.COMPLAINTS, { params });
  },
  getComplaintDetails: (id) => {
    return apiClient.get(API_ENDPOINTS.USER.COMPLAINT_BY_ID.replace(":id", id));
  },

  // Get order details
  getOrderDetails: (orderId) => {
    return apiClient.get(API_ENDPOINTS.ORDER.DETAILS.replace(":id", orderId));
  },

  // Submit customer cafe review for a delivered order
  submitCustomerReview: (orderId, reviewData) => {
    return apiClient.post(
      API_ENDPOINTS.ORDER.CUSTOMER_REVIEW.replace(":id", orderId),
      reviewData,
    );
  },

  // Cancel order
  cancelOrder: (orderId, reason) => {
    return apiClient.patch(API_ENDPOINTS.ORDER.CANCEL.replace(":id", orderId), {
      reason,
    });
  },

  // Get order bill PDF
  getOrderBill: (orderId) => {
    return apiClient.get(API_ENDPOINTS.ORDER.BILL.replace(":id", orderId));
  },
};

// Export dining API helper functions
export const diningAPI = {
  // Get dining cafes (with optional filters)
  getCafes: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DINING.CAFES, { params });
  },

  // Get cafe by slug
  getCafeBySlug: (slug) => {
    return apiClient.get(
      API_ENDPOINTS.DINING.CAFE_BY_SLUG.replace(
        ":slug",
        encodeURIComponent(slug),
      ),
    );
  },

  // Get dining categories
  getCategories: () => {
    return apiClient.get(API_ENDPOINTS.DINING.CATEGORIES);
  },

  // Get limelight features
  getLimelight: () => {
    return apiClient.get(API_ENDPOINTS.DINING.LIMELIGHT);
  },

  // Get bank offers
  getBankOffers: () => {
    return apiClient.get(API_ENDPOINTS.DINING.BANK_OFFERS);
  },

  // Get must tries
  getMustTries: () => {
    return apiClient.get(API_ENDPOINTS.DINING.MUST_TRIES);
  },

  // Get offer banners (used as limelight in Dining.jsx)
  getOfferBanners: () => {
    return apiClient.get(API_ENDPOINTS.DINING.OFFER_BANNERS);
  },

  // Get dining stories
  getStories: () => {
    return apiClient.get(API_ENDPOINTS.DINING.STORIES);
  },
  // Get available dates
  getDates: (cafeId) => {
    return apiClient.get(API_ENDPOINTS.DINING.DATES, {
      params: { cafeId },
    });
  },
  // Get dynamic availability for selected date and guest count
  getAvailability: ({ cafeId, date, guests }) => {
    return apiClient.get(API_ENDPOINTS.DINING.AVAILABILITY, {
      params: { cafeId, date, guests },
    });
  },
  // Create booking using new endpoint
  bookTable: (bookingData) => {
    return apiClient.post(API_ENDPOINTS.DINING.BOOK, bookingData);
  },
  // Create a new table booking
  createBooking: (bookingData) => {
    return apiClient.post(API_ENDPOINTS.DINING.BOOKING_CREATE, bookingData);
  },
  // Get current user's bookings
  getBookings: () => {
    return apiClient.get(API_ENDPOINTS.DINING.MY_BOOKINGS);
  },
  // Check in booking
  checkInBooking: (bookingId) => {
    return apiClient.post(
      API_ENDPOINTS.DINING.CHECKIN.replace(":bookingId", bookingId),
    );
  },
  // Get bookings for a specific cafe (for owners)
  getCafeBookings: (cafeId) => {
    return apiClient.get(
      API_ENDPOINTS.DINING.BOOKING_CAFE.replace(
        ":cafeId",
        cafeId,
      ),
    );
  },
  // Update booking status
  updateBookingStatus: (bookingId, status) => {
    return apiClient.patch(
      API_ENDPOINTS.DINING.BOOKING_STATUS.replace(":bookingId", bookingId),
      { status },
    );
  },
  // Update booking status (for cafe owners)
  updateBookingStatusCafe: (bookingId, status) => {
    return apiClient.patch(
      API_ENDPOINTS.DINING.BOOKING_STATUS_CAFE.replace(
        ":bookingId",
        bookingId,
      ),
      { status },
    );
  },
  // Create review
  createReview: (reviewData) => {
    return apiClient.post(API_ENDPOINTS.DINING.REVIEW_CREATE, reviewData);
  },
};

// Export hero banner API helper functions
export const heroBannerAPI = {
  // Get Top 10 cafes (public)
  getTop10Cafes: () => {
    return apiClient.get(API_ENDPOINTS.HERO_BANNER.TOP_10_PUBLIC);
  },

  // Get Gourmet cafes (public)
  getGourmetCafes: () => {
    return apiClient.get(API_ENDPOINTS.HERO_BANNER.GOURMET_PUBLIC);
  },
};

// Export user coupon API helper functions
export const couponAPI = {
  // Apply coupon
  apply: (couponCode, cartTotal) => {
    return apiClient.post(API_ENDPOINTS.COUPON.APPLY, { couponCode, cartTotal });
  },
  // Get active coupons for user
  getActiveCoupons: () => {
    return apiClient.get(API_ENDPOINTS.COUPON.LIST);
  }
};
