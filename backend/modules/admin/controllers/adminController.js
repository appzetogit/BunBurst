import Admin from "../models/Admin.js";
import Order from "../../order/models/Order.js";
import Cafe from "../../cafe/models/Cafe.js";
import Offer from "../../cafe/models/Offer.js";
import OrderSettlement from "../../order/models/OrderSettlement.js";
import AdminWallet from "../models/AdminWallet.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { normalizePhoneNumber } from "../../../shared/utils/phoneUtils.js";
import winston from "winston";
import mongoose from "mongoose";
import { uploadToCloudinary } from "../../../shared/utils/cloudinaryService.js";
import DiningCafe from "../../dining/models/DiningCafe.js";
import { initializeCloudinary } from "../../../config/cloudinary.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const hasBase64ImagePayload = (value) =>
  typeof value === "string" && value.startsWith("data:image/");

const requiresCloudinaryUpload = (...values) =>
  values.some((value) => {
    if (Array.isArray(value)) {
      return value.some((item) => hasBase64ImagePayload(item));
    }
    return hasBase64ImagePayload(value);
  });

const normalizeImageSubdoc = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("http")) return { url: trimmed };
    return null;
  }
  if (typeof value === "object" && typeof value.url === "string" && value.url.trim()) {
    return {
      url: value.url.trim(),
      ...(value.publicId ? { publicId: value.publicId } : {}),
    };
  }
  return null;
};

const normalizeCafeLocation = (incomingLocation = {}, existingLocation = {}) => {
  const normalizedLocation = { ...existingLocation, ...incomingLocation };

  const latNum = Number(normalizedLocation.latitude);
  const lngNum = Number(normalizedLocation.longitude);

  if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
    normalizedLocation.latitude = latNum;
    normalizedLocation.longitude = lngNum;
    normalizedLocation.coordinates = [lngNum, latNum];
  } else if (
    Array.isArray(normalizedLocation.coordinates) &&
    normalizedLocation.coordinates.length >= 2
  ) {
    const [coordLng, coordLat] = normalizedLocation.coordinates;
    if (Number.isFinite(Number(coordLat)) && Number.isFinite(Number(coordLng))) {
      normalizedLocation.latitude = Number(coordLat);
      normalizedLocation.longitude = Number(coordLng);
      normalizedLocation.coordinates = [Number(coordLng), Number(coordLat)];
    }
  }

  const addressParts = [
    trimText(normalizedLocation.addressLine1),
    trimText(normalizedLocation.addressLine2),
    trimText(normalizedLocation.area),
    trimText(normalizedLocation.city),
    trimText(normalizedLocation.state),
    trimText(
      normalizedLocation.pincode ||
      normalizedLocation.zipCode ||
      normalizedLocation.postalCode,
    ),
  ].filter(Boolean);

  const composedAddress = addressParts.join(", ");
  const formattedAddress = trimText(normalizedLocation.formattedAddress);
  const address = trimText(normalizedLocation.address);

  if (!formattedAddress && composedAddress) {
    normalizedLocation.formattedAddress = composedAddress;
  }

  if (!address && (composedAddress || formattedAddress)) {
    normalizedLocation.address = composedAddress || formattedAddress;
  }

  if (!normalizedLocation.formattedAddress && normalizedLocation.address) {
    normalizedLocation.formattedAddress = normalizedLocation.address;
  }

  // Prevent ObjectId cast errors when zone is not selected from form controls.
  if (
    normalizedLocation.zoneId === "" ||
    normalizedLocation.zoneId === "null" ||
    normalizedLocation.zoneId === "undefined"
  ) {
    normalizedLocation.zoneId = null;
  } else if (
    normalizedLocation.zoneId != null &&
    !mongoose.Types.ObjectId.isValid(String(normalizedLocation.zoneId))
  ) {
    normalizedLocation.zoneId = existingLocation?.zoneId ?? null;
  }

  return normalizedLocation;
};

/**
 * Get Admin Dashboard Statistics
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Calculate date ranges
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total revenue (sum of all completed orders)
    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          "pricing.total": { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          last30DaysRevenue: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                "$pricing.total",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get revenue data from aggregation result
    const revenueData = revenueStats[0] || {
      totalRevenue: 0,
      last30DaysRevenue: 0,
    };

    // Get all settlements for delivered orders only (to match with revenue calculation)
    // First get delivered order IDs
    const deliveredOrderIds = await Order.find({ status: "delivered" })
      .select("_id")
      .lean();
    const deliveredOrderIdArray = deliveredOrderIds.map((o) => o._id);

    // Get settlements only for delivered orders
    const allSettlements = await OrderSettlement.find({
      orderId: { $in: deliveredOrderIdArray },
    }).lean();

    console.log(
      `📊 Dashboard Stats - Total settlements found: ${allSettlements.length}`,
    );

    // Debug: Log first settlement to see actual structure
    if (allSettlements.length > 0) {
      const firstSettlement = allSettlements[0];
      console.log("🔍 First settlement sample:", {
        orderNumber: firstSettlement.orderNumber,
        adminEarning: firstSettlement.adminEarning,
        userPayment: firstSettlement.userPayment,
      });
    }

    // Calculate totals from all settlements - use adminEarning fields
    let totalCommission = 0;
    let totalPlatformFee = 0;
    let totalDeliveryFee = 0;
    let totalGST = 0;

    allSettlements.forEach((s, index) => {
      const commission = s.adminEarning?.commission || 0;
      const platformFee = s.adminEarning?.platformFee || 0;
      const deliveryFee = s.adminEarning?.deliveryFee || 0;
      const gst = s.adminEarning?.gst || 0;

      totalCommission += commission;
      totalPlatformFee += platformFee;
      totalDeliveryFee += deliveryFee;
      totalGST += gst;

      // Log each settlement for debugging
      if (index < 5) {
        // Log first 5 settlements
        console.log(
          `📦 Settlement ${index + 1} (${s.orderNumber}): Commission: ₹${commission}, Platform: ₹${platformFee}, Delivery: ₹${deliveryFee}, GST: ₹${gst}`,
        );
      }
    });

    totalCommission = Math.round(totalCommission * 100) / 100;
    totalPlatformFee = Math.round(totalPlatformFee * 100) / 100;
    totalDeliveryFee = Math.round(totalDeliveryFee * 100) / 100;
    totalGST = Math.round(totalGST * 100) / 100;

    console.log(
      `💰 Final calculated totals - Commission: ₹${totalCommission}, Platform Fee: ₹${totalPlatformFee}, Delivery Fee: ₹${totalDeliveryFee}, GST: ₹${totalGST}`,
    );

    // Get last 30 days data from OrderSettlement
    const last30DaysSettlements = await OrderSettlement.find({
      createdAt: { $gte: last30Days, $lte: now },
    }).lean();
    const last30DaysCommission = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.commission || 0),
      0,
    );
    const last30DaysPlatformFee = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.platformFee || 0),
      0,
    );
    const last30DaysDeliveryFee = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.deliveryFee || 0),
      0,
    );
    const last30DaysGST = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.gst || 0),
      0,
    );

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const orderStatusMap = {};
    orderStats.forEach((stat) => {
      orderStatusMap[stat._id] = stat.count;
    });

    // Get total orders processed
    const totalOrders = await Order.countDocuments({ status: "delivered" });

    // Get active partners count
    const activeCafes = await Cafe.countDocuments({
      isActive: true,
    });
    // Note: Delivery partners are stored in User model
    const User = (await import("../../auth/models/User.js")).default;
    const activeDeliveryPartners = await User.countDocuments({
      role: "delivery",
      isActive: true,
    });
    const activePartners = activeCafes + activeDeliveryPartners;

    // Get additional stats
    // Total cafes (only active/approved cafes)
    // This matches the admin cafes list which shows only active cafes by default
    const totalCafes = await Cafe.countDocuments({
      isActive: true,
    });

    // Cafe requests pending (inactive cafes with completed onboarding, no rejection)
    const pendingCafeRequestsQuery = {
      isActive: false,
      $and: [
        {
          $or: [
            { "onboarding.completedSteps": 4 },
            {
              $and: [
                { name: { $exists: true, $ne: null, $ne: "" } },
                { cuisines: { $exists: true, $ne: null, $not: { $size: 0 } } },
                { openDays: { $exists: true, $ne: null, $not: { $size: 0 } } },
                {
                  estimatedDeliveryTime: { $exists: true, $ne: null, $ne: "" },
                },
                { featuredDish: { $exists: true, $ne: null, $ne: "" } },
              ],
            },
          ],
        },
        {
          $or: [
            { rejectionReason: { $exists: false } },
            { rejectionReason: null },
          ],
        },
      ],
    };
    const pendingCafeRequests = await Cafe.countDocuments(
      pendingCafeRequestsQuery,
    );

    // Total delivery boys (all delivery users)
    const totalDeliveryBoys = await User.countDocuments({ role: "delivery" });

    // Delivery boy requests pending (delivery users with isActive: false or verification pending)
    // Assuming deliveryStatus field exists, if not we'll use isActive: false
    const pendingDeliveryBoyRequests = await User.countDocuments({
      role: "delivery",
      $or: [{ isActive: false }, { deliveryStatus: "pending" }],
    });

    // Total foods (Menu items) - Count all individual menu items from active menus
    // Count ALL items (including disabled sections, unavailable items, pending/approved, excluding only rejected)
    const Menu = (await import("../../cafe/models/Menu.js")).default;
    // Get all active menus and count items in sections and subsections
    const activeMenus = await Menu.find({ isActive: true })
      .select("sections")
      .lean();
    let totalFoods = 0;
    activeMenus.forEach((menu) => {
      if (menu.sections && Array.isArray(menu.sections)) {
        menu.sections.forEach((section) => {
          // Count items from ALL sections (enabled and disabled)

          // Count items directly in section (all items, excluding only rejected)
          if (section.items && Array.isArray(section.items)) {
            totalFoods += section.items.filter((item) => {
              // Must have required fields
              if (!item || !item.id || !item.name) return false;
              // Exclude only rejected items (include all others: pending, approved, available, unavailable)
              if (item.approvalStatus === "rejected") return false;
              // Count all other items regardless of availability or approval status
              return true;
            }).length;
          }
          // Count items in subsections (all items, excluding only rejected)
          if (section.subsections && Array.isArray(section.subsections)) {
            section.subsections.forEach((subsection) => {
              if (subsection.items && Array.isArray(subsection.items)) {
                totalFoods += subsection.items.filter((item) => {
                  // Must have required fields
                  if (!item || !item.id || !item.name) return false;
                  // Exclude only rejected items (include all others: pending, approved, available, unavailable)
                  if (item.approvalStatus === "rejected") return false;
                  // Count all other items regardless of availability or approval status
                  return true;
                }).length;
              }
            });
          }
        });
      }
    });

    // Total addons - Count all addons from active menus
    // Count ALL addons (including unavailable, pending/approved, excluding only rejected)
    let totalAddons = 0;
    const menusWithAddons = await Menu.find({ isActive: true })
      .select("addons")
      .lean();
    menusWithAddons.forEach((menu) => {
      // Only process if menu has addons array and it's not empty
      if (
        !menu.addons ||
        !Array.isArray(menu.addons) ||
        menu.addons.length === 0
      ) {
        return;
      }

      totalAddons += menu.addons.filter((addon) => {
        // Only count if addon exists and has required fields (id and name are mandatory)
        if (!addon || typeof addon !== "object") return false;
        if (!addon.id || typeof addon.id !== "string" || addon.id.trim() === "")
          return false;
        if (
          !addon.name ||
          typeof addon.name !== "string" ||
          addon.name.trim() === ""
        )
          return false;
        // Exclude only rejected addons (include all others: pending, approved, available, unavailable)
        if (addon.approvalStatus === "rejected") return false;
        // Count all other addons regardless of availability or approval status
        return true;
      }).length;
    });

    // Total customers (users with role 'user' or no role specified)
    const totalCustomers = await User.countDocuments({
      $or: [{ role: "user" }, { role: { $exists: false } }, { role: null }],
    });

    // Pending orders (already in orderStatusMap)
    const pendingOrders = orderStatusMap.pending || 0;

    // Completed orders (delivered orders)
    const completedOrders = orderStatusMap.delivered || 0;

    // Get recent activity (last 24 hours)
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: last24Hours },
    });
    const recentCafes = await Cafe.countDocuments({
      createdAt: { $gte: last24Hours },
      isActive: true,
    });

    // Get monthly data for last 12 months
    // Use aggregation to match orders with settlements by orderId and use order's deliveredAt
    const monthlyData = [];
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // Get orders delivered in this month
      const monthOrders = await Order.find({
        status: "delivered",
        deliveredAt: { $gte: monthStart, $lte: monthEnd },
      })
        .select("_id pricing deliveredAt")
        .lean();

      // Get order IDs for this month
      const monthOrderIds = monthOrders.map((o) => o._id);

      // Get settlements for these orders (match by orderId, not by createdAt)
      const monthSettlements = await OrderSettlement.find({
        orderId: { $in: monthOrderIds },
      })
        .select("orderId adminEarning")
        .lean();

      // Create a map of orderId to settlement for quick lookup
      const settlementMap = new Map();
      monthSettlements.forEach((s) => {
        settlementMap.set(s.orderId.toString(), s);
      });

      // Calculate revenue and commission from orders and their settlements
      let monthRevenue = 0;
      let monthCommission = 0;

      monthOrders.forEach((order) => {
        // Add revenue from order
        monthRevenue += order.pricing?.total || 0;

        // Get commission from matching settlement
        const settlement = settlementMap.get(order._id.toString());
        if (settlement && settlement.adminEarning) {
          // Only add commission (cafe commission), not totalEarning
          monthCommission += settlement.adminEarning.commission || 0;
        }
      });

      const monthOrdersCount = monthOrders.length;

      monthlyData.push({
        month: monthNames[monthStart.getMonth()],
        revenue: Math.round(monthRevenue * 100) / 100,
        commission: Math.round(monthCommission * 100) / 100,
        orders: monthOrdersCount,
      });
    }

    return successResponse(res, 200, "Dashboard stats retrieved successfully", {
      revenue: {
        total: revenueData.totalRevenue || 0,
        last30Days: revenueData.last30DaysRevenue || 0,
        currency: "INR",
      },
      commission: {
        total: totalCommission,
        last30Days: last30DaysCommission,
        currency: "INR",
      },
      platformFee: {
        total: totalPlatformFee,
        last30Days: last30DaysPlatformFee,
        currency: "INR",
      },
      deliveryFee: {
        total: totalDeliveryFee,
        last30Days: last30DaysDeliveryFee,
        currency: "INR",
      },
      gst: {
        total: totalGST,
        last30Days: last30DaysGST,
        currency: "INR",
      },
      totalAdminEarnings: {
        total: totalCommission + totalPlatformFee + totalDeliveryFee + totalGST,
        last30Days:
          last30DaysCommission +
          last30DaysPlatformFee +
          last30DaysDeliveryFee +
          last30DaysGST,
        currency: "INR",
      },
      orders: {
        total: totalOrders,
        byStatus: {
          pending: orderStatusMap.pending || 0,
          confirmed: orderStatusMap.confirmed || 0,
          preparing: orderStatusMap.preparing || 0,
          ready: orderStatusMap.ready || 0,
          out_for_delivery: orderStatusMap.out_for_delivery || 0,
          delivered: orderStatusMap.delivered || 0,
          cancelled: orderStatusMap.cancelled || 0,
        },
      },
      partners: {
        total: activePartners,
        cafes: activeCafes,
        delivery: activeDeliveryPartners,
      },
      recentActivity: {
        orders: recentOrders,
        cafes: recentCafes,
        period: "last24Hours",
      },
      monthlyData: monthlyData, // Add monthly data for graphs
      // Additional stats
      cafes: {
        total: totalCafes,
        active: activeCafes,
        pendingRequests: pendingCafeRequests,
      },
      deliveryBoys: {
        total: totalDeliveryBoys,
        active: activeDeliveryPartners,
        pendingRequests: pendingDeliveryBoyRequests,
      },
      foods: {
        total: totalFoods,
      },
      addons: {
        total: totalAddons,
      },
      customers: {
        total: totalCustomers,
      },
      orderStats: {
        pending: pendingOrders,
        completed: completedOrders,
      },
    });
  } catch (error) {
    logger.error(`Error fetching dashboard stats: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch dashboard statistics");
  }
});

/**
 * Get All Admins
 * GET /api/admin/admins
 */
