# Delivery Order Flow Test Script

यह script delivery boy के order acceptance से लेकर order delivery तक का complete flow test करता है।

## Prerequisites

1. MongoDB connection string
2. Delivery boy का JWT token
3. Test order ID (optional - script automatically find करेगा)

## Setup

### 1. Environment Variables

`.env` file में ये variables add करें:

```env
MONGODB_URI=mongodb://localhost:27017/appzetofood
BASE_URL=http://localhost:5000
DELIVERY_TOKEN=your_delivery_boy_jwt_token_here
ORDER_ID=optional_order_id (agar specific order test karna ho)
```

### 2. Delivery Token कैसे मिलेगा?

1. Delivery boy app में login करें
2. Browser console में check करें या
3. Backend logs में check करें जब delivery boy login करता है

या manually token generate करें:
```javascript
// Backend में run करें
const jwtService = require('./modules/auth/services/jwtService');
const token = jwtService.generateAccessToken({
  userId: 'delivery_boy_id',
  email: 'delivery@example.com',
  role: 'delivery'
});
console.log(token);
```

## Usage

### Basic Usage (Automatic Order Selection)

```bash
cd appzetofood/backend
node scripts/test-delivery-order-flow.js
```

### With Specific Order ID

```bash
ORDER_ID=697dc73b8c5a341cf1577605 node scripts/test-delivery-order-flow.js
```

### With Custom Base URL

```bash
BASE_URL=http://localhost:5000 DELIVERY_TOKEN=your_token node scripts/test-delivery-order-flow.js
```

## Test Flow

Script ये steps follow करता है:

1. **Setup** - MongoDB connect करता है और test order find करता है
2. **Accept Order** - Delivery boy order accept करता है
3. **Reached Pickup** - Cafe पर पहुंचने की confirmation
4. **Confirm Order ID** - Order ID confirm करना
5. **Reached Drop** - Customer location पर पहुंचने की confirmation
6. **Complete Delivery** - Order delivery complete करना

## Expected Output

```
🚀 Starting Delivery Order Flow Test
Base URL: http://localhost:5000
Order ID: 697dc73b8c5a341cf1577605

============================================================
STEP 0: Setting up test environment
============================================================
ℹ️  Connecting to MongoDB: mongodb://localhost:27017/appzetofood
✅ Connected to MongoDB
✅ Setup completed

============================================================
STEP 1: Accept Order
============================================================
✅ Order accepted successfully
...

============================================================
SUMMARY: Test Results
============================================================
Accept Order: ✅ PASS
Reached Pickup: ✅ PASS
Confirm Order ID: ✅ PASS
Reached Drop: ✅ PASS
Complete Delivery: ✅ PASS

📊 Results: 5/5 tests passed
```

## Troubleshooting

### Error: "No suitable order found"
- Solution: एक order create करें जो 'preparing' या 'ready' status में हो और delivery partner assigned हो

### Error: "DELIVERY_TOKEN is required"
- Solution: `.env` file में `DELIVERY_TOKEN` set करें

### Error: "Failed to connect to MongoDB"
- Solution: MongoDB server check करें और `MONGODB_URI` verify करें

### Error: "Order not found"
- Solution: `ORDER_ID` verify करें या script को automatically order find करने दें

### Error: 500 Internal Server Error
- Solution: Backend logs check करें - detailed error messages मिलेंगी

## Manual Testing

अगर script fail हो जाए, तो manually ये endpoints test करें:

1. **Accept Order**
   ```bash
   curl -X PATCH http://localhost:5000/api/delivery/orders/{orderId}/accept \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"currentLat": 22.7196, "currentLng": 75.8577}'
   ```

2. **Reached Pickup**
   ```bash
   curl -X PATCH http://localhost:5000/api/delivery/orders/{orderId}/reached-pickup \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"currentLat": 22.7196, "currentLng": 75.8577}'
   ```

3. **Confirm Order ID**
   ```bash
   curl -X PATCH http://localhost:5000/api/delivery/orders/{orderId}/confirm-order-id \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"orderId": "ORD-123", "currentLat": 22.7196, "currentLng": 75.8577}'
   ```

4. **Reached Drop**
   ```bash
   curl -X PATCH http://localhost:5000/api/delivery/orders/{orderId}/reached-drop \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"currentLat": 22.7196, "currentLng": 75.8577}'
   ```

5. **Complete Delivery**
   ```bash
   curl -X PATCH http://localhost:5000/api/delivery/orders/{orderId}/complete \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "currentLat": 22.7196,
       "currentLng": 75.8577,
       "paymentMethod": "cash",
       "paymentReceived": true,
       "customerRating": 5
     }'
   ```

## Notes

- Script automatically order find करता है अगर `ORDER_ID` provide नहीं किया गया
- हर step के बीच 1 second wait होता है
- अगर कोई step fail हो जाए, तो script continue करता है (except accept order)
- Final summary में सभी test results दिखते हैं

## Support

अगर कोई issue हो, तो:
1. Backend logs check करें
2. Error messages को carefully read करें
3. MongoDB connection verify करें
4. Delivery token validity check करें
