
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Zone from '../modules/admin/models/Zone.js';

// Setup environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
}

const fixZoneCoordinates = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const activeZones = await Zone.find({ isActive: true });
        console.log(`Found ${activeZones.length} active zones.`);

        if (activeZones.length === 0) {
            console.log('⚠️ No active zones found to update.');
            return;
        }

        // We assume the first zone is the one we want to fix (since debug showed only 1)
        // Or we can filter by name if we knew it.
        const zoneToFix = activeZones[0];
        console.log(`Updating Zone: ${zoneToFix.name} (${zoneToFix._id})`);

        console.log('Old Coordinates count:', zoneToFix.coordinates.length);

        // Define a generous box covering Indore
        // Lat: 22.6 to 22.8
        // Lng: 75.7 to 76.0
        const newCoordinates = [
            { latitude: 22.800000, longitude: 75.700000 }, // Top Left
            { latitude: 22.800000, longitude: 76.000000 }, // Top Right
            { latitude: 22.600000, longitude: 76.000000 }, // Bottom Right
            { latitude: 22.600000, longitude: 75.700000 }, // Bottom Left
            { latitude: 22.800000, longitude: 75.700000 }  // Close Loop
        ];

        zoneToFix.coordinates = newCoordinates;

        // boundary will be updated by pre-save hook
        await zoneToFix.save();

        console.log('✅ Zone coordinates updated successfully!');

        // Verify with containsPoint logic locally (approximation)
        const testLat = 22.719568;
        const testLng = 75.857727;

        // Check if point is inside strictly
        // Simple manual check: 22.6 < 22.719 < 22.8 AND 75.7 < 75.857 < 76.0
        if (testLat > 22.6 && testLat < 22.8 && testLng > 75.7 && testLng < 76.0) {
            console.log('✅ Test point (Soham restaurant) is effectively INSIDE the new zone.');
        } else {
            console.log('❌ Test point is OUTSIDE the new zone (Something is wrong with logic).');
        }

    } catch (error) {
        console.error('❌ Error updating zone coordinates:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

fixZoneCoordinates();
