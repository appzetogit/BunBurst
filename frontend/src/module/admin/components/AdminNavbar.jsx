import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  User,
  ChevronDown,
  LogOut,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import appzetoLogo from "@/assets/appzetologo.png";
import { adminAPI } from "@/lib/api";
import { clearModuleAuth } from "@/lib/utils/auth";
import { getCachedSettings, loadBusinessSettings } from "@/lib/utils/businessSettings";
import { sidebarMenuData } from "@/module/admin/data/sidebarMenu";

const collectSearchableRoutes = (menuData) => {
  const routes = [];

  for (const entry of menuData || []) {
    if (entry?.type === "link" && entry?.path) {
      routes.push({ label: entry.label || entry.path, path: entry.path });
    }

    if (Array.isArray(entry?.items)) {
      for (const item of entry.items) {
        if (item?.type === "link" && item?.path) {
          routes.push({ label: item.label || item.path, path: item.path });
        }

        if (item?.type === "expandable" && Array.isArray(item?.subItems)) {
          for (const subItem of item.subItems) {
            if (subItem?.path) {
              routes.push({ label: subItem.label || subItem.path, path: subItem.path });
            }
          }
        }
      }
    }
  }

  return routes;
};

const searchableAdminRoutes = collectSearchableRoutes(sidebarMenuData);

export default function AdminNavbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [adminData, setAdminData] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Load admin data from localStorage
  useEffect(() => {
    const loadAdminData = () => {
      try {
        const adminUserStr = localStorage.getItem('admin_user');
        if (adminUserStr) {
          const adminUser = JSON.parse(adminUserStr);
          setAdminData(adminUser);
        }
      } catch (error) {
        console.error('Error loading admin data:', error);
      }
    };

    loadAdminData();

    // Listen for auth changes
    const handleAuthChange = () => {
      loadAdminData();
    };
    window.addEventListener('adminAuthChanged', handleAuthChange);

    return () => {
      window.removeEventListener('adminAuthChanged', handleAuthChange);
    };
  }, []);

  // Load business settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await loadBusinessSettings();
        if (settings) {
          setBusinessSettings(settings);
        } else {
          // Try to get from cache
          const cached = getCachedSettings();
          if (cached) {
            setBusinessSettings(cached);
          }
        }
      } catch (error) {
        console.warn('Error loading business settings in navbar:', error);
      }
    };

    loadSettings();

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      loadSettings();
    };
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      // Call backend logout API to clear refresh token cookie
      try {
        await adminAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        console.warn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Clear admin authentication data from localStorage
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');

      // Clear sessionStorage if any
      sessionStorage.removeItem('adminAuthData');

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to admin login page
      navigate('/admin/login', { replace: true });
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      console.error("Error during logout:", error);

      // Clear local data anyway
      clearModuleAuth('admin');
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_user');
      sessionStorage.removeItem('adminAuthData');
      window.dispatchEvent(new Event('adminAuthChanged'));

      // Navigate to login
      navigate('/admin/login', { replace: true });
    }
  };

  const handleSearch = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    // Allow direct admin path search
    if (query.startsWith("/admin")) {
      navigate(query);
      return;
    }

    // Prefer exact label match, then partial match, then path match
    const exactMatch = searchableAdminRoutes.find((item) => item.label?.toLowerCase() === query);
    const partialLabelMatch = searchableAdminRoutes.find((item) => item.label?.toLowerCase().includes(query));
    const partialPathMatch = searchableAdminRoutes.find((item) => item.path?.toLowerCase().includes(query));
    const target = exactMatch || partialLabelMatch || partialPathMatch;

    if (target?.path) {
      navigate(target.path);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-neutral-950 border-b border-neutral-800 shadow-sm">

        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-48 h-16 rounded-lg bg-neutral-950 flex items-center justify-center ring-neutral-800">
                {businessSettings?.logo?.url ? (
                  <img
                    src={businessSettings.logo.url}
                    alt={businessSettings.companyName || "Company"}
                    className="w-44 h-14 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback to default logo if company logo fails to load
                      e.target.src = appzetoLogo;
                    }}
                  />
                ) : (
                  businessSettings?.companyName ? (
                    <span className="text-sm font-semibold text-white px-2 truncate">
                      {businessSettings.companyName}
                    </span>
                  ) : (
                    <img src={appzetoLogo} alt={businessSettings?.companyName || "Company"} className="w-44 h-14 object-contain" loading="lazy" />
                  )
                )}
              </div>
            </div>
          </div>

          {/* Center: Search Bar (Display only) */}
          <div className="flex-1 flex justify-center max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Search"
                className="pl-10 pr-20 py-2 rounded-full bg-neutral-900 text-neutral-200 border-neutral-800 focus-visible:ring-neutral-700 focus-visible:ring-1"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 transition-colors"
              >
                Enter
              </button>
            </div>
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-3">
            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 pl-3 border-l border-neutral-800 cursor-pointer hover:bg-neutral-900 rounded-md px-2 py-1 transition-colors">

                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-neutral-200">
                      {adminData?.name || "Admin User"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {adminData?.email
                        ? (() => {
                          const [local, domain] = adminData.email.split("@");
                          return (
                            local[0] +
                            "*".repeat(Math.min(local.length - 1, 5)) +
                            "@" +
                            domain
                          );
                        })()
                        : "admin@example.com"}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400 hidden md:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 text-neutral-900 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <div className="p-4 border-b border-neutral-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-300">
                      {adminData?.profileImage ? (
                        <img
                          src={adminData.profileImage && adminData.profileImage.trim() ? adminData.profileImage : undefined}
                          alt={adminData.name || "Admin"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-neutral-600">
                          {adminData?.name
                            ? adminData.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .substring(0, 2)
                            : "AD"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {adminData?.name || "Admin User"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {adminData?.email
                          ? (() => {
                            const [local, domain] = adminData.email.split("@");
                            return (
                              local[0] +
                              "*".repeat(Math.min(local.length - 1, 5)) +
                              "@" +
                              domain
                            );
                          })()
                          : "admin@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                    onClick={() => navigate("/admin/profile")}
                  >
                    <User className="mr-2 w-4 h-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-neutral-100 focus:bg-neutral-100"
                    onClick={() => navigate("/admin/settings")}
                  >
                    <Settings className="mr-2 w-4 h-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

    </>
  );
}
