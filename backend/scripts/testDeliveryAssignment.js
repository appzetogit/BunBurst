/**
 * Test Script: Delivery Assignment Flow
 * This script tests the complete flow from cafe accepting order to delivery boy receiving notification
 * 
 * Usage: node backend/scripts/testDeliveryAssignment.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Order from '../modules/order/models/Order.js';
import Cafe from '../modules/cafe/models/Cafe.js';
import Delivery from '../modules/delivery/models/Delivery.js';
import { assignOrderToDeliveryBoy } from '../modules/order/services/deliveryAssignmentService.js';
import { notifyDeliveryBoyNewOrder } from '../modules/order/services/deliveryNotificationService.js';

dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDeliveryAssignment() {
  try {
    log('\n🧪 Starting Delivery Assignment Test...\n', 'cyan');

    // Connect to database
    log('📡 Connecting to database...', 'blue');
    await connectDB();
    log('✅ Database connected\n', 'green');

    // Step 1: Check for cafes
    log('📋 Step 1: Checking cafes...', 'yellow');
    const cafes = await Cafe.find({ isActive: true })
      .select('_id name location cafeId')
      .limit(5)
      .lean();
    
    if (cafes.length === 0) {
      log('❌ No active cafes found', 'red');
      return;
    }
    log(`✅ Found ${cafes.length} active cafe(s)`, 'green');
    cafes.forEach(r => {
      const hasLocation = r.location?.coordinates && r.location.coordinates.length === 2;
      log(`   - ${r.name} (ID: ${r._id}) - Location: ${hasLocation ? '✅' : '❌'}`, hasLocation ? 'green' : 'red');
    });

    // Step 2: Check for delivery partners
    log('\n📋 Step 2: Checking delivery partners...', 'yellow');
    const deliveryPartners = await Delivery.find({
      'availability.isOnline': true,
      status: { $in: ['approved', 'active'] },
      isActive: true
    })
      .select('_id name phone availability.isOnline availability.currentLocation status isActive')
      .limit(10)
      .lean();

    if (deliveryPartners.length === 0) {
      log('❌ No online delivery partners found', 'red');
      log('💡 Checking all delivery partners...', 'yellow');
      const allPartners = await Delivery.find({})
        .select('_id name availability.isOnline status isActive availability.currentLocation')
        .limit(10)
        .lean();
      
      log(`📊 Total delivery partners: ${allPartners.length}`, 'blue');
      allPartners.forEach(partner => {
        const hasLocation = partner.availability?.currentLocation?.coordinates && 
                           partner.availability.currentLocation.coordinates.length === 2;
        log(`   - ${partner.name} (ID: ${partner._id})`, 'blue');
        log(`     Online: ${partner.availability?.isOnline ? '✅' : '❌'} | Status: ${partner.status} | Active: ${partner.isActive ? '✅' : '❌'} | Location: ${hasLocation ? '✅' : '❌'}`, 
            partner.availability?.isOnline && partner.isActive && hasLocation ? 'green' : 'red');
      });
      return;
    }
    log(`✅ Found ${deliveryPartners.length} online delivery partner(s)`, 'green');
    deliveryPartners.forEach(dp => {
      const hasLocation = dp.availability?.currentLocation?.coordinates && 
                         dp.availability.currentLocation.coordinates.length === 2;
      const [lng, lat] = dp.availability?.currentLocation?.coordinates || [0, 0];
      log(`   - ${dp.name} (ID: ${dp._id}) - Phone: ${dp.phone} - Location: ${hasLocation ? `✅ (${lat}, ${lng})` : '❌'}`, 
          hasLocation ? 'green' : 'red');
    });

    // Step 3: Check for preparing orders without delivery partner
    log('\n📋 Step 3: Checking orders needing assignment...', 'yellow');
    const unassignedOrders = await Order.find({
      status: 'preparing',
      deliveryPartnerId: { $exists: false }
    })
      .populate('cafeId', 'name location')
      .populate('userId', 'name phone')
      .limit(5)
      .lean();

    if (unassignedOrders.length === 0) {
      log('ℹ️ No unassigned preparing orders found', 'blue');
      log('💡 Creating a test order scenario...', 'yellow');
      
      // Use first cafe
      const testCafe = cafes[0];
      if (!testCafe.location?.coordinates) {
        log('❌ Test cafe has no location', 'red');
        return;
      }

      log(`📝 Simulating order assignment for cafe: ${testCafe.name}`, 'blue');
      const [cafeLng, cafeLat] = testCafe.location.coordinates;
      log(`📍 Cafe location: ${cafeLat}, ${cafeLng}`, 'blue');

      // Test assignment
      const testOrder = {
        orderId: 'TEST-' + Date.now(),
        _id: new mongoose.Types.ObjectId(),
        cafeId: testCafe._id.toString(),
        status: 'preparing'
      };

      log('\n🔄 Testing delivery assignment...', 'yellow');
      const assignmentResult = await assignOrderToDeliveryBoy(
        testOrder,
        cafeLat,
        cafeLng
      );

      if (assignmentResult && assignmentResult.deliveryPartnerId) {
        log(`✅ Assignment successful!`, 'green');
        log(`   Delivery Partner ID: ${assignmentResult.deliveryPartnerId}`, 'green');
        log(`   Name: ${assignmentResult.deliveryPartnerName}`, 'green');
        log(`   Distance: ${assignmentResult.distance.toFixed(2)} km`, 'green');
      } else {
        log('❌ Assignment failed - no delivery partner found', 'red');
      }
    } else {
      log(`✅ Found ${unassignedOrders.length} unassigned order(s)`, 'green');
      for (const order of unassignedOrders) {
        log(`\n📦 Order: ${order.orderId}`, 'cyan');
        log(`   Cafe: ${order.cafeId?.name || 'N/A'}`, 'blue');
        log(`   Customer: ${order.userId?.name || 'N/A'}`, 'blue');
        
        const cafe = order.cafeId;
        if (!cafe?.location?.coordinates) {
          log('   ❌ Cafe has no location', 'red');
          continue;
        }

        const [cafeLng, cafeLat] = cafe.location.coordinates;
        log(`   📍 Cafe location: ${cafeLat}, ${cafeLng}`, 'blue');

        // Test assignment
        log('   🔄 Testing assignment...', 'yellow');
        const assignmentResult = await assignOrderToDeliveryBoy(
          order,
          cafeLat,
          cafeLng
        );

        if (assignmentResult && assignmentResult.deliveryPartnerId) {
          log(`   ✅ Assignment successful!`, 'green');
          log(`      Delivery Partner: ${assignmentResult.deliveryPartnerName}`, 'green');
          log(`      Distance: ${assignmentResult.distance.toFixed(2)} km`, 'green');
        } else {
          log('   ❌ Assignment failed', 'red');
        }
      }
    }

    // Step 4: Check Socket.IO setup (skip if server not running)
    log('\n📋 Step 4: Checking Socket.IO setup...', 'yellow');
    log('ℹ️ Socket.IO check requires server to be running', 'blue');
    log('💡 To check socket connections, ensure backend server is running on port 5000', 'yellow');
    log('💡 Then delivery partners can connect via socket and receive notifications', 'yellow');

    // Step 5: Test notification
    log('\n📋 Step 5: Testing notification...', 'yellow');
    if (deliveryPartners.length > 0 && unassignedOrders.length > 0) {
      const testOrder = unassignedOrders[0];
      const testDeliveryPartner = deliveryPartners[0];
      
      log(`📦 Testing notification for order: ${testOrder.orderId}`, 'blue');
      log(`🚴 To delivery partner: ${testDeliveryPartner.name} (${testDeliveryPartner._id})`, 'blue');
      
      try {
        await notifyDeliveryBoyNewOrder(testOrder, testDeliveryPartner._id.toString());
        log('✅ Notification sent successfully', 'green');
      } catch (error) {
        log(`❌ Notification failed: ${error.message}`, 'red');
        console.error(error);
      }
    } else {
      log('ℹ️ Skipping notification test - need both order and delivery partner', 'blue');
    }

    // Summary
    log('\n📊 Test Summary:', 'cyan');
    log(`   Cafes: ${cafes.length}`, 'blue');
    log(`   Online Delivery Partners: ${deliveryPartners.length}`, deliveryPartners.length > 0 ? 'green' : 'red');
    log(`   Unassigned Orders: ${unassignedOrders.length}`, 'blue');
    
    if (deliveryPartners.length === 0) {
      log('\n⚠️ ISSUE FOUND: No online delivery partners!', 'yellow');
      log('💡 Solutions:', 'yellow');
      log('   1. Make sure delivery partners have set isOnline = true', 'yellow');
      log('   2. Check delivery partner status is "approved" or "active"', 'yellow');
      log('   3. Ensure delivery partners have valid location data', 'yellow');
      log('   4. Delivery partners need to open the app and go online', 'yellow');
    }

    if (cafes.length === 0) {
      log('\n⚠️ ISSUE FOUND: No active cafes!', 'yellow');
    }

    log('\n✅ Test completed!\n', 'green');

  } catch (error) {
    log(`\n❌ Test failed with error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log('📡 Database connection closed', 'blue');
    }
    process.exit(0);
  }
}

// Run the test
testDeliveryAssignment();