export const getAdmins = asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const admins = await Admin.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Admin.countDocuments(query);

    return successResponse(res, 200, "Admins retrieved successfully", {
      admins,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error(`Error fetching admins: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admins");
  }
});

/**
 * Get Admin by ID
 * GET /api/admin/admins/:id
 */
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id).select("-password").lean();

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    return successResponse(res, 200, "Admin retrieved successfully", { admin });
  } catch (error) {
    logger.error(`Error fetching admin: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admin");
  }
});

/**
 * Create Admin (only by existing admin)
 * POST /api/admin/admins
 */
export const createAdmin = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validation
    if (!name || !email || !password) {
      return errorResponse(res, 400, "Name, email, and password are required");
    }

    if (password.length < 6) {
      return errorResponse(
        res,
        400,
        "Password must be at least 6 characters long",
      );
    }

    // Check if admin already exists with this email
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return errorResponse(res, 400, "Admin already exists with this email");
    }

    // Create new admin
    const adminData = {
      name,
      email: email.toLowerCase(),
      password,
      isActive: true,
      phoneVerified: false,
    };

    if (phone) {
      adminData.phone = phone;
    }

    const admin = await Admin.create(adminData);

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin created: ${admin._id}`, {
      email,
      createdBy: req.user._id,
    });

    return successResponse(res, 201, "Admin created successfully", {
      admin: adminResponse,
    });
  } catch (error) {
    logger.error(`Error creating admin: ${error.message}`);

    if (error.code === 11000) {
      return errorResponse(res, 400, "Admin with this email already exists");
    }

    return errorResponse(res, 500, "Failed to create admin");
  }
});

/**
 * Update Admin
 * PUT /api/admin/admins/:id
 */
export const updateAdmin = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, isActive } = req.body;

    const admin = await Admin.findById(id);

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    // Prevent updating own account's isActive status
    if (id === req.user._id.toString() && isActive === false) {
      return errorResponse(res, 400, "You cannot deactivate your own account");
    }

    // Update fields
    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (phone !== undefined) admin.phone = phone;
    if (isActive !== undefined) admin.isActive = isActive;

    await admin.save();

    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin updated: ${id}`, { updatedBy: req.user._id });

    return successResponse(res, 200, "Admin updated successfully", {
      admin: adminResponse,
    });
  } catch (error) {
    logger.error(`Error updating admin: ${error.message}`);

    if (error.code === 11000) {
      return errorResponse(res, 400, "Admin with this email already exists");
    }

    return errorResponse(res, 500, "Failed to update admin");
  }
});

/**
 * Delete Admin
 * DELETE /api/admin/admins/:id
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (id === req.user._id.toString()) {
      return errorResponse(res, 400, "You cannot delete your own account");
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    await Admin.deleteOne({ _id: id });

    logger.info(`Admin deleted: ${id}`, { deletedBy: req.user._id });

    return successResponse(res, 200, "Admin deleted successfully");
  } catch (error) {
    logger.error(`Error deleting admin: ${error.message}`);
    return errorResponse(res, 500, "Failed to delete admin");
  }
});

/**
 * Get Current Admin Profile
 * GET /api/admin/profile
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id).select("-password").lean();

    if (!admin) {
      return errorResponse(res, 404, "Admin profile not found");
    }

    return successResponse(res, 200, "Admin profile retrieved successfully", {
      admin,
    });
  } catch (error) {
    logger.error(`Error fetching admin profile: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admin profile");
  }
});

/**
 * Update Current Admin Profile
 * PUT /api/admin/profile
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;

    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return errorResponse(res, 404, "Admin profile not found");
    }

    // Update fields (email cannot be changed via profile update)
    if (name !== undefined && name !== null) {
      admin.name = name.trim();
    }

    if (phone !== undefined) {
      // Allow empty string to clear phone number
      admin.phone = phone ? phone.trim() : null;
    }

    if (profileImage !== undefined) {
      // Allow empty string to clear profile image
      admin.profileImage = profileImage || null;
    }

    // Save to database
    await admin.save();

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin profile updated: ${admin._id}`, {
      updatedFields: {
        name,
        phone,
        profileImage: profileImage ? "updated" : "not changed",
      },
    });

    return successResponse(res, 200, "Profile updated successfully", {
      admin: adminResponse,
    });
  } catch (error) {
    logger.error(`Error updating admin profile: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update profile");
  }
});

/**
 * Change Admin Password
 * PUT /api/admin/settings/change-password
 */
