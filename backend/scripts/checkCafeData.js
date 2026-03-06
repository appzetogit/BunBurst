import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Import models
import Cafe from "../modules/cafe/models/Cafe.js";
import Menu from "../modules/cafe/models/Menu.js";
import Inventory from "../modules/cafe/models/Inventory.js";

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

const checkData = async () => {
    try {
        const cafeId = "REST-1771312074475-1182";

        console.log(`\n🔍 Checking data for cafe: ${cafeId}\n`);

        // Find cafe
        const cafe = await Cafe.findOne({ cafeId });

        if (!cafe) {
            console.log("❌ Cafe not found!");
            process.exit(1);
        }

        console.log("✅ Cafe found:");
        console.log(`   - Name: ${cafe.name}`);
        console.log(`   - ID: ${cafe._id}`);
        console.log(`   - Active: ${cafe.isActive}`);

        // Check Menu
        const menu = await Menu.findOne({ cafe: cafe._id });

        if (menu) {
            console.log("\n📋 Menu found:");
            console.log(`   - Sections: ${menu.sections?.length || 0}`);
            console.log(`   - Addons: ${menu.addons?.length || 0}`);
            console.log(`   - Active: ${menu.isActive}`);

            if (menu.sections && menu.sections.length > 0) {
                console.log("\n   Sections:");
                menu.sections.forEach((section, idx) => {
                    console.log(`     ${idx + 1}. ${section.name} (${section.items?.length || 0} items)`);
                });
            }
        } else {
            console.log("\n⚠️  No Menu found for this cafe");
        }

        // Check Inventory
        const inventory = await Inventory.findOne({ cafe: cafe._id });

        if (inventory) {
            console.log("\n📦 Inventory found:");
            console.log(`   - Categories: ${inventory.categories?.length || 0}`);
            console.log(`   - Active: ${inventory.isActive}`);

            if (inventory.categories && inventory.categories.length > 0) {
                console.log("\n   Categories:");
                inventory.categories.forEach((category, idx) => {
                    console.log(`     ${idx + 1}. ${category.name} (${category.items?.length || 0} items)`);
                });
            }
        } else {
            console.log("\n⚠️  No Inventory found for this cafe");
        }

        console.log("\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error checking data:", error.message);
        process.exit(1);
    }
};

// Run the script
connectDB().then(() => {
    checkData();
});
