const fs = require('fs');
const path = 'c:/Users/HP/Desktop/company/BunBurst/frontend/src/module/user/pages/orders/OrderTracking.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '        setOrder(contextOrder)\n        setLoading(false)\n        return\n      }',
  `        setOrder(contextOrder)

        if (contextOrder.status === 'cancelled') setOrderStatus('cancelled');
        else if (contextOrder.status === 'preparing') setOrderStatus('preparing');
        else if (contextOrder.status === 'ready') setOrderStatus('pickup');
        else if (contextOrder.status === 'out_for_delivery') setOrderStatus('on_way');
        else if (contextOrder.status === 'delivered') setOrderStatus('delivered');

        setLoading(false)
        // do not return so SWR background fetch runs
      }`
);

content = content.replace(
  '        setOrder(contextOrder)\r\n        setLoading(false)\r\n        return\r\n      }',
  `        setOrder(contextOrder)\r
\r
        if (contextOrder.status === 'cancelled') setOrderStatus('cancelled');\r
        else if (contextOrder.status === 'preparing') setOrderStatus('preparing');\r
        else if (contextOrder.status === 'ready') setOrderStatus('pickup');\r
        else if (contextOrder.status === 'out_for_delivery') setOrderStatus('on_way');\r
        else if (contextOrder.status === 'delivered') setOrderStatus('delivered');\r
\r
        setLoading(false)\r
        // do not return so SWR background fetch runs\r
      }`
);

content = content.replace(
  '      // If not in context, fetch from API\r\n      try {\r\n        setLoading(true)',
  '      // If not in context, fetch from API\r\n      try {\r\n        if (!contextOrder) setLoading(true)'
);

content = content.replace(
  '      // If not in context, fetch from API\n      try {\n        setLoading(true)',
  '      // If not in context, fetch from API\n      try {\n        if (!contextOrder) setLoading(true)'
);

content = content.replace(
`    pickup: {
      title: "Order picked up",
      subtitle: \`Arriving in \${estimatedTime} mins\`,
      color: "bg-[#e53935]"
    },
    delivered: {`,
`    pickup: {
      title: "Order picked up",
      subtitle: \`Arriving in \${estimatedTime} mins\`,
      color: "bg-[#e53935]"
    },
    on_way: {
      title: "Order on the way",
      subtitle: \`Arriving in \${estimatedTime} mins\`,
      color: "bg-[#e53935]"
    },
    delivered: {`
);

content = content.replace(
`    pickup: {\r
      title: "Order picked up",\r
      subtitle: \`Arriving in \${estimatedTime} mins\`,\r
      color: "bg-[#e53935]"\r
    },\r
    delivered: {`,
`    pickup: {\r
      title: "Order picked up",\r
      subtitle: \`Arriving in \${estimatedTime} mins\`,\r
      color: "bg-[#e53935]"\r
    },\r
    on_way: {\r
      title: "Order on the way",\r
      subtitle: \`Arriving in \${estimatedTime} mins\`,\r
      color: "bg-[#e53935]"\r
    },\r
    delivered: {`
);

fs.writeFileSync(path, content);
console.log("Replaced successfully!");
