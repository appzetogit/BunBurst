import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

import Restaurant from "../modules/restaurant/models/Restaurant.js";

async function updateRestaurantLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const restaurants = await Restaurant.find({});
    console.log(`Found ${restaurants.length} restaurants to update.`);

    let updatedCount = 0;
    for (const restaurant of restaurants) {
      // Ensure location object exists
      if (!restaurant.location) {
        restaurant.location = {};
      }

      // Set type to Point
      restaurant.location.type = "Point";

      // If coordinates don't exist but lat/lng do, create coordinates
      if (!restaurant.location.coordinates || restaurant.location.coordinates.length === 0) {
        if (restaurant.location.latitude && restaurant.location.longitude) {
          restaurant.location.coordinates = [
            restaurant.location.longitude,
            restaurant.location.latitude,
          ];
        } else {
          // Default to zero if nothing exists (should be handled by admin later)
          restaurant.location.coordinates = [0, 0];
        }
      }

      // Also update onboarding location if it exists
      if (restaurant.onboarding?.step1?.location) {
        restaurant.onboarding.step1.location.type = "Point";
        if (!restaurant.onboarding.step1.location.coordinates || restaurant.onboarding.step1.location.coordinates.length === 0) {
          if (restaurant.onboarding.step1.location.latitude && restaurant.onboarding.step1.location.longitude) {
            restaurant.onboarding.step1.location.coordinates = [
              restaurant.onboarding.step1.location.longitude,
              restaurant.onboarding.step1.location.latitude,
            ];
          } else {
            restaurant.onboarding.step1.location.coordinates = [0, 0];
          }
        }
      }

      // Mark as modified and save
      restaurant.markModified("location");
      if (restaurant.onboarding?.step1) {
        restaurant.markModified("onboarding.step1.location");
      }

      await restaurant.save();
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} restaurants.`);
    process.exit(0);
  } catch (error) {
    console.error("Error updating restaurant locations:", error);
    process.exit(1);
  }
}

updateRestaurantLocations();
