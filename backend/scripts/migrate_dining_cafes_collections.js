import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const CORRECT_COLLECTION = "diningcafes";
const KNOWN_TYPO_NAMES = new Set([
  "dinningcafes",
  "diningcafe",
  "dining-cafes",
  "diningcaves",
  "diningcafé",
  "diningcafe ",
  "dining_cafes",
  "diningcafes ",
  "diningcafeS",
  "DiningCafe",
  "DiningCafes",
]);

const isTypoCollection = (name) => {
  const lower = name.toLowerCase();
  if (lower === CORRECT_COLLECTION) return false;
  if (KNOWN_TYPO_NAMES.has(name) || KNOWN_TYPO_NAMES.has(lower)) return true;
  if (lower.includes("dining") && lower.includes("cafe") && lower !== CORRECT_COLLECTION) {
    return true;
  }
  return false;
};

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in environment.");
    process.exit(1);
  }

  const dryRun = String(process.env.DRY_RUN || "1") !== "0";
  const dropWrong = String(process.env.DROP_WRONG || "0") === "1";

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);

    const typoCollections = names.filter(isTypoCollection);
    const hasCorrect = names.includes(CORRECT_COLLECTION);

    console.log("Detected collections:", names);
    console.log("Correct collection:", CORRECT_COLLECTION, hasCorrect ? "(exists)" : "(missing)");
    console.log("Possible typo collections:", typoCollections.length ? typoCollections : "(none)");

    if (dryRun) {
      console.log("DRY_RUN=1: No data will be migrated. Set DRY_RUN=0 to migrate.");
      process.exit(0);
    }

    const target = db.collection(CORRECT_COLLECTION);

    for (const wrongName of typoCollections) {
      const source = db.collection(wrongName);
      const docs = await source.find({}).toArray();
      if (docs.length === 0) {
        console.log(`No docs in "${wrongName}". Skipping.`);
        continue;
      }

      const ops = docs.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      }));

      const result = await target.bulkWrite(ops, { ordered: false });
      console.log(
        `Migrated from "${wrongName}" -> "${CORRECT_COLLECTION}": upserted=${result.upsertedCount}, matched=${result.matchedCount}`,
      );

      if (dropWrong) {
        await db.dropCollection(wrongName);
        console.log(`Dropped typo collection "${wrongName}".`);
      }
    }

    console.log("Migration completed.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error?.message || error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