export const changeAdminPassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return errorResponse(
        res,
        400,
        "Current password and new password are required",
      );
    }

    if (newPassword.length < 6) {
      return errorResponse(
        res,
        400,
        "New password must be at least 6 characters long",
      );
    }

    // Get admin with password field
    const admin = await Admin.findById(req.user._id).select("+password");

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return errorResponse(res, 401, "Current password is incorrect");
    }

    // Check if new password is same as current
    const isSamePassword = await admin.comparePassword(newPassword);
    if (isSamePassword) {
      return errorResponse(
        res,
        400,
        "New password must be different from current password",
      );
    }

    // Update password (pre-save hook will hash it)
    admin.password = newPassword;
    await admin.save();

    logger.info(`Admin password changed: ${admin._id}`);

    return successResponse(res, 200, "Password changed successfully");
  } catch (error) {
    logger.error(`Error changing admin password: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to change password");
  }
});

/**
 * Get All Users (Customers) with Order Statistics
 * GET /api/admin/users
 */
export const getUsers = asyncHandler(async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      search,
      status,
      sortBy,
      orderDate,
      joiningDate,
    } = req.query;
    const User = (await import("../../auth/models/User.js")).default;

    // Build query
    const query = { role: "user" }; // Only get users, not cafes/delivery/admins

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // Joining date filter
    if (joiningDate) {
      const startDate = new Date(joiningDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(joiningDate);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Get users
    const users = await User.find(query)
      .select("-password -__v")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Get user IDs
    const userIds = users.map((user) => user._id);

    // Get order statistics for each user
    const orderStats = await Order.aggregate([
      {
        $match: {
          userId: { $in: userIds },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
        },
      },
    ]);

    // Create a map of userId -> stats
    const statsMap = {};
    orderStats.forEach((stat) => {
      statsMap[stat._id.toString()] = {
        totalOrder: stat.totalOrders || 0,
        totalOrderAmount: stat.totalAmount || 0,
      };
    });

    // Format users with order statistics
    const formattedUsers = users.map((user, index) => {
      const stats = statsMap[user._id.toString()] || {
        totalOrder: 0,
        totalOrderAmount: 0,
      };

      // Format joining date
      const joiningDate = new Date(user.createdAt);
      const formattedDate = joiningDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return {
        sl: parseInt(offset) + index + 1,
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        phone: user.phone || "N/A",
        totalOrder: stats.totalOrder,
        totalOrderAmount: stats.totalOrderAmount,
        joiningDate: formattedDate,
        status: user.isActive !== false, // Default to true if not set
        createdAt: user.createdAt,
      };
    });

    // Apply sorting
    if (sortBy) {
      if (sortBy === "name-asc") {
        formattedUsers.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === "name-desc") {
        formattedUsers.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sortBy === "orders-asc") {
        formattedUsers.sort((a, b) => a.totalOrder - b.totalOrder);
      } else if (sortBy === "orders-desc") {
        formattedUsers.sort((a, b) => b.totalOrder - a.totalOrder);
      }
    }

    // Order date filter (filter by order date after aggregation)
    let filteredUsers = formattedUsers;
    if (orderDate) {
      // This would require additional query to filter by order date
      // For now, we'll skip this as it's complex and may require different approach
    }

    const total = await User.countDocuments(query);

    return successResponse(res, 200, "Users retrieved successfully", {
      users: filteredUsers,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch users");
  }
});

/**
 * Get User by ID with Full Details
 * GET /api/admin/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const User = (await import("../../auth/models/User.js")).default;

    const user = await User.findById(id).select("-password -__v").lean();

    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $match: { userId: user._id },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
          orders: {
            $push: {
              orderId: "$orderId",
              status: "$status",
              total: "$pricing.total",
              createdAt: "$createdAt",
              cafeName: "$cafeName",
            },
          },
        },
      },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalAmount: 0,
      orders: [],
    };

    // Format joining date
    const joiningDate = new Date(user.createdAt);
    const formattedDate = joiningDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return successResponse(res, 200, "User retrieved successfully", {
      user: {
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        phone: user.phone || "N/A",
        phoneVerified: user.phoneVerified || false,
        profileImage: user.profileImage || null,
        role: user.role,
        signupMethod: user.signupMethod,
        isActive: user.isActive !== false,
        addresses: user.addresses || [],
        preferences: user.preferences || {},
        wallet: user.wallet || {},
        dateOfBirth: user.dateOfBirth || null,
        anniversary: user.anniversary || null,
        gender: user.gender || null,
        joiningDate: formattedDate,
        createdAt: user.createdAt,
        totalOrders: stats.totalOrders,
        totalOrderAmount: stats.totalAmount,
        orders: stats.orders.slice(0, 10), // Last 10 orders
      },
    });
  } catch (error) {
    logger.error(`Error fetching user: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch user");
  }
});

/**
 * Update User Status (Active/Inactive)
 * PUT /api/admin/users/:id/status
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const User = (await import("../../auth/models/User.js")).default;

    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive must be a boolean value");
    }

    const user = await User.findById(id);

    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    user.isActive = isActive;
    await user.save();

    logger.info(`User status updated: ${id}`, {
      isActive,
      updatedBy: req.user._id,
    });

    return successResponse(res, 200, "User status updated successfully", {
      user: {
        id: user._id.toString(),
        name: user.name,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    logger.error(`Error updating user status: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update user status");
  }
});

/**
 * Get All Cafes
 * GET /api/admin/cafes
 * Query params: page, limit, search, status, cuisine, zone
 */
