import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the directory exists
const billsDir = path.join(__dirname, '../../../uploads/bills');
if (!fs.existsSync(billsDir)) {
    fs.mkdirSync(billsDir, { recursive: true });
}

/**
 * Generate a digital bill for an order
 * @param {Object} order - The order object
 * @returns {string} - The URL of the generated bill
 */
export const generateBill = async (order) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const filename = `bill_${order.orderId}_${Date.now()}.pdf`;
            const filePath = path.join(billsDir, filename);
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            // --- Header ---
            doc
                .fontSize(20)
                .text('Bun Burst', { align: 'center' })
                .fontSize(12)
                .text('Digital Bill', { align: 'center' })
                .moveDown();

            // --- Order Details ---
            doc.fontSize(10);
            doc.text(`Order ID: ${order.orderId}`);
            doc.text(`Date & Time: ${new Date(order.createdAt).toLocaleString()}`);
            doc.text(`Customer Name: ${order.customerName || (order.userId && order.userId.name) || 'Customer'}`);
            doc.text(`Restaurant: ${order.restaurantName}`);
            doc.moveDown();

            // --- Table Header ---
            const tableTop = 200;
            doc.text('Item', 50, tableTop);
            doc.text('Qty', 300, tableTop);
            doc.text('Amount', 350, tableTop, { align: 'right' });
            doc.moveTo(50, tableTop + 15).lineTo(400, tableTop + 15).stroke();

            // --- Items ---
            let y = tableTop + 25;

            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    doc.text(item.name, 50, y);
                    doc.text(item.quantity.toString(), 300, y);
                    doc.text(`${(item.price * item.quantity).toFixed(2)}`, 350, y, { align: 'right' });

                    y += 15;

                    // Addons
                    if (item.addons && item.addons.length > 0) {
                        item.addons.forEach(addon => {
                            doc
                                .fontSize(8)
                                .text(`+ ${addon.name}`, 60, y)
                                .text(`${addon.price.toFixed(2)}`, 350, y, { align: 'right' });
                            y += 12;
                        });
                        doc.fontSize(10);
                        y += 5; // Extra spacing after addons
                    }
                });
            }

            doc.moveDown();
            doc.moveTo(50, y).lineTo(400, y).stroke();
            y += 15;

            // --- Pricing ---
            const pricing = order.pricing || {};

            const addPriceRow = (label, amount, isBold = false) => {
                if (isBold) doc.font('Helvetica-Bold');
                doc.text(label, 250, y);
                doc.text(`${Number(amount || 0).toFixed(2)}`, 350, y, { align: 'right' });
                if (isBold) doc.font('Helvetica');
                y += 15;
            };

            addPriceRow('Subtotal:', pricing.subtotal);

            if (pricing.discount > 0) {
                addPriceRow('Discount:', -pricing.discount);
            }

            addPriceRow('Delivery Fee:', pricing.deliveryFee);
            addPriceRow('Platform Fee:', pricing.platformFee);
            addPriceRow('Tax (GST):', pricing.tax);

            doc.moveTo(250, y).lineTo(400, y).stroke();
            y += 5;

            addPriceRow('Grand Total:', pricing.total, true);

            // --- Footer ---
            doc.moveDown(2);
            doc.fontSize(10).text('Thank you for ordering with Bun Burst!', { align: 'center' });

            doc.end();

            stream.on('finish', () => {
                // Return relative path for URL access (assuming express serves 'uploads' statically)
                // If not served statically, we might need a dedicated route to configure
                const relativeUrl = `/uploads/bills/${filename}`;
                resolve(relativeUrl);
            });

            stream.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
};
