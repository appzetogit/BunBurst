import jwtService from '../../auth/services/jwtService.js';
import Cafe from '../models/Cafe.js';
import { errorResponse } from '../../../shared/utils/response.js';

/**
 * Cafe Authentication Middleware
 * Verifies JWT access token and attaches cafe to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);

    // Ensure it's a cafe token
    if (decoded.role !== 'cafe') {
      return errorResponse(res, 403, 'Invalid token. Cafe access required.');
    }

    // Get cafe from database
    const cafe = await Cafe.findById(decoded.userId).select('-password');
    
    if (!cafe) {
      console.error('❌ Cafe not found in database:', {
        userId: decoded.userId,
        role: decoded.role,
        email: decoded.email,
      });
      return errorResponse(res, 401, 'Cafe not found');
    }

    // Allow inactive cafes to access onboarding and profile routes
    // They need to complete onboarding even if not yet approved by admin
    // Only block inactive cafes from accessing other restricted routes
    const requestPath = req.originalUrl || req.url || '';
    const reqPath = req.path || '';
    const baseUrl = req.baseUrl || '';
    
    // Check for onboarding routes (can be /onboarding or /api/cafe/onboarding)
    const isOnboardingRoute = requestPath.includes('/onboarding') || reqPath === '/onboarding' || reqPath.includes('onboarding');
    
    // Check for profile/auth routes
    // Note: /auth/me and /auth/reverify are handled by cafeAuthRoutes mounted at /auth, so:
    // - Full path: /api/cafe/auth/me or /api/cafe/auth/reverify
    // - reqPath: /me or /reverify (relative to /auth mount point)
    // - baseUrl: /auth (if mounted)
    // /owner/me is directly under /api/cafe, so reqPath would be /owner/me
    const isProfileRoute = requestPath.includes('/auth/me') || requestPath.includes('/auth/reverify') || 
                          requestPath.includes('/owner/me') || 
                          reqPath === '/me' || reqPath === '/reverify' || reqPath === '/owner/me' ||
                          (baseUrl.includes('/auth') && (reqPath === '/me' || reqPath === '/reverify'));
    
    // Check for menu routes - cafes need to access menu even when inactive
    // They might need to set up menu during onboarding or after approval
    // Routes: /api/cafe/menu, /api/cafe/menu/section, /api/cafe/menu/item/schedule, etc.
    const isMenuRoute = requestPath.includes('/menu') || 
                       reqPath === '/menu' || 
                       reqPath.startsWith('/menu/') ||
                       baseUrl.includes('/menu');
    
    // Check for inventory routes - cafes need to manage inventory even when inactive
    // Routes: /api/cafe/inventory
    const isInventoryRoute = requestPath.includes('/inventory') || 
                            reqPath === '/inventory' ||
                            reqPath.startsWith('/inventory/');
    
    // Debug logging for inactive cafes
    if (!cafe.isActive) {
      console.log('🔍 Inactive cafe route check:', {
        cafeId: cafe._id,
        cafeName: cafe.name,
        isActive: cafe.isActive,
        requestPath,
        reqPath,
        baseUrl,
        originalUrl: req.originalUrl,
        url: req.url,
        isOnboardingRoute,
        isProfileRoute,
        isMenuRoute,
        isInventoryRoute,
        willAllow: isOnboardingRoute || isProfileRoute || isMenuRoute || isInventoryRoute
      });
    }
    
    // Allow access to onboarding, profile, menu, and inventory routes even if inactive
    // These are essential for cafe setup and management
    // Also allow access to getCurrentCafe endpoint (used to check status)
    if (!cafe.isActive && !isOnboardingRoute && !isProfileRoute && !isMenuRoute && !isInventoryRoute) {
      console.error('❌ Cafe account is inactive - access denied:', {
        cafeId: cafe._id,
        cafeName: cafe.name,
        isActive: cafe.isActive,
        requestPath,
        reqPath,
        baseUrl,
        originalUrl: req.originalUrl,
        url: req.url,
        routeChecks: {
          isOnboardingRoute,
          isProfileRoute,
          isMenuRoute,
          isInventoryRoute
        }
      });
      return errorResponse(res, 401, 'Cafe account is inactive. Please wait for admin approval.');
    }

    // Attach cafe to request
    req.cafe = cafe;
    req.token = decoded;
    
    next();
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Invalid token');
  }
};

export default { authenticate };