export const getCafes = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, cuisine, zone } = req.query;

    // Build query
    const query = {};

    // Status filter - Default to active only (approved cafes)
    // Only show inactive if explicitly requested via status filter
    // IMPORTANT: Cafes should only appear in main list AFTER admin approval
    // Inactive cafes (pending approval) should only appear in "New Joining Request" section
    if (status === "inactive") {
      query.isActive = false;
    } else if (status === "active") {
      query.isActive = true;
    }
    // Default: Show all cafes (no filter on isActive) if status is not provided or 'all'

    console.log("🔍 Admin Cafes List Query:", {
      status,
      isActive: query.isActive,
      query: JSON.stringify(query, null, 2),
    });

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
        { ownerPhone: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Cuisine filter
    if (cuisine) {
      query.cuisines = { $in: [new RegExp(cuisine, "i")] };
    }

    // Zone filter
    if (zone && zone !== "All over the World") {
      query.$or = [
        { "location.area": { $regex: zone, $options: "i" } },
        { "location.city": { $regex: zone, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch cafes
    const cafes = await Cafe.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Cafe.countDocuments(query);

    return successResponse(res, 200, "Cafes retrieved successfully", {
      cafes: cafes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching cafes: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch cafes");
  }
});

/**
 * Get Cafe By ID
 * GET /api/admin/cafes/:id
 */
export const getCafeById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const cafe = await Cafe.findById(id).select("-password").lean();

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    return successResponse(res, 200, "Cafe retrieved successfully", {
      cafe,
    });
  } catch (error) {
    logger.error(`Error fetching cafe by id: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch cafe");
  }
});

/**
 * Update Cafe Status (Active/Inactive/Ban)
 * PUT /api/admin/cafes/:id/status
 */
export const updateCafeStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive must be a boolean value");
    }

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    cafe.isActive = isActive;
    await cafe.save();

    logger.info(`Cafe status updated: ${id}`, {
      isActive,
      updatedBy: req.user._id,
    });

    return successResponse(res, 200, "Cafe status updated successfully", {
      cafe: {
        id: cafe._id.toString(),
        name: cafe.name,
        isActive: cafe.isActive,
      },
    });
  } catch (error) {
    logger.error(`Error updating cafe status: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update cafe status");
  }
});

/**
 * Get Cafe Join Requests
 * GET /api/admin/cafes/requests
 * Query params: status (pending, rejected), page, limit, search
 */
export const getCafeJoinRequests = asyncHandler(async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 50, search } = req.query;

    // Build query
    const query = {};

    // Status filter
    // Pending = cafes with ALL onboarding steps completed (step 4) but not yet active
    // Rejected = cafes that have rejectionReason
    if (status === "pending") {
      // Build conditions array for $and - ensures all conditions are met
      // Check for rejectionReason: either doesn't exist OR is null
      const conditions = [
        { isActive: false },
        {
          $or: [
            { rejectionReason: { $exists: false } },
            { rejectionReason: null },
          ],
        },
      ];

      // Only show cafes that have completed ALL onboarding steps (all 4 steps)
      // Check if onboarding.completedSteps is 4, OR if cafe has all required data filled
      // This handles both cases: cafes with proper tracking AND cafes that completed onboarding before tracking was added
      const completionCheck = {
        $or: [
          { "onboarding.completedSteps": 4 },
          // Fallback: If completedSteps is not 4 (or doesn't exist), check if cafe has all main fields filled
          // This matches cafes that have completed onboarding even if completedSteps field wasn't set to 4
          {
            $and: [
              { name: { $exists: true, $ne: null, $ne: "" } }, // Has cafe name
              { cuisines: { $exists: true, $ne: null, $not: { $size: 0 } } }, // Has cuisines (array with items)
              { openDays: { $exists: true, $ne: null, $not: { $size: 0 } } }, // Has open days (array with items)
              { estimatedDeliveryTime: { $exists: true, $ne: null, $ne: "" } }, // Has delivery time (from step 4)
              { featuredDish: { $exists: true, $ne: null, $ne: "" } }, // Has featured dish (from step 4)
            ],
          },
        ],
      };

      conditions.push(completionCheck);
      query.$and = conditions;
    } else if (status === "rejected") {
      query["rejectionReason"] = { $exists: true, $ne: null };
      // For rejected, also check if onboarding is complete
      query.$or = [
        { "onboarding.completedSteps": 4 },
        {
          $and: [
            { name: { $exists: true, $ne: null, $ne: "" } },
            { estimatedDeliveryTime: { $exists: true, $ne: null, $ne: "" } },
          ],
        },
      ];
    }

    // Search filter - combine with $and if search is provided
    if (search && search.trim()) {
      const searchConditions = {
        $or: [
          { name: { $regex: search.trim(), $options: "i" } },
          { ownerName: { $regex: search.trim(), $options: "i" } },
          { ownerPhone: { $regex: search.trim(), $options: "i" } },
          { phone: { $regex: search.trim(), $options: "i" } },
          { email: { $regex: search.trim(), $options: "i" } },
        ],
      };

      // If query already has $and, add search to it; otherwise create new $and
      if (query.$and) {
        query.$and.push(searchConditions);
      } else {
        // Convert existing query conditions to $and format
        const baseConditions = { ...query };
        query = {
          $and: [baseConditions, searchConditions],
        };
      }
    }

    console.log(
      "🔍 Cafe Join Requests Query:",
      JSON.stringify(query, null, 2),
    );

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch cafes
    const cafes = await Cafe.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Debug: Log found cafes with detailed info
    console.log(`📊 Found ${cafes.length} cafes matching query:`, {
      status,
      queryStructure: Object.keys(query).length,
      cafesFound: cafes.length,
      sampleCafes: cafes.slice(0, 5).map((r) => ({
        _id: r._id.toString().substring(0, 10) + "...",
        name: r.name,
        isActive: r.isActive,
        completedSteps: r.onboarding?.completedSteps,
        hasRejectionReason: !!r.rejectionReason,
        hasName: !!r.name,
        hasCuisines: !!r.cuisines && r.cuisines.length > 0,
        hasOpenDays: !!r.openDays && r.openDays.length > 0,
        hasEstimatedDeliveryTime: !!r.estimatedDeliveryTime,
        hasFeaturedDish: !!r.featuredDish,
      })),
    });

    // Get total count
    const total = await Cafe.countDocuments(query);

    console.log(`📊 Total count: ${total} cafes`);

    // Also log a sample of ALL inactive cafes (for debugging)
    if (status === "pending" && cafes.length === 0) {
      const allInactive = await Cafe.find({
        isActive: false,
        $or: [
          { rejectionReason: { $exists: false } },
          { rejectionReason: null },
        ],
      })
        .select(
          "name isActive onboarding.completedSteps cuisines openDays estimatedDeliveryTime featuredDish",
        )
        .limit(10)
        .lean();

      const totalInactive = await Cafe.countDocuments({
        isActive: false,
        $or: [
          { rejectionReason: { $exists: false } },
          { rejectionReason: null },
        ],
      });

      console.log(
        "⚠️ No cafes found with query. Debugging inactive cafes:",
        {
          totalInactive,
          queryUsed: JSON.stringify(query, null, 2),
          samples: allInactive.map((r) => ({
            _id: r._id.toString(),
            name: r.name,
            isActive: r.isActive,
            completedSteps: r.onboarding?.completedSteps,
            hasAllFields: {
              hasName: !!r.name && r.name !== "",
              hasCuisines:
                !!r.cuisines &&
                Array.isArray(r.cuisines) &&
                r.cuisines.length > 0,
              hasOpenDays:
                !!r.openDays &&
                Array.isArray(r.openDays) &&
                r.openDays.length > 0,
              hasEstimatedDeliveryTime:
                !!r.estimatedDeliveryTime && r.estimatedDeliveryTime !== "",
              hasFeaturedDish: !!r.featuredDish && r.featuredDish !== "",
            },
            fieldValues: {
              name: r.name || "MISSING",
              cuisinesCount: r.cuisines?.length || 0,
              openDaysCount: r.openDays?.length || 0,
              estimatedDeliveryTime: r.estimatedDeliveryTime || "MISSING",
              featuredDish: r.featuredDish || "MISSING",
            },
            shouldMatch:
              (!!r.name &&
                r.name !== "" &&
                !!r.cuisines &&
                Array.isArray(r.cuisines) &&
                r.cuisines.length > 0 &&
                !!r.openDays &&
                Array.isArray(r.openDays) &&
                r.openDays.length > 0 &&
                !!r.estimatedDeliveryTime &&
                r.estimatedDeliveryTime !== "" &&
                !!r.featuredDish &&
                r.featuredDish !== "") ||
              r.onboarding?.completedSteps === 4,
          })),
        },
      );
    }

    // Format response to match frontend expectations
    const formattedRequests = cafes.map((cafe, index) => {
      // Get zone from location
      let zone = "All over the World";
      if (cafe.location?.area) {
        zone = cafe.location.area;
      } else if (cafe.location?.city) {
        zone = cafe.location.city;
      }

      // Get business model (could be from subscription or commission - defaulting for now)
      const businessModel = cafe.businessModel || "Commission Base";

      // Get status
      const requestStatus = cafe.rejectionReason ? "Rejected" : "Pending";

      return {
        _id: cafe._id.toString(),
        sl: skip + index + 1,
        cafeName: cafe.name || "N/A",
        cafeImage:
          cafe.profileImage?.url ||
          cafe.onboarding?.step2?.profileImageUrl?.url ||
          "https://via.placeholder.com/40",
        ownerName: cafe.ownerName || "N/A",
        ownerPhone: cafe.ownerPhone || cafe.phone || "N/A",
        zone: zone,
        businessModel: businessModel,
        status: requestStatus,
        rejectionReason: cafe.rejectionReason || null,
        createdAt: cafe.createdAt,
        // Include full data for view/details
        fullData: {
          ...cafe,
          _id: cafe._id.toString(),
        },
      };
    });

    return successResponse(
      res,
      200,
      "Cafe join requests retrieved successfully",
      {
        requests: formattedRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    );
  } catch (error) {
    logger.error(`Error fetching cafe join requests: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch cafe join requests");
  }
});

/**
 * Approve Cafe Join Request
 * POST /api/admin/cafes/:id/approve
 */
export const approveCafe = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    if (cafe.isActive) {
      return errorResponse(res, 400, "Cafe is already approved");
    }

    if (cafe.rejectionReason) {
      return errorResponse(
        res,
        400,
        "Cannot approve a rejected cafe. Please remove rejection reason first.",
      );
    }

    // Activate cafe
    cafe.isActive = true;
    cafe.approvedAt = new Date();
    cafe.approvedBy = adminId;
    cafe.rejectionReason = undefined; // Clear any previous rejection

    await cafe.save();

    logger.info(`Cafe approved: ${id}`, {
      approvedBy: adminId,
      cafeName: cafe.name,
    });

    return successResponse(res, 200, "Cafe approved successfully", {
      cafe: {
        id: cafe._id.toString(),
        name: cafe.name,
        isActive: cafe.isActive,
        approvedAt: cafe.approvedAt,
      },
    });
  } catch (error) {
    logger.error(`Error approving cafe: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to approve cafe");
  }
});

/**
 * Update Cafe Dining Settings
 * PUT /api/admin/cafes/:id/dining-settings
 */
export const updateCafeDiningSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { diningSettings } = req.body;

    if (!diningSettings) {
      return errorResponse(res, 400, "Dining settings are required");
    }

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

  // Update dining settings
  cafe.diningSettings = {
    ...cafe.diningSettings,
    ...diningSettings,
  };

  await cafe.save();

  if (cafe.diningSettings?.isEnabled) {
    const fallbackDiningImage =
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop";
    const locationText =
      (typeof cafe.location === "string" ? cafe.location : null) ||
      cafe.location?.formattedAddress ||
      cafe.location?.address ||
      cafe.location?.addressLine1 ||
      cafe.location?.street ||
      [cafe.location?.area, cafe.location?.city].filter(Boolean).join(", ") ||
      cafe.address ||
      "Location not available";

    const imageUrl =
      cafe.profileImage?.url ||
      cafe.menuImages?.[0]?.url ||
      cafe.onboarding?.step2?.profileImageUrl?.url ||
      fallbackDiningImage;

      const diningCafePayload = {
        name: cafe.name,
        rating: cafe.rating || 0,
        location: locationText,
        cafeId: cafe._id,
        distance: cafe.distance || "1.2 km",
        cuisine: Array.isArray(cafe.cuisines) && cafe.cuisines.length > 0
          ? cafe.cuisines[0]
          : "Multi-cuisine",
      category: cafe.diningSettings?.diningType,
      price: cafe.onboarding?.step4?.priceRange || undefined,
      image: imageUrl,
      offer: cafe.offer || undefined,
      deliveryTime: cafe.estimatedDeliveryTime || undefined,
      featuredDish: cafe.featuredDish || undefined,
      featuredPrice: cafe.featuredPrice || undefined,
      slug: cafe.slug,
      coordinates: {
        latitude: cafe.location?.latitude,
        longitude: cafe.location?.longitude,
      },
    };

    try {
      await DiningCafe.findOneAndUpdate(
        { slug: cafe.slug },
        diningCafePayload,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (diningError) {
      logger.error(`Error syncing dining cafe: ${diningError.message}`, {
        cafeId: cafe._id,
      });
    }
  }

  logger.info(`Cafe dining settings updated: ${id}`, {
    updatedBy: req.user._id,
    diningSettings: cafe.diningSettings,
  });

    return successResponse(res, 200, "Dining settings updated successfully", {
      cafe: {
        id: cafe._id,
        diningSettings: cafe.diningSettings,
      },
    });
  } catch (error) {
    logger.error(`Error updating dining settings: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update dining settings");
  }
});

/**
 * Reject Cafe Join Request
 * POST /api/admin/cafes/:id/reject
 */
export const rejectCafe = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    // Validate reason is provided
    if (!reason || !reason.trim()) {
      return errorResponse(res, 400, "Rejection reason is required");
    }

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    // Set rejection details (allow updating if already rejected)
    cafe.rejectionReason = reason.trim();
    cafe.rejectedAt = new Date();
    cafe.rejectedBy = adminId;
    cafe.isActive = false; // Ensure it's inactive

    await cafe.save();

    logger.info(`Cafe rejected: ${id}`, {
      rejectedBy: adminId,
      reason: reason,
      cafeName: cafe.name,
    });

    return successResponse(res, 200, "Cafe rejected successfully", {
      cafe: {
        id: cafe._id.toString(),
        name: cafe.name,
        rejectionReason: cafe.rejectionReason,
      },
    });
  } catch (error) {
    logger.error(`Error rejecting cafe: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to reject cafe");
  }
});

/**
 * Reverify Cafe (Resubmit for approval)
 * POST /api/admin/cafes/:id/reverify
 */
export const reverifyCafe = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    // Check if cafe was rejected
    if (!cafe.rejectionReason) {
      return errorResponse(
        res,
        400,
        "Cafe is not rejected. Only rejected cafes can be reverified.",
      );
    }

    // Clear rejection details and mark as pending again
    cafe.rejectionReason = null;
    cafe.rejectedAt = undefined;
    cafe.rejectedBy = undefined;
    cafe.isActive = false; // Keep inactive until approved

    await cafe.save();

    logger.info(`Cafe reverified: ${id}`, {
      reverifiedBy: adminId,
      cafeName: cafe.name,
    });

    return successResponse(
      res,
      200,
      "Cafe reverified successfully. Waiting for admin approval.",
      {
        cafe: {
          id: cafe._id.toString(),
          name: cafe.name,
          isActive: cafe.isActive,
          rejectionReason: null,
        },
      },
    );
  } catch (error) {
    logger.error(`Error reverifying cafe: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to reverify cafe");
  }
});

/**
 * Update Cafe by Admin
 * PUT /api/admin/cafes/:id
 */
export const updateCafe = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Step 1: Basic Info
      cafeName,
      ownerName,
      ownerEmail,
      ownerPhone,
      primaryContactNumber,
      location,
      // Step 2: Images & Operational
      menuImages, // Array of image URLs or base64
      profileImage, // Image URL or base64
      cuisines,
      openingTime,
      closingTime,
      openDays,
      // Step 3: Documents
      panNumber,
      nameOnPan,
      panImage,
      gstRegistered,
      gstNumber,
      gstLegalName,
      gstAddress,
      gstImage,
      fssaiNumber,
      fssaiExpiry,
      fssaiImage,
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
      // Step 4: Display Info
      estimatedDeliveryTime,
      featuredDish,
      featuredPrice,
      offer,
      diningSettings,
      // Authentication
      email,
      phone,
      password,
    } = req.body;

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    // Validation (if modifying email/phone)
    if (email && email.toLowerCase().trim() !== cafe.email) {
      const existingEmail = await Cafe.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: id },
      });
      if (existingEmail) {
        return errorResponse(res, 400, "Cafe with this email already exists");
      }
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (normalizedPhone && normalizedPhone !== cafe.phone) {
      const existingPhone = await Cafe.findOne({
        phone: normalizedPhone,
        _id: { $ne: id },
      });
      if (existingPhone) {
        return errorResponse(res, 400, "Cafe with this phone already exists");
      }
    }

    // Initialize Cloudinary only when this request contains base64 images.
    if (
      requiresCloudinaryUpload(
        profileImage,
        menuImages,
        panImage,
        gstRegistered ? gstImage : null,
        fssaiImage,
      )
    ) {
      await initializeCloudinary();
    }

    // Handle Profile Image Update
    if (profileImage) {
      if (typeof profileImage === "string" && profileImage.startsWith("data:")) {
        const base64Data = profileImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/profile",
          resource_type: "image",
        });
        cafe.profileImage = {
          url: result.secure_url,
          publicId: result.public_id,
        };
      } else if (typeof profileImage === "string" && profileImage.startsWith("http")) {
        cafe.profileImage = { url: profileImage };
      } else if (profileImage.url) {
        cafe.profileImage = profileImage;
      }
    }

    // Handle Menu Images Update
    if (menuImages && Array.isArray(menuImages)) {
      const newMenuImages = [];
      for (const img of menuImages) {
        if (typeof img === "string" && img.startsWith("data:")) {
          const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const result = await uploadToCloudinary(buffer, {
            folder: "appzeto/cafe/menu",
            resource_type: "image",
          });
          newMenuImages.push({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else if (typeof img === "string" && img.startsWith("http")) {
          newMenuImages.push({ url: img });
        } else if (img?.url) {
          newMenuImages.push(img);
        }
      }
      cafe.menuImages = newMenuImages;
    }

    // Handle PAN Image Update
    let panImageData = cafe.onboarding?.step3?.pan?.image || null;
    if (panImage) {
      if (typeof panImage === "string" && panImage.startsWith("data:")) {
        const base64Data = panImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/pan",
          resource_type: "image",
        });
        panImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof panImage === "string" && panImage.startsWith("http")) {
        panImageData = { url: panImage };
      } else if (panImage?.url) {
        panImageData = panImage;
      }
    }

    // Handle GST Image Update
    let gstImageData = cafe.onboarding?.step3?.gst?.image || null;
    if (gstRegistered && gstImage) {
      if (typeof gstImage === "string" && gstImage.startsWith("data:")) {
        const base64Data = gstImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/gst",
          resource_type: "image",
        });
        gstImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof gstImage === "string" && gstImage.startsWith("http")) {
        gstImageData = { url: gstImage };
      } else if (gstImage?.url) {
        gstImageData = gstImage;
      }
    }

    // Handle FSSAI Image Update
    let fssaiImageData = cafe.onboarding?.step3?.fssai?.image || null;
    if (fssaiImage) {
      if (typeof fssaiImage === "string" && fssaiImage.startsWith("data:")) {
        const base64Data = fssaiImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/fssai",
          resource_type: "image",
        });
        fssaiImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof fssaiImage === "string" && fssaiImage.startsWith("http")) {
        fssaiImageData = { url: fssaiImage };
      } else if (fssaiImage?.url) {
        fssaiImageData = fssaiImage;
      }
    }

    // Update Basic Fields
    if (cafeName) cafe.name = cafeName;
    if (ownerName) cafe.ownerName = ownerName;
    if (ownerEmail) cafe.ownerEmail = ownerEmail;
    if (ownerPhone) cafe.ownerPhone = normalizePhoneNumber(ownerPhone) || cafe.ownerPhone;
    if (primaryContactNumber) cafe.primaryContactNumber = normalizePhoneNumber(primaryContactNumber) || cafe.primaryContactNumber;
    if (location) {
      cafe.location = normalizeCafeLocation(location, cafe.location || {});
    }
    if (cuisines) cafe.cuisines = cuisines;

    // Update Delivery Timings
    if (openingTime || closingTime) {
      cafe.deliveryTimings = {
        openingTime: openingTime || cafe.deliveryTimings?.openingTime,
        closingTime: closingTime || cafe.deliveryTimings?.closingTime,
      };
    }

    if (openDays) cafe.openDays = openDays;
    if (estimatedDeliveryTime) cafe.estimatedDeliveryTime = estimatedDeliveryTime;
    if (featuredDish) cafe.featuredDish = featuredDish;
    if (featuredPrice) cafe.featuredPrice = featuredPrice;
    if (offer) cafe.offer = offer;
    if (diningSettings) cafe.diningSettings = diningSettings;

    // Update Authentication Fields
    if (email) cafe.email = email.toLowerCase().trim();
    if (normalizedPhone) {
      cafe.phone = normalizedPhone;
      cafe.phoneVerified = true;
    }
    if (password) {
      cafe.password = password; // Will be hashed by pre-save hook
    }

    // Update Onboarding Data (to keep sync)
    if (!cafe.onboarding) cafe.onboarding = { step1: {}, step2: {}, step3: {}, step4: {} };
    if (!cafe.onboarding.step1) cafe.onboarding.step1 = {};
    if (!cafe.onboarding.step2) cafe.onboarding.step2 = {};
    if (!cafe.onboarding.step3) cafe.onboarding.step3 = {};
    if (!cafe.onboarding.step4) cafe.onboarding.step4 = {};

    cafe.onboarding.step1.cafeName = cafe.name;
    cafe.onboarding.step1.ownerName = cafe.ownerName;
    cafe.onboarding.step1.ownerEmail = cafe.ownerEmail;
    cafe.onboarding.step1.ownerPhone = cafe.ownerPhone;
    cafe.onboarding.step1.primaryContactNumber = cafe.primaryContactNumber;
    cafe.onboarding.step1.location = cafe.location || {};

    cafe.onboarding.step2.menuImageUrls = cafe.menuImages || [];
    cafe.onboarding.step2.profileImageUrl = cafe.profileImage || null;
    cafe.onboarding.step2.cuisines = cafe.cuisines || [];
    cafe.onboarding.step2.deliveryTimings = cafe.deliveryTimings || {};
    cafe.onboarding.step2.openDays = cafe.openDays || [];

    const panImageSubdoc = normalizeImageSubdoc(
      panImageData ?? cafe.onboarding.step3.pan?.image,
    );
    const gstImageSubdoc = normalizeImageSubdoc(
      gstImageData ?? cafe.onboarding.step3.gst?.image,
    );
    const fssaiImageSubdoc = normalizeImageSubdoc(
      fssaiImageData ?? cafe.onboarding.step3.fssai?.image,
    );

    cafe.onboarding.step3.pan = {
      panNumber: panNumber || cafe.onboarding.step3.pan?.panNumber || "",
      nameOnPan: nameOnPan || cafe.onboarding.step3.pan?.nameOnPan || "",
      ...(panImageSubdoc ? { image: panImageSubdoc } : {}),
    };

    cafe.onboarding.step3.gst = {
      isRegistered: gstRegistered ?? cafe.onboarding.step3.gst?.isRegistered ?? false,
      gstNumber: gstNumber || cafe.onboarding.step3.gst?.gstNumber || "",
      legalName: gstLegalName || cafe.onboarding.step3.gst?.legalName || "",
      address: gstAddress || cafe.onboarding.step3.gst?.address || "",
      ...(gstImageSubdoc ? { image: gstImageSubdoc } : {}),
    };

    cafe.onboarding.step3.fssai = {
      registrationNumber:
        fssaiNumber || cafe.onboarding.step3.fssai?.registrationNumber || "",
      expiryDate: fssaiExpiry || cafe.onboarding.step3.fssai?.expiryDate || null,
      ...(fssaiImageSubdoc ? { image: fssaiImageSubdoc } : {}),
    };

    cafe.onboarding.step3.bank = {
      accountNumber:
        accountNumber || cafe.onboarding.step3.bank?.accountNumber || "",
      ifscCode: ifscCode || cafe.onboarding.step3.bank?.ifscCode || "",
      accountHolderName:
        accountHolderName || cafe.onboarding.step3.bank?.accountHolderName || "",
      accountType: accountType || cafe.onboarding.step3.bank?.accountType || "",
    };

    cafe.onboarding.step4.estimatedDeliveryTime = cafe.estimatedDeliveryTime || "";
    cafe.onboarding.step4.featuredDish = cafe.featuredDish || "";
    cafe.onboarding.step4.featuredPrice = cafe.featuredPrice || 0;
    cafe.onboarding.step4.offer = cafe.offer || "";

    // Save only validating changed fields to avoid blocking updates on legacy records
    // that may have old missing/invalid non-edited fields.
    await cafe.save({ validateModifiedOnly: true });

    logger.info(`Cafe updated by admin: ${id}`, { adminId: req.user._id });

    return successResponse(res, 200, "Cafe updated successfully", {
      cafe: {
        id: cafe._id,
        name: cafe.name,
        email: cafe.email,
        phone: cafe.phone,
        isActive: cafe.isActive,
      },
    });
  } catch (error) {
    logger.error(`Error updating cafe: ${error.message}`, { error: error.stack });
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      const firstPath = error?.errors ? Object.keys(error.errors)[0] : null;
      const firstMessage =
        (firstPath && error.errors[firstPath]?.message) || error.message;
      return errorResponse(res, 400, firstMessage || "Invalid cafe data");
    }
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || "field";
      return errorResponse(res, 409, `${duplicateField} already exists`);
    }
    return errorResponse(res, 500, "Failed to update cafe");
  }
});

/**
 * Create Cafe by Admin
 * POST /api/admin/cafes
 */
export const createCafe = asyncHandler(async (req, res) => {
  try {
    const adminId = req.user._id;
    const {
      // Step 1: Basic Info
      cafeName,
      ownerName,
      ownerEmail,
      ownerPhone,
      primaryContactNumber,
      location,
      // Step 2: Images & Operational
      menuImages, // Array of image URLs or base64
      profileImage, // Image URL or base64
      cuisines,
      openingTime,
      closingTime,
      openDays,
      // Step 3: Documents
      panNumber,
      nameOnPan,
      panImage, // Image URL or base64
      gstRegistered,
      gstNumber,
      gstLegalName,
      gstAddress,
      gstImage, // Image URL or base64
      fssaiNumber,
      fssaiExpiry,
      fssaiImage, // Image URL or base64
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
      // Step 4: Display Info
      estimatedDeliveryTime,
      featuredDish,
      featuredPrice,
      offer,
      diningSettings,
      // Authentication
      email,
      phone,
      password,
      signupMethod = "email",
    } = req.body;

    // Validation
    if (!cafeName || !ownerName || !ownerEmail) {
      return errorResponse(
        res,
        400,
        "Cafe name, owner name, and owner email are required",
      );
    }

    if (!email && !phone) {
      return errorResponse(res, 400, "Either email or phone is required");
    }

    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (phone && !normalizedPhone) {
      return errorResponse(res, 400, "Invalid phone number format");
    }

    // Generate random password if email is provided but password is not
    let finalPassword = password;
    if (email && !password) {
      // Generate a random 12-character password
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      finalPassword = Array.from(
        { length: 12 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");
    }

    // Check if cafe already exists with same email or phone
    const existingCafe = await Cafe.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    });

    if (existingCafe) {
      if (email && existingCafe.email === email.toLowerCase().trim()) {
        return errorResponse(
          res,
          400,
          "Cafe with this email already exists",
        );
      }
      if (normalizedPhone && existingCafe.phone === normalizedPhone) {
        return errorResponse(
          res,
          400,
          "Cafe with this phone number already exists. Please use a different phone number.",
        );
      }
    }

    // Initialize Cloudinary only when this request contains base64 images.
    if (
      requiresCloudinaryUpload(
        profileImage,
        menuImages,
        panImage,
        gstRegistered ? gstImage : null,
        fssaiImage,
      )
    ) {
      await initializeCloudinary();
    }

    // Upload images if provided as base64 or files
    let profileImageData = null;
    if (profileImage) {
      if (
        typeof profileImage === "string" &&
        profileImage.startsWith("data:")
      ) {
        // Base64 image - convert to buffer and upload
        const base64Data = profileImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/profile",
          resource_type: "image",
        });
        profileImageData = {
          url: result.secure_url,
          publicId: result.public_id,
        };
      } else if (
        typeof profileImage === "string" &&
        profileImage.startsWith("http")
      ) {
        // Already a URL
        profileImageData = { url: profileImage };
      } else if (profileImage.url) {
        // Already an object with url
        profileImageData = profileImage;
      }
    }

    let menuImagesData = [];
    if (menuImages && Array.isArray(menuImages) && menuImages.length > 0) {
      for (const img of menuImages) {
        if (typeof img === "string" && img.startsWith("data:")) {
          const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const result = await uploadToCloudinary(buffer, {
            folder: "appzeto/cafe/menu",
            resource_type: "image",
          });
          menuImagesData.push({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else if (typeof img === "string" && img.startsWith("http")) {
          menuImagesData.push({ url: img });
        } else if (img.url) {
          menuImagesData.push(img);
        }
      }
    }

    // Upload document images
    let panImageData = null;
    if (panImage) {
      if (typeof panImage === "string" && panImage.startsWith("data:")) {
        const base64Data = panImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/pan",
          resource_type: "image",
        });
        panImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof panImage === "string" && panImage.startsWith("http")) {
        panImageData = { url: panImage };
      } else if (panImage.url) {
        panImageData = panImage;
      }
    }

    let gstImageData = null;
    if (gstRegistered && gstImage) {
      if (typeof gstImage === "string" && gstImage.startsWith("data:")) {
        const base64Data = gstImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/gst",
          resource_type: "image",
        });
        gstImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof gstImage === "string" && gstImage.startsWith("http")) {
        gstImageData = { url: gstImage };
      } else if (gstImage.url) {
        gstImageData = gstImage;
      }
    }

    let fssaiImageData = null;
    if (fssaiImage) {
      if (typeof fssaiImage === "string" && fssaiImage.startsWith("data:")) {
        const base64Data = fssaiImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/cafe/fssai",
          resource_type: "image",
        });
        fssaiImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (
        typeof fssaiImage === "string" &&
        fssaiImage.startsWith("http")
      ) {
        fssaiImageData = { url: fssaiImage };
      } else if (fssaiImage.url) {
        fssaiImageData = fssaiImage;
      }
    }

    // Create cafe data
    const cafeData = {
      name: cafeName,
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone
        ? normalizePhoneNumber(ownerPhone) || normalizedPhone
        : normalizedPhone,
      primaryContactNumber: primaryContactNumber
        ? normalizePhoneNumber(primaryContactNumber) || normalizedPhone
        : normalizedPhone,
      location: normalizeCafeLocation(location || {}, {}),
      profileImage: profileImageData,
      menuImages: menuImagesData,
      cuisines: cuisines || [],
      deliveryTimings: {
        openingTime: openingTime || "09:00",
        closingTime: closingTime || "22:00",
      },
      openDays: openDays || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      estimatedDeliveryTime: estimatedDeliveryTime || "25-30 mins",
      featuredDish: featuredDish || "",
      featuredPrice: featuredPrice || 249,
      offer: offer || "",
      diningSettings: diningSettings || { isEnabled: false },
      signupMethod,
      // Admin created cafes are active by default
      isActive: true,
      isAcceptingOrders: true,
      approvedAt: new Date(),
      approvedBy: adminId,
    };

    // Add authentication fields
    if (email) {
      cafeData.email = email.toLowerCase().trim();
      cafeData.password = finalPassword; // Will be hashed by pre-save hook
    }
    if (normalizedPhone) {
      cafeData.phone = normalizedPhone;
      cafeData.phoneVerified = true; // Admin created, so verified
    }

    const panImageSubdoc = normalizeImageSubdoc(panImageData);
    const gstImageSubdoc = normalizeImageSubdoc(gstImageData);
    const fssaiImageSubdoc = normalizeImageSubdoc(fssaiImageData);

    // Add onboarding data
    cafeData.onboarding = {
      step1: {
        cafeName,
        ownerName,
        ownerEmail,
        ownerPhone: ownerPhone
          ? normalizePhoneNumber(ownerPhone) || normalizedPhone
          : normalizedPhone,
        primaryContactNumber: primaryContactNumber
          ? normalizePhoneNumber(primaryContactNumber) || normalizedPhone
          : normalizedPhone,
        location: normalizeCafeLocation(location || {}, {}),
      },
      step2: {
        menuImageUrls: menuImagesData,
        profileImageUrl: profileImageData,
        cuisines: cuisines || [],
        deliveryTimings: {
          openingTime: openingTime || "09:00",
          closingTime: closingTime || "22:00",
        },
        openDays: openDays || [],
      },
      step3: {
        pan: {
          panNumber: panNumber || "",
          nameOnPan: nameOnPan || "",
          ...(panImageSubdoc ? { image: panImageSubdoc } : {}),
        },
        gst: {
          isRegistered: gstRegistered || false,
          gstNumber: gstNumber || "",
          legalName: gstLegalName || "",
          address: gstAddress || "",
          ...(gstImageSubdoc ? { image: gstImageSubdoc } : {}),
        },
        fssai: {
          registrationNumber: fssaiNumber || "",
          expiryDate: fssaiExpiry || null,
          ...(fssaiImageSubdoc ? { image: fssaiImageSubdoc } : {}),
        },
        bank: {
          accountNumber: accountNumber || "",
          ifscCode: ifscCode || "",
          accountHolderName: accountHolderName || "",
          accountType: accountType || "",
        },
      },
      step4: {
        estimatedDeliveryTime: estimatedDeliveryTime || "25-30 mins",
        featuredDish: featuredDish || "",
        featuredPrice: featuredPrice || 249,
        offer: offer || "",
      },
      completedSteps: 4,
    };

    // Create cafe
    const cafe = await Cafe.create(cafeData);

    logger.info(`Cafe created by admin: ${cafe._id}`, {
      createdBy: adminId,
      cafeName: cafe.name,
      email: cafe.email,
      phone: cafe.phone,
    });

    // Create or update DiningCafe entry if dining is enabled
    if (cafe.diningSettings?.isEnabled) {
      const fallbackDiningImage =
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop";
      const locationText =
        (typeof cafe.location === "string" ? cafe.location : null) ||
        cafe.location?.formattedAddress ||
        cafe.location?.address ||
        cafe.location?.addressLine1 ||
        cafe.location?.street ||
        [cafe.location?.area, cafe.location?.city].filter(Boolean).join(", ") ||
        cafe.address ||
        "Location not available";

      const imageUrl =
        cafe.profileImage?.url ||
        cafe.menuImages?.[0]?.url ||
        cafe.onboarding?.step2?.profileImageUrl?.url ||
        fallbackDiningImage;

      const diningCafePayload = {
        name: cafe.name,
        rating: cafe.rating || 0,
        location: locationText,
        cafeId: cafe._id,
        distance: cafe.distance || "1.2 km",
        cuisine: Array.isArray(cafe.cuisines) && cafe.cuisines.length > 0
          ? cafe.cuisines[0]
          : "Multi-cuisine",
      category: cafe.diningSettings?.diningType,
      price: cafe.onboarding?.step4?.priceRange || undefined,
        image: imageUrl,
        offer: cafe.offer || undefined,
        deliveryTime: cafe.estimatedDeliveryTime || undefined,
        featuredDish: cafe.featuredDish || undefined,
        featuredPrice: cafe.featuredPrice || undefined,
        slug: cafe.slug,
        coordinates: {
          latitude: cafe.location?.latitude,
          longitude: cafe.location?.longitude,
        },
      };

      try {
        await DiningCafe.findOneAndUpdate(
          { slug: cafe.slug },
          diningCafePayload,
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      } catch (diningError) {
        logger.error(`Error syncing dining cafe: ${diningError.message}`, {
          cafeId: cafe._id,
        });
      }
    }

    // Prepare response data
    const responseData = {
      cafe: {
        id: cafe._id,
        cafeId: cafe.cafeId,
        name: cafe.name,
        email: cafe.email,
        phone: cafe.phone,
        isActive: cafe.isActive,
        slug: cafe.slug,
      },
    };

    // Include generated password in response if email was provided and password was auto-generated
    // This allows admin to share the password with the cafe
    if (email && !password && finalPassword) {
      responseData.generatedPassword = finalPassword;
      responseData.message =
        "Cafe created successfully. Please share the generated password with the cafe.";
    }

    return successResponse(
      res,
      201,
      "Cafe created successfully",
      responseData,
    );
  } catch (error) {
    logger.error(`Error creating cafe: ${error.message}`, {
      error: error.stack,
    });

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return errorResponse(
        res,
        400,
        `Cafe with this ${field} already exists`,
      );
    }

    return errorResponse(
      res,
      500,
      `Failed to create cafe: ${error.message}`,
    );
  }
});

/**
 * Delete Cafe
 * DELETE /api/admin/cafes/:id
 */
export const deleteCafe = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    // Delete cafe
    await Cafe.findByIdAndDelete(id);

    logger.info(`Cafe deleted: ${id}`, {
      deletedBy: adminId,
      cafeName: cafe.name,
    });

    return successResponse(res, 200, "Cafe deleted successfully", {
      cafe: {
        id: id,
        name: cafe.name,
      },
    });
  } catch (error) {
    logger.error(`Error deleting cafe: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to delete cafe");
  }
});

