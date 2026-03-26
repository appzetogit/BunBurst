// Sidebar menu structure with all items
export const sidebarMenuData = [
  {
    type: "link",
    label: "Dashboard",
    path: "/admin",
    icon: "LayoutDashboard",
  },

  {
    type: "section",
    label: "FOOD MANAGEMENT",
    items: [
      {
        type: "expandable",
        label: "Foods",
        icon: "Utensils",
        subItems: [
          { label: "Cafe Foods List", path: "/admin/foods" },
          { label: "Cafe Addons List", path: "/admin/addons" },
          { label: "Menu Setup", path: "/admin/food/menu-add" },
        ],
      },
      {
        type: "expandable",
        label: "Categories",
        icon: "FolderTree",
        subItems: [{ label: "Category", path: "/admin/categories" }],
      },
    ],
  },
  {
    type: "section",
    label: "CAFE MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Zone Setup",
        path: "/admin/zone-setup",
        icon: "MapPin",
      },
      {
        type: "expandable",
        label: "Cafes",
        icon: "UtensilsCrossed",
        subItems: [
          { label: "Cafes List", path: "/admin/cafes" },
          {
            label: "Cafe Complaints",
            path: "/admin/cafes/complaints",
          },
        ],
      },
    ],
  },

  {
    type: "section",
    label: "ORDER MANAGEMENT",
    items: [
      {
        type: "expandable",
        label: "Orders",
        icon: "FileText",
        subItems: [
          { label: "All", path: "/admin/orders/all" },
          { label: "Pending", path: "/admin/orders/pending" },
          { label: "Processing", path: "/admin/orders/processing" },
          { label: "Food On The Way", path: "/admin/orders/food-on-the-way" },
          { label: "Delivered", path: "/admin/orders/delivered" },
          { label: "Pickup Orders", path: "/admin/orders/pickup" },
          { label: "Cancelled", path: "/admin/orders/cancelled" },
          { label: "Refunded", path: "/admin/orders/refunded" },
          { label: "Offline Payments", path: "/admin/orders/offline-payments" },
        ],
      },
      {
        type: "link",
        label: "Order Detect Delivery",
        path: "/admin/order-detect-delivery",
        icon: "Truck",
      },
    ],
  },
  {
    type: "section",
    label: "PROMOTIONS MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Manage Coupons",
        path: "/admin/coupons",
        icon: "Gift",
      },

      {
        type: "link",
        label: "Push Notification",
        path: "/admin/push-notification",
        icon: "Bell",
      },
    ],
  },

  {
    type: "section",
    label: "CUSTOMER MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Customers",
        path: "/admin/customers",
        icon: "Users",
      },
    ],
  },
  {
    type: "section",
    label: "DELIVERYMAN MANAGEMENT",
    items: [

      {
        type: "link",
        label: "Delivery & Platform Fee",
        path: "/admin/fee-settings",
        icon: "DollarSign",
      },



      {
        type: "link",
        label: "Delivery Emergency Help",
        path: "/admin/delivery-emergency-help",
        icon: "Phone",
      },
      {
        type: "link",
        label: "Delivery Support Tickets",
        path: "/admin/delivery-support-tickets",
        icon: "MessageSquare",
      },
      {
        type: "expandable",
        label: "Deliveryman",
        icon: "Package",
        subItems: [
          {
            label: "New Join Request",
            path: "/admin/delivery-partners/join-request",
          },
          { label: "Deliveryman List", path: "/admin/delivery-partners" },
          {
            label: "Salary Setup",
            path: "/admin/delivery-partners/salary-setup",
          },
          { label: "Cash Settlements", path: "/admin/delivery-boy-wallet" },
        ],
      },
    ],
  },

  {
    type: "section",
    label: "HELP & SUPPORT",
    items: [
      {
        type: "link",
        label: "User Feedback",
        path: "/admin/contact-messages",
        icon: "Mail",
      },
      {
        type: "link",
        label: "Safety Emergency Reports",
        path: "/admin/safety-emergency-reports",
        icon: "AlertTriangle",
      },
    ],
  },

  {
    type: "section",
    label: "REPORT MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Transaction Report",
        path: "/admin/transaction-report",
        icon: "FileText",
      },
      {
        type: "link",
        label: "Order Report",
        path: "/admin/order-report/regular",
        icon: "FileText",
      },
      {
        type: "link",
        label: "Cafe Report",
        path: "/admin/cafe-report",
        icon: "FileText",
      },
      {
        type: "expandable",
        label: "Customer Report",
        icon: "FileText",
        subItems: [
          {
            label: "Feedback Experience",
            path: "/admin/customer-report/feedback-experience",
          },
        ],
      },
    ],
  },
  {
    type: "section",
    label: "BANNER SETTINGS",
    items: [
      {
        type: "link",
        label: "Landing Page Management",
        path: "/admin/hero-banner-management",
        icon: "Image",
      },
    ],
  },
  {
    type: "section",
    label: "DINING MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Dining Banners",
        path: "/admin/dining-management",
        icon: "UtensilsCrossed",
      },
      {
        type: "link",
        label: "Dining List",
        path: "/admin/dining-list",
        icon: "FileText",
      },
    ],
  },
  {
    type: "section",
    label: "BUSINESS SETTINGS",
    items: [
      {
        type: "link",
        label: "Business Setup",
        path: "/admin/business-setup",
        icon: "Settings",
      },
      {
        type: "expandable",
        label: "Pages & Social Media",
        icon: "Link",
        subItems: [
          {
            label: "Terms And Condition",
            path: "/admin/pages-social-media/terms",
          },
          {
            label: "Privacy Policy",
            path: "/admin/pages-social-media/privacy",
          },
          { label: "About Us", path: "/admin/pages-social-media/about" },
          { label: "Refund Policy", path: "/admin/pages-social-media/refund" },
          {
            label: "Shipping Policy",
            path: "/admin/pages-social-media/shipping",
          },
          {
            label: "Cancellation Policy",
            path: "/admin/pages-social-media/cancellation",
          },
        ],
      },
    ],
  },

  {
    type: "section",
    label: "SYSTEM ENV",
    items: [
      {
        type: "link",
        label: "ENV Setup",
        path: "/admin/env",
        icon: "Plus",
      },
    ],
  },
];
