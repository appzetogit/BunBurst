/**
 * Quick script to check what indexes Mongoose is trying to create
 * Run: node scripts/check-indexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Import models to trigger schema registration
import '../modules/auth/models/User.js';
import '../modules/cafe/models/Cafe.js';
import '../modules/cafe/models/CafeCategory.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function checkIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.model('User');
    const Cafe = mongoose.model('Cafe');
    const CafeCategory = mongoose.model('CafeCategory');

    console.log('📋 User Schema Indexes:');
    console.log(JSON.stringify(User.schema.indexes(), null, 2));
    
    console.log('\n📋 Cafe Schema Indexes:');
    console.log(JSON.stringify(Cafe.schema.indexes(), null, 2));
    
    console.log('\n📋 CafeCategory Schema Indexes:');
    console.log(JSON.stringify(CafeCategory.schema.indexes(), null, 2));

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkIndexes();