/**
 * Get All Offers with Cafe and Dish Details
 * GET /api/admin/offers
 * Query params: page, limit, search, status, cafeId
 */
export const getAllOffers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, cafeId } = req.query;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (cafeId) {
      query.cafe = cafeId;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch offers with cafe details
    const offers = await Offer.find(query)
      .populate("cafe", "name cafeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Offer.countDocuments(query);

    // Flatten offers to show each item separately
    const offerItems = [];
    offers.forEach((offer, offerIndex) => {
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach((item, itemIndex) => {
          // Apply search filter if provided
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch =
              offer.cafe?.name?.toLowerCase().includes(searchLower) ||
              item.itemName?.toLowerCase().includes(searchLower) ||
              item.couponCode?.toLowerCase().includes(searchLower);

            if (!matchesSearch) {
              return; // Skip this item if it doesn't match search
            }
          }

          offerItems.push({
            sl: skip + offerItems.length + 1,
            offerId: offer._id.toString(),
            cafeName: offer.cafe?.name || "Unknown Cafe",
            cafeId:
              offer.cafe?.cafeId ||
              offer.cafe?._id?.toString() ||
              "N/A",
            dishName: item.itemName || "Unknown Dish",
            dishId: item.itemId || "N/A",
            couponCode: item.couponCode || "N/A",
            discountType: offer.discountType || "percentage",
            discountPercentage: item.discountPercentage || 0,
            originalPrice: item.originalPrice || 0,
            discountedPrice: item.discountedPrice || 0,
            status: offer.status || "active",
            startDate: offer.startDate || null,
            endDate: offer.endDate || null,
            createdAt: offer.createdAt || new Date(),
          });
        });
      }
    });

    // If search was applied, we need to recalculate total
    let filteredTotal = offerItems.length;
    if (!search) {
      // Count all items across all offers
      const allOffers = await Offer.find(query).lean();
      filteredTotal = allOffers.reduce(
        (sum, offer) => sum + (offer.items?.length || 0),
        0,
      );
    }

    return successResponse(res, 200, "Offers retrieved successfully", {
      offers: offerItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching offers: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch offers");
  }
});

