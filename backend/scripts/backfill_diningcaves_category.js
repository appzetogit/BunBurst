import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Cafe from "../modules/cafe/models/Cafe.js";
import DiningCafe from "../modules/dining/models/DiningCafe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);

    const cafes = await Cafe.find({
      "diningSettings.isEnabled": true,
      "diningSettings.diningType": { $exists: true, $ne: "" },
      slug: { $exists: true, $ne: "" },
    })
      .select("slug diningSettings.diningType")
      .lean();

    let updated = 0;
    for (const cafe of cafes) {
      const result = await DiningCafe.findOneAndUpdate(
        { slug: cafe.slug },
        { $set: { category: cafe.diningSettings?.diningType } },
        { new: true },
      );
      if (result) updated += 1;
    }

    console.log(`Backfill completed. Updated ${updated} dining cafes.`);
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error?.message || error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
