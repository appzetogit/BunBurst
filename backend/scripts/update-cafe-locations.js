import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

import Cafe from "../modules/cafe/models/Cafe.js";

async function updateCafeLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const cafes = await Cafe.find({});
    console.log(`Found ${cafes.length} cafes to update.`);

    let updatedCount = 0;
    for (const cafe of cafes) {
      // Ensure location object exists
      if (!cafe.location) {
        cafe.location = {};
      }

      // Set type to Point
      cafe.location.type = "Point";

      // If coordinates don't exist but lat/lng do, create coordinates
      if (!cafe.location.coordinates || cafe.location.coordinates.length === 0) {
        if (cafe.location.latitude && cafe.location.longitude) {
          cafe.location.coordinates = [
            cafe.location.longitude,
            cafe.location.latitude,
          ];
        } else {
          // Default to zero if nothing exists (should be handled by admin later)
          cafe.location.coordinates = [0, 0];
        }
      }

      // Also update onboarding location if it exists
      if (cafe.onboarding?.step1?.location) {
        cafe.onboarding.step1.location.type = "Point";
        if (!cafe.onboarding.step1.location.coordinates || cafe.onboarding.step1.location.coordinates.length === 0) {
          if (cafe.onboarding.step1.location.latitude && cafe.onboarding.step1.location.longitude) {
            cafe.onboarding.step1.location.coordinates = [
              cafe.onboarding.step1.location.longitude,
              cafe.onboarding.step1.location.latitude,
            ];
          } else {
            cafe.onboarding.step1.location.coordinates = [0, 0];
          }
        }
      }

      // Mark as modified and save
      cafe.markModified("location");
      if (cafe.onboarding?.step1) {
        cafe.markModified("onboarding.step1.location");
      }

      await cafe.save();
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} cafes.`);
    process.exit(0);
  } catch (error) {
    console.error("Error updating cafe locations:", error);
    process.exit(1);
  }
}

updateCafeLocations();
