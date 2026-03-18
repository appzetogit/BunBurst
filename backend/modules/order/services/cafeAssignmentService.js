import Cafe from '../../cafe/models/Cafe.js';
import Zone from '../../admin/models/Zone.js';
import mongoose from 'mongoose';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Check if a point is within a zone polygon using ray casting algorithm
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} zoneCoordinates - Zone coordinates array
 * @returns {boolean}
 */
function isPointInZone(lat, lng, zoneCoordinates) {
  if (!zoneCoordinates || zoneCoordinates.length < 3) return false;
  
  // Ray casting algorithm for point-in-polygon test
  let inside = false;
  for (let i = 0, j = zoneCoordinates.length - 1; i < zoneCoordinates.length; j = i++) {
    // Extract coordinates from zone coordinate objects
    const coordI = zoneCoordinates[i];
    const coordJ = zoneCoordinates[j];
    
    const xi = typeof coordI === 'object' 
      ? (coordI.longitude ?? coordI.lng) 
      : (Array.isArray(coordI) ? coordI[0] : null);
    const yi = typeof coordI === 'object' 
      ? (coordI.latitude ?? coordI.lat) 
      : (Array.isArray(coordI) ? coordI[1] : null);
    const xj = typeof coordJ === 'object' 
      ? (coordJ.longitude ?? coordJ.lng) 
      : (Array.isArray(coordJ) ? coordJ[0] : null);
    const yj = typeof coordJ === 'object' 
      ? (coordJ.latitude ?? coordJ.lat) 
      : (Array.isArray(coordJ) ? coordJ[1] : null);
    
    if (xi === null || yi === null || xj === null || yj === null) continue;
    
    // Ray casting: check if ray from point crosses edge
    const intersect = ((yi > lat) !== (yj > lat)) && 
                     (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a cafe's location (pin) is within any active zone
 * @param {number} cafeLat - Cafe latitude
 * @param {number} cafeLng - Cafe longitude
 * @returns {Promise<Object|null>} Zone object if cafe is in zone, null otherwise
 */
async function isCafeInAnyZone(cafeLat, cafeLng) {
  if (!cafeLat || !cafeLng) return null;
  
  const activeZones = await Zone.find({ isActive: true }).lean();
  
  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;
    
    let isInZone = false;
    if (typeof zone.containsPoint === 'function') {
      isInZone = zone.containsPoint(cafeLat, cafeLng);
    } else {
      isInZone = isPointInZone(cafeLat, cafeLng, zone.coordinates);
    }
    
    if (isInZone) {
      return zone;
    }
  }
  
  return null;
}

/**
 * Find nearest cafe based on delivery location
 * ONLY cafes whose location (pin) is within active zones will receive orders
 * @param {number} deliveryLat - Delivery latitude
 * @param {number} deliveryLng - Delivery longitude
 * @param {Array} orderItems - Order items (to check cafe availability)
 * @returns {Object|null} Nearest cafe or null
 */
export async function findNearestCafe(deliveryLat, deliveryLng, orderItems = []) {
  try {
    // Validate coordinates
    if (!deliveryLat || !deliveryLng || 
        typeof deliveryLat !== 'number' || typeof deliveryLng !== 'number' ||
        deliveryLat < -90 || deliveryLat > 90 || 
        deliveryLng < -180 || deliveryLng > 180) {
      throw new Error('Invalid delivery coordinates');
    }

    // Step 1: Get all active cafes with valid locations
    const allCafes = await Cafe.find({
      isActive: true,
      isAcceptingOrders: true,
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    }).lean();

    // Step 2: Filter cafes - ONLY those whose location (pin) is within active zones
    const cafesInZones = [];
    
    for (const cafe of allCafes) {
      const cafeLat = cafe.location?.latitude || cafe.location?.coordinates?.[1];
      const cafeLng = cafe.location?.longitude || cafe.location?.coordinates?.[0];
      
      if (!cafeLat || !cafeLng) continue;
      
      // Check if cafe's location (pin) is within any active zone
      const zone = await isCafeInAnyZone(cafeLat, cafeLng);
      
      if (zone) {
        // Cafe is in a zone, now check if delivery location is also in the same zone
        let deliveryInZone = false;
        if (typeof zone.containsPoint === 'function') {
          deliveryInZone = zone.containsPoint(deliveryLat, deliveryLng);
        } else {
          deliveryInZone = isPointInZone(deliveryLat, deliveryLng, zone.coordinates);
        }
        
        if (deliveryInZone) {
          // Both cafe and delivery location are in the same zone
          const distance = calculateDistance(deliveryLat, deliveryLng, cafeLat, cafeLng);
          
          cafesInZones.push({
            cafe: cafe,
            cafeId: cafe._id?.toString() || cafe.cafeId,
            zoneId: zone._id.toString(),
            zoneName: zone.name || zone.zoneName,
            distance: distance
          });
        }
      }
    }

    // Step 3: If no cafes found, return null (strict zone-based assignment)
    if (cafesInZones.length === 0) {
      console.log('⚠️ No cafes found whose location is within active zones for delivery location:', deliveryLat, deliveryLng);
      return null;
    }

    // Sort by distance and return nearest cafe
    cafesInZones.sort((a, b) => a.distance - b.distance);
    
    return {
      cafe: cafesInZones[0].cafe,
      cafeId: cafesInZones[0].cafeId,
      zoneId: cafesInZones[0].zoneId,
      zoneName: cafesInZones[0].zoneName,
      distance: cafesInZones[0].distance,
      assignedBy: 'zone_based'
    };
  } catch (error) {
    console.error('Error finding nearest cafe:', error);
    throw error;
  }
}

/**
 * Assign order to nearest cafe
 * @param {Object} orderData - Order data including delivery location
 * @returns {Object} Updated order data with assigned cafe
 */
export async function assignOrderToNearestCafe(orderData) {
  try {
    const deliveryLocation = orderData.address?.location?.coordinates || 
                           [orderData.address?.location?.longitude || 0, 
                            orderData.address?.location?.latitude || 0];
    
    const deliveryLat = deliveryLocation[1] || orderData.address?.location?.latitude;
    const deliveryLng = deliveryLocation[0] || orderData.address?.location?.longitude;

    if (!deliveryLat || !deliveryLng) {
      throw new Error('Delivery location coordinates are required');
    }

    const nearestCafe = await findNearestCafe(
      deliveryLat, 
      deliveryLng, 
      orderData.items || []
    );

    if (!nearestCafe) {
      throw new Error('No available cafe found for this delivery location');
    }

    return {
      ...orderData,
      cafeId: nearestCafe.cafeId,
      cafeName: nearestCafe.cafe.name || 'Unknown Cafe',
      assignedCafe: {
        cafeId: nearestCafe.cafeId,
        distance: nearestCafe.distance,
        assignedBy: nearestCafe.assignedBy,
        zoneId: nearestCafe.zoneId || null,
        zoneName: nearestCafe.zoneName || null
      }
    };
  } catch (error) {
    console.error('Error assigning order to cafe:', error);
    throw error;
  }
}