/**
 * Create Offer (Admin)
 * POST /api/admin/offers
 * Body: { cafeId, goalId, discountType, items: [{ itemId?, itemName, originalPrice, discountPercentage? | discountedPrice?, couponCode }], startDate?, endDate? }
 */
export const createOfferAdmin = asyncHandler(async (req, res) => {
  try {
    const {
      cafeId,
      goalId,
      discountType,
      items = [],
      startDate,
      endDate,
    } = req.body || {};

    if (!cafeId || !mongoose.Types.ObjectId.isValid(cafeId)) {
      return errorResponse(res, 400, "Valid cafeId is required");
    }

    const cafe = await Cafe.findById(cafeId).select("_id name").lean();
    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    const allowedGoalIds = [
      "grow-customers",
      "increase-value",
      "mealtime-orders",
      "delight-customers",
    ];
    if (!goalId || !allowedGoalIds.includes(goalId)) {
      return errorResponse(res, 400, "Valid goalId is required");
    }

    const allowedDiscountTypes = ["percentage", "flat-price"];
    if (!discountType || !allowedDiscountTypes.includes(discountType)) {
      return errorResponse(
        res,
        400,
        "Valid discountType is required (percentage, flat-price)",
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, "At least one item is required");
    }

    const normalizedItems = items.map((item) => {
      const itemName = trimText(item?.itemName);
      const couponCode = trimText(item?.couponCode);
      const itemId =
        trimText(item?.itemId) || new mongoose.Types.ObjectId().toString();
      const originalPrice = Number(item?.originalPrice);

      if (!itemName) {
        throw new Error("itemName is required");
      }
      if (!couponCode) {
        throw new Error("couponCode is required");
      }
      if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
        throw new Error("originalPrice must be a positive number");
      }

      let discountPercentage = Number(item?.discountPercentage);
      let discountedPrice = Number(item?.discountedPrice);

      if (discountType === "percentage") {
        if (!Number.isFinite(discountPercentage)) {
          throw new Error("discountPercentage is required for percentage offer");
        }
        if (discountPercentage < 0 || discountPercentage > 100) {
          throw new Error("discountPercentage must be between 0 and 100");
        }
        discountedPrice = Math.round(
          originalPrice * (1 - discountPercentage / 100) * 100,
        ) / 100;
      } else if (discountType === "flat-price") {
        if (!Number.isFinite(discountedPrice)) {
          throw new Error("discountedPrice is required for flat-price offer");
        }
        if (discountedPrice < 0 || discountedPrice > originalPrice) {
          throw new Error("discountedPrice must be between 0 and originalPrice");
        }
        discountPercentage = Math.round(
          ((originalPrice - discountedPrice) / originalPrice) * 100 * 100,
        ) / 100;
      }

      return {
        itemId,
        itemName,
        originalPrice,
        discountPercentage,
        discountedPrice,
        couponCode,
      };
    });

    const offer = await Offer.create({
      cafe: cafe._id,
      goalId,
      discountType,
      items: normalizedItems,
      status: "active",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    });

    return successResponse(res, 201, "Offer created successfully", { offer });
  } catch (error) {
    logger.error(`Error creating offer: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, error.message || "Failed to create offer");
  }
});

/**
 * Get Cafe Analytics for POS
 * GET /api/admin/cafe-analytics/:cafeId
 */
export const getCafeAnalytics = asyncHandler(async (req, res) => {
  try {
    const { cafeId } = req.params;

    logger.info(`Fetching cafe analytics for: ${cafeId}`);

    if (!cafeId) {
      return errorResponse(res, 400, "Cafe ID is required");
    }

    if (!mongoose.Types.ObjectId.isValid(cafeId)) {
      logger.warn(`Invalid cafe ID format: ${cafeId}`);
      return errorResponse(res, 400, "Invalid cafe ID format");
    }

    // Get cafe details
    const cafe = await Cafe.findById(cafeId);
    if (!cafe) {
      logger.warn(`Cafe not found: ${cafeId}`);
      return errorResponse(res, 404, "Cafe not found");
    }

    logger.info(
      `Cafe found: ${cafe.name} (${cafe.cafeId})`,
    );

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    // Get order statistics - cafeId can be _id or cafeId field (both as String in Order model)
    // Match by both cafe._id and cafe.cafeId
    const cafeIdString = cafeId.toString();
    const cafeIdField = cafe?.cafeId || cafeIdString;
    const cafeObjectIdString = cafe._id.toString();

    logger.info(`📊 Fetching order statistics for cafe:`, {
      cafeId: cafeId,
      cafeIdString: cafeIdString,
      cafeIdField: cafeIdField,
      cafeObjectIdString: cafeObjectIdString,
      cafeName: cafe.name,
    });

    // Build query to match cafeId in multiple formats
    const orderMatchQuery = {
      $or: [
        { cafeId: cafeIdString },
        { cafeId: cafeIdField },
        { cafeId: cafeObjectIdString },
      ],
    };

    logger.info(`🔍 Order query:`, orderMatchQuery);

    const orderStats = await Order.aggregate([
      {
        $match: orderMatchQuery,
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                { $ifNull: ["$pricing.total", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    logger.info(`📊 Order stats found:`, orderStats);

    const orderStatusMap = {};
    let totalRevenue = 0;
    orderStats.forEach((stat) => {
      orderStatusMap[stat._id] = stat.count;
      if (stat._id === "delivered") {
        totalRevenue += stat.totalRevenue || 0;
      }
    });

    const totalOrders =
      (orderStatusMap.delivered || 0) +
      (orderStatusMap.cancelled || 0) +
      (orderStatusMap.pending || 0) +
      (orderStatusMap.confirmed || 0) +
      (orderStatusMap.preparing || 0) +
      (orderStatusMap.ready || 0) +
      (orderStatusMap.out_for_delivery || 0);
    const completedOrders = orderStatusMap.delivered || 0;
    const cancelledOrders = orderStatusMap.cancelled || 0;

    logger.info(`📊 Calculated order statistics:`, {
      totalOrders,
      completedOrders,
      cancelledOrders,
      orderStatusMap,
    });

    // Get monthly orders and revenue
    const monthlyStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { cafeId: cafeIdString },
            { cafeId: cafeIdField },
          ],
          status: "delivered",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
        },
      },
    ]);

    const monthlyOrders = monthlyStats[0]?.count || 0;
    const monthlyRevenue = monthlyStats[0]?.revenue || 0;

    // Get yearly orders and revenue
    const yearlyStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { cafeId: cafeIdString },
            { cafeId: cafeIdField },
          ],
          status: "delivered",
          createdAt: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
        },
      },
    ]);

    const yearlyOrders = yearlyStats[0]?.count || 0;
    const yearlyRevenue = yearlyStats[0]?.revenue || 0;

    // Get commission and earnings data from OrderSettlement (more accurate)
    // Match settlements by cafeId (ObjectId in OrderSettlement)
    const cafeIdForSettlement =
      cafe._id instanceof mongoose.Types.ObjectId
        ? cafe._id
        : new mongoose.Types.ObjectId(cafe._id);

    // Get all settlements for this cafe
    const allSettlements = await OrderSettlement.find({
      cafeId: cafeIdForSettlement,
    }).lean();

    // Calculate totals from settlements
    let totalCommission = 0;
    let totalCafeEarning = 0;
    let totalFoodPrice = 0;

    allSettlements.forEach((s) => {
      totalCommission += s.cafeEarning?.commission || 0;
      totalCafeEarning += s.cafeEarning?.netEarning || 0;
      totalFoodPrice += s.cafeEarning?.foodPrice || 0;
    });

    totalCommission = Math.round(totalCommission * 100) / 100;
    totalCafeEarning = Math.round(totalCafeEarning * 100) / 100;
    totalFoodPrice = Math.round(totalFoodPrice * 100) / 100;

    // Get monthly settlements
    const monthlySettlements = await OrderSettlement.find({
      cafeId: cafeIdForSettlement,
      createdAt: { $gte: startOfMonth },
    }).lean();

    let monthlyCommission = 0;
    let monthlyCafeEarning = 0;
    monthlySettlements.forEach((s) => {
      monthlyCommission += s.cafeEarning?.commission || 0;
      monthlyCafeEarning += s.cafeEarning?.netEarning || 0;
    });

    monthlyCommission = Math.round(monthlyCommission * 100) / 100;
    monthlyCafeEarning = Math.round(monthlyCafeEarning * 100) / 100;
    const monthlyProfit = monthlyCafeEarning; // Cafe profit = net earning

    // Get yearly settlements
    const yearlySettlements = await OrderSettlement.find({
      cafeId: cafeIdForSettlement,
      createdAt: { $gte: startOfYear },
    }).lean();

    let yearlyCommission = 0;
    let yearlyCafeEarning = 0;
    yearlySettlements.forEach((s) => {
      yearlyCommission += s.cafeEarning?.commission || 0;
      yearlyCafeEarning += s.cafeEarning?.netEarning || 0;
    });

    yearlyCommission = Math.round(yearlyCommission * 100) / 100;
    yearlyCafeEarning = Math.round(yearlyCafeEarning * 100) / 100;
    const yearlyProfit = yearlyCafeEarning; // Cafe profit = net earning

    // Get average monthly profit (last 12 months)
    const last12MonthsStart = new Date(
      now.getFullYear(),
      now.getMonth() - 12,
      1,
    );
    const last12MonthsSettlements = await OrderSettlement.find({
      cafeId: cafeIdForSettlement,
      createdAt: { $gte: last12MonthsStart },
    }).lean();

    // Group by month
    const monthlyEarningsMap = new Map();
    last12MonthsSettlements.forEach((s) => {
      const monthKey = `${new Date(s.createdAt).getFullYear()}-${new Date(s.createdAt).getMonth()}`;
      const current = monthlyEarningsMap.get(monthKey) || 0;
      monthlyEarningsMap.set(
        monthKey,
        current + (s.cafeEarning?.netEarning || 0),
      );
    });

    const avgMonthlyProfit =
      monthlyEarningsMap.size > 0
        ? Array.from(monthlyEarningsMap.values()).reduce(
          (sum, val) => sum + val,
          0,
        ) / monthlyEarningsMap.size
        : 0;

    // Get commission percentage from CafeCommission
    const CafeCommission = (
      await import("../models/CafeCommission.js")
    ).default;

    // Use cafe._id directly - ensure it's an ObjectId
    const cafeIdForQuery =
      cafe._id instanceof mongoose.Types.ObjectId
        ? cafe._id
        : new mongoose.Types.ObjectId(cafe._id);

    logger.info(`🔍 Looking for commission config:`, {
      cafeId: cafeId,
      cafeObjectId: cafeIdForQuery.toString(),
      cafeName: cafe.name,
      cafeIdString: cafe.cafeId,
    });

    // Try using the static method first
    let commissionConfig =
      await CafeCommission.getCommissionForCafe(
        cafeIdForQuery,
      );

    if (commissionConfig) {
      // Convert to plain object if needed
      commissionConfig = commissionConfig.toObject
        ? commissionConfig.toObject()
        : commissionConfig;
      logger.info(`✅ Found commission using static method`);
    }

    // If not found, try direct query
    if (!commissionConfig) {
      logger.info(
        `⚠️ Static method didn't find commission, trying direct query`,
      );
      commissionConfig = await CafeCommission.findOne({
        cafe: cafeIdForQuery,
        status: true,
      });

      if (commissionConfig) {
        commissionConfig = commissionConfig.toObject
          ? commissionConfig.toObject()
          : commissionConfig;
      }
    }

    // If still not found, try without status filter
    if (!commissionConfig) {
      logger.info(`⚠️ Trying without status filter`);
      commissionConfig = await CafeCommission.findOne({
        cafe: cafeIdForQuery,
      });

      if (commissionConfig) {
        commissionConfig = commissionConfig.toObject
          ? commissionConfig.toObject()
          : commissionConfig;
      }
    }

    // Also try by cafeId string field
    if (!commissionConfig && cafe?.cafeId) {
      logger.info(
        `🔄 Trying by cafeId string: ${cafe.cafeId}`,
      );
      commissionConfig = await CafeCommission.findOne({
        cafeId: cafe.cafeId,
      });

      if (commissionConfig) {
        commissionConfig = commissionConfig.toObject
          ? commissionConfig.toObject()
          : commissionConfig;
      }
    }

    // Final debug: List all commissions to see what's in DB
    if (!commissionConfig) {
      const allCommissions = await CafeCommission.find({}).lean();
      logger.warn(
        `❌ No commission found. Total commissions in DB: ${allCommissions.length}`,
      );
      logger.info(
        `📋 All commissions:`,
        allCommissions.map((c) => ({
          _id: c._id,
          cafe: c.cafe?.toString
            ? c.cafe.toString()
            : String(c.cafe),
          cafeId: c.cafeId,
          cafeName: c.cafeName,
          status: c.status,
          defaultCommission: c.defaultCommission,
        })),
      );

      // Check if cafe ObjectId matches any commission
      const matching = allCommissions.filter((c) => {
        const cCafeId = c.cafe?.toString
          ? c.cafe.toString()
          : String(c.cafe);
        return cCafeId === cafeIdForQuery.toString();
      });
      logger.info(`🔍 Matching commissions: ${matching.length}`, matching);
    }

    let commissionPercentage = 0;
    if (commissionConfig) {
      logger.info(`✅ Commission config found for cafe ${cafeId}`);
      logger.info(`Commission config details:`, {
        _id: commissionConfig._id,
        cafe: commissionConfig.cafe?.toString
          ? commissionConfig.cafe.toString()
          : String(commissionConfig.cafe),
        cafeId: commissionConfig.cafeId,
        cafeName: commissionConfig.cafeName,
        status: commissionConfig.status,
        hasDefaultCommission: !!commissionConfig.defaultCommission,
        defaultCommissionType: commissionConfig.defaultCommission?.type,
        defaultCommissionValue: commissionConfig.defaultCommission?.value,
      });

      if (commissionConfig.defaultCommission) {
        // Get default commission value - if type is percentage, show the percentage value
        logger.info(`📊 Processing defaultCommission:`, {
          type: commissionConfig.defaultCommission.type,
          value: commissionConfig.defaultCommission.value,
          valueType: typeof commissionConfig.defaultCommission.value,
        });

        if (commissionConfig.defaultCommission.type === "percentage") {
          const rawValue = commissionConfig.defaultCommission.value;
          commissionPercentage =
            typeof rawValue === "number" ? rawValue : parseFloat(rawValue) || 0;
          logger.info(
            `✅ Found commission percentage: ${commissionPercentage}% for cafe ${cafeId} (raw value: ${rawValue})`,
          );
        } else if (commissionConfig.defaultCommission.type === "amount") {
          // For amount type, we can't show a percentage, so keep it as 0
          commissionPercentage = 0;
          logger.info(
            `⚠️ Commission type is 'amount', not 'percentage' for cafe ${cafeId}`,
          );
        }
      } else {
        logger.warn(
          `⚠️ Commission config found but no defaultCommission for cafe ${cafeId}`,
        );
      }
    } else {
      logger.warn(
        `❌ No commission config found for cafe ${cafeId} (cafe._id: ${cafeIdForQuery.toString()})`,
      );
      logger.warn(
        `⚠️ This cafe may not have a commission configuration set up.`,
      );
      logger.warn(
        `💡 To set up commission, go to Cafe Commission page and add commission for this cafe.`,
      );
    }

    // Log the final commission percentage being returned
    logger.info(
      `📊 Final commission percentage being returned: ${commissionPercentage}%`,
    );
    logger.info(
      `📤 Sending response with commissionPercentage: ${commissionPercentage}`,
    );

    const FeedbackExperience = (await import("../models/FeedbackExperience.js"))
      .default;

    const cafeIdForRating =
      cafe._id instanceof mongoose.Types.ObjectId
        ? cafe._id
        : new mongoose.Types.ObjectId(cafe._id);

    logger.info(`⭐ Fetching ratings for cafe:`, {
      cafeId: cafeId,
      cafeObjectId: cafeIdForRating.toString(),
    });

    const ratingStats = await FeedbackExperience.aggregate([
      {
        $match: {
          cafeId: cafeIdForRating,
          rating: { $exists: true, $ne: null, $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    logger.info(`⭐ Rating stats found:`, ratingStats);

    const averageRating = ratingStats[0]?.averageRating || 0;
    const totalRatings = ratingStats[0]?.totalRatings || 0;

    logger.info(`⭐ Calculated ratings:`, {
      averageRating,
      totalRatings,
    });

    // Get unique customers
    const customerStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { cafeId: cafeIdString },
            { cafeId: cafeIdField },
          ],
          status: "delivered",
        },
      },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const totalCustomers = customerStats.length;
    const repeatCustomers = customerStats.filter(
      (c) => c.orderCount > 1,
    ).length;

    // Calculate average order value
    const averageOrderValue =
      completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Calculate rates
    const cancellationRate =
      totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Calculate average yearly profit (if cafe has been active for multiple years)
    const cafeCreatedAt = cafe.createdAt || new Date();
    const yearsActive = Math.max(
      1,
      (now - cafeCreatedAt) / (365 * 24 * 60 * 60 * 1000),
    );
    const averageYearlyProfit =
      yearsActive > 0
        ? yearlyCafeEarning / yearsActive
        : yearlyCafeEarning;

    return successResponse(
      res,
      200,
      "Cafe analytics retrieved successfully",
      {
        cafe: {
          _id: cafe._id,
          name: cafe.name,
          cafeId: cafe.cafeId,
          isActive: cafe.isActive,
          createdAt: cafe.createdAt,
        },
        analytics: {
          totalOrders: Number(totalOrders) || 0,
          cancelledOrders: Number(cancelledOrders) || 0,
          completedOrders: Number(completedOrders) || 0,
          averageRating: averageRating
            ? parseFloat(averageRating.toFixed(1))
            : 0,
          totalRatings: Number(totalRatings) || 0,
          commissionPercentage: Number(commissionPercentage) || 0,
          monthlyProfit: parseFloat(monthlyCafeEarning.toFixed(2)),
          yearlyProfit: parseFloat(yearlyCafeEarning.toFixed(2)),
          averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalCommission: parseFloat(totalCommission.toFixed(2)),
          cafeEarning: parseFloat(totalCafeEarning.toFixed(2)),
          monthlyOrders,
          yearlyOrders,
          averageMonthlyProfit: parseFloat(avgMonthlyProfit.toFixed(2)),
          averageYearlyProfit: parseFloat(averageYearlyProfit.toFixed(2)),
          status: cafe.isActive ? "active" : "inactive",
          joinDate: cafe.createdAt,
          totalCustomers,
          repeatCustomers,
          cancellationRate: parseFloat(cancellationRate.toFixed(2)),
          completionRate: parseFloat(completionRate.toFixed(2)),
        },
      },
    );
  } catch (error) {
    logger.error(`Error fetching cafe analytics: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch cafe analytics");
  }
});

/**
 * Get Customer Wallet Report
 * GET /api/admin/customer-wallet-report
 * Query params: fromDate, toDate, all (Credit/Debit), customer, search
 */
export const getCustomerWalletReport = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Fetching customer wallet report...");
    const { fromDate, toDate, all, customer, search } = req.query;

    console.log("📋 Query params:", {
      fromDate,
      toDate,
      all,
      customer,
      search,
    });

    const UserWallet = (await import("../../user/models/UserWallet.js"))
      .default;
    const User = (await import("../../auth/models/User.js")).default;

    // Build date filter
    let dateFilter = {};
    if (fromDate || toDate) {
      dateFilter["transactions.createdAt"] = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        dateFilter["transactions.createdAt"].$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter["transactions.createdAt"].$lte = endDate;
      }
    }

    // Get all wallets with transactions
    const wallets = await UserWallet.find({
      ...dateFilter,
      "transactions.0": { $exists: true }, // Only wallets with transactions
    })
      .populate("userId", "name email phone")
      .lean();

    // Flatten transactions with user info
    let allTransactions = [];
    wallets.forEach((wallet) => {
      if (!wallet.userId) return;

      // Sort transactions by date (oldest first for balance calculation)
      const sortedTransactions = [...wallet.transactions].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );

      let runningBalance = 0;

      sortedTransactions.forEach((transaction) => {
        // Update running balance if transaction is completed (before date filter)
        let balance = runningBalance;
        if (transaction.status === "Completed") {
          if (
            transaction.type === "addition" ||
            transaction.type === "refund"
          ) {
            runningBalance += transaction.amount;
            balance = runningBalance;
          } else if (transaction.type === "deduction") {
            runningBalance -= transaction.amount;
            balance = runningBalance;
          }
        }

        // Apply date filter if provided
        if (fromDate || toDate) {
          const transDate = new Date(transaction.createdAt);
          if (fromDate && transDate < new Date(fromDate)) return;
          if (toDate) {
            const toDateObj = new Date(toDate);
            toDateObj.setHours(23, 59, 59, 999);
            if (transDate > toDateObj) return;
          }
        }

        // Map transaction type to frontend format
        let transactionType = "CashBack";
        if (transaction.type === "addition") {
          if (
            transaction.description?.includes("Admin") ||
            transaction.description?.includes("admin")
          ) {
            transactionType = "Add Fund By Admin";
          } else {
            transactionType = "Add Fund";
          }
        } else if (transaction.type === "deduction") {
          transactionType = "Order Payment";
        } else if (transaction.type === "refund") {
          transactionType = "Refund";
        }

        // Get reference
        let reference = "N/A";
        if (transaction.orderId) {
          reference = transaction.orderId.toString();
        } else if (transaction.paymentGateway) {
          reference = transaction.paymentGateway;
        } else if (transaction.description) {
          reference = transaction.description;
        }

        allTransactions.push({
          _id: transaction._id,
          transactionId: transaction._id.toString(),
          customer: wallet.userId.name || "Unknown",
          customerId: wallet.userId._id.toString(),
          credit:
            transaction.type === "addition" || transaction.type === "refund"
              ? transaction.amount
              : 0,
          debit: transaction.type === "deduction" ? transaction.amount : 0,
          balance: balance,
          transactionType: transactionType,
          reference: reference,
          createdAt: transaction.createdAt,
          status: transaction.status,
          type: transaction.type,
        });
      });
    });

    // Filter by transaction type (Credit/Debit)
    if (all && all !== "All") {
      if (all === "Credit") {
        allTransactions = allTransactions.filter((t) => t.credit > 0);
      } else if (all === "Debit") {
        allTransactions = allTransactions.filter((t) => t.debit > 0);
      }
    }

    // Filter by customer
    if (customer && customer !== "Select Customer") {
      allTransactions = allTransactions.filter((t) =>
        t.customer.toLowerCase().includes(customer.toLowerCase()),
      );
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allTransactions = allTransactions.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(searchLower) ||
          t.customer.toLowerCase().includes(searchLower) ||
          t.reference.toLowerCase().includes(searchLower),
      );
    }

    // Sort by date (newest first)
    allTransactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    // Format currency
    const formatCurrency = (amount) => {
      return `₹${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format date
    const formatDate = (date) => {
      const d = new Date(date);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
    };

    // Transform transactions for frontend
    const transformedTransactions = allTransactions.map(
      (transaction, index) => ({
        sl: index + 1,
        transactionId: transaction.transactionId,
        customer: transaction.customer,
        credit: formatCurrency(transaction.credit),
        debit: formatCurrency(transaction.debit),
        balance: formatCurrency(transaction.balance),
        transactionType: transaction.transactionType,
        reference: transaction.reference,
        createdAt: formatDate(transaction.createdAt),
      }),
    );

    // Calculate summary statistics
    const totalDebit = allTransactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = allTransactions.reduce((sum, t) => sum + t.credit, 0);
    const totalBalance = totalCredit - totalDebit;

    // Get unique customers for dropdown
    const uniqueCustomers = [
      ...new Set(allTransactions.map((t) => t.customer)),
    ].sort();

    return successResponse(
      res,
      200,
      "Customer wallet report retrieved successfully",
      {
        transactions: transformedTransactions,
        stats: {
          debit: formatCurrency(totalDebit),
          credit: formatCurrency(totalCredit),
          balance: formatCurrency(totalBalance),
        },
        customers: uniqueCustomers,
        pagination: {
          page: 1,
          limit: 10000,
          total: transformedTransactions.length,
          pages: 1,
        },
      },
    );
  } catch (error) {
    console.error("❌ Error fetching customer wallet report:", error);
    console.error("Error stack:", error.stack);
    return errorResponse(
      res,
      500,
      error.message || "Failed to fetch customer wallet report",
    );
  }
});

/**
 * Update Cafe Zone
 * PUT /api/admin/cafes/:id/zone
 */
export const updateCafeZone = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { zoneId } = req.body;

    // Cafe is already imported at the top of file

    const cafe = await Cafe.findById(id);

    if (!cafe) {
      return errorResponse(res, 404, "Cafe not found");
    }

    if (!cafe.location) {
      cafe.location = {};
    }

    // Update location.zoneId
    cafe.location.zoneId = zoneId;
    await cafe.save();

    logger.info(`Cafe zone updated: ${id} -> ${zoneId}`, {
      updatedBy: req.user._id,
    });

    return successResponse(res, 200, "Cafe zone updated successfully", {
      cafe: {
        id: cafe._id,
        name: cafe.name,
        zoneId: cafe.location.zoneId,
      },
    });
  } catch (error) {
    logger.error(`Error updating cafe zone: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update cafe zone");
  }
});
