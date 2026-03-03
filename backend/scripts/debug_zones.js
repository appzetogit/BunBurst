
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

const checkZones = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const activeZones = await Zone.find({ isActive: true }).lean();
        console.log(`Found ${activeZones.length} active zones.`);

        // Test Point for "Soham" restaurant (Indore)
        const testLat = 22.719568;
        const testLng = 75.857727;

        console.log(`Testing point: Lat ${testLat}, Lng ${testLng}`);

        let restaurantInZone = false;
        let matchedZone = null;

        for (const zone of activeZones) {
            console.log(`Checking Zone: ${zone.name} (${zone._id})`);

            if (!zone.coordinates || zone.coordinates.length < 3) {
                console.log(`  Skipping zone ${zone.name}: Invalid coordinates`);
                continue;
            }

            console.log(`  Zone has ${zone.coordinates.length} coordinates.`);
            // Log all coordinates to verify format
            console.log(`  All coordinates: ${JSON.stringify(zone.coordinates)}`);

            // Ray casting algorithm from orderController.js
            let inside = false;
            for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
                const coordI = zone.coordinates[i];
                const coordJ = zone.coordinates[j];

                // Inspect coordinate structure
                const xi = typeof coordI === 'object' ? (coordI.latitude ?? coordI.lat) : null;
                const yi = typeof coordI === 'object' ? (coordI.longitude ?? coordI.lng) : null;
                const xj = typeof coordJ === 'object' ? (coordJ.latitude ?? coordJ.lat) : null;
                const yj = typeof coordJ === 'object' ? (coordJ.longitude ?? coordJ.lng) : null;

                if (xi === null || yi === null || xj === null || yj === null) {
                    console.log('  Invalid coordinate format found:', coordI);
                    continue;
                }

                const intersect = ((yi > testLng) !== (yj > testLng)) &&
                    (testLat < (xj - xi) * (testLng - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }

            console.log(`  Is inside: ${inside}`);

            if (inside) {
                restaurantInZone = true;
                matchedZone = zone;
                // Don't break here, we want to see all matching zones or failure reasons
            }
        }

        if (restaurantInZone) {
            console.log(`✅ Success! Restaurant is in zone: ${matchedZone.name}`);
        } else {
            console.log('❌ Failure! Restaurant is NOT in any active zone.');
        }

    } catch (error) {
        console.error('❌ Error checking zones:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

checkZones();
