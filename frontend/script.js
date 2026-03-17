const fs = require('fs');
let b = fs.readFileSync('c:/Users/HP/Desktop/company/BunBurst/frontend/src/module/delivery/pages/DeliveryHome.jsx', 'utf8');
b = b.replace('Great job! Delivery complete ??', 'Great job! Delivery complete 🎉');
b = b.replace("?{total.toLocaleString('", "₹{total.toLocaleString('");
fs.writeFileSync('c:/Users/HP/Desktop/company/BunBurst/frontend/src/module/delivery/pages/DeliveryHome.jsx', b);
console.log("Done");
