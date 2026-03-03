import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Import models
import Restaurant from "../modules/restaurant/models/Restaurant.js";
import Menu from "../modules/restaurant/models/Menu.js";

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    }
};

const checkMenuDetails = async () => {
    try {
        const restaurantId = "REST-1771312074475-1182";

        console.log(`\n🔍 Checking detailed menu data for: ${restaurantId}\n`);

        // Find restaurant
        const restaurant = await Restaurant.findOne({ restaurantId });

        if (!restaurant) {
            console.log("❌ Restaurant not found!");
            process.exit(1);
        }

        console.log("✅ Restaurant found:");
        console.log(`   - _id: ${restaurant._id}`);
        console.log(`   - Name: ${restaurant.name}`);

        // Check Menu
        const menu = await Menu.findOne({ restaurant: restaurant._id });

        if (menu) {
            console.log("\n📋 Menu Details:");
            console.log(`   - Menu _id: ${menu._id}`);
            console.log(`   - Sections count: ${menu.sections?.length || 0}`);
            console.log(`   - Is Active: ${menu.isActive}`);

            if (menu.sections && menu.sections.length > 0) {
                menu.sections.forEach((section, idx) => {
                    console.log(`\n   Section ${idx + 1}:`);
                    console.log(`      - ID: ${section.id}`);
                    console.log(`      - Name: ${section.name}`);
                    console.log(`      - Is Enabled: ${section.isEnabled}`);
                    console.log(`      - Items count: ${section.items?.length || 0}`);
                    console.log(`      - Subsections count: ${section.subsections?.length || 0}`);

                    if (section.items && section.items.length > 0) {
                        console.log(`\n      Items:`);
                        section.items.forEach((item, itemIdx) => {
                            console.log(`         ${itemIdx + 1}. ${item.name}`);
                            console.log(`            - ID: ${item.id}`);
                            console.log(`            - Price: ${item.price}`);
                            console.log(`            - Food Type: ${item.foodType}`);
                            console.log(`            - Is Available: ${item.isAvailable}`);
                            console.log(`            - Stock: ${item.stock}`);
                            console.log(`            - Approval Status: ${item.approvalStatus}`);
                        });
                    }
                });
            }
        } else {
            console.log("\n⚠️  No Menu found!");
        }

        console.log("\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error);
        process.exit(1);
    }
};

// Run the script
connectDB().then(() => {
    checkMenuDetails();
});
