
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Restaurant from '../modules/restaurant/models/Restaurant.js';

// Setup environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
}

const fixSohamLocation = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Searching for restaurant "Soham"...');
        // Case-insensitive search using regex
        const restaurant = await Restaurant.findOne({
            name: { $regex: new RegExp('^soham$', 'i') }
        });

        if (!restaurant) {
            console.error('❌ Restaurant "Soham" not found!');
            process.exit(1);
        }

        console.log(`✅ Found restaurant: ${restaurant.name} (${restaurant._id})`);

        // Check current location
        console.log('Current Location:', restaurant.location);

        // Set location to Indore center (approx)
        // Lat: 22.719568, Lng: 75.857727
        const newLocation = {
            latitude: 22.719568,
            longitude: 75.857727,
            coordinates: [75.857727, 22.719568], // [lng, lat] GeoJSON format
            formattedAddress: 'Indore, Madhya Pradesh, India',
            address: 'Indore, Madhya Pradesh, India',
            city: 'Indore',
            state: 'Madhya Pradesh',
            country: 'India'
        };

        console.log('🛠️ Updating location to:', newLocation);

        restaurant.location = newLocation;

        // Also update root level fields just in case (though schema defines location object)
        // restaurant.latitude = newLocation.latitude;
        // restaurant.longitude = newLocation.longitude;

        await restaurant.save();

        console.log('✅ Restaurant location updated successfully!');

        // verify update
        const updatedRestaurant = await Restaurant.findById(restaurant._id);
        console.log('New Location in DB:', updatedRestaurant.location);

    } catch (error) {
        console.error('❌ Error updating restaurant location:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

fixSohamLocation();
