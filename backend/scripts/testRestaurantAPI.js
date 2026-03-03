import axios from 'axios';

const testRestaurantAPI = async () => {
    try {
        const slug = 'soham';
        const url = `http://localhost:5001/api/restaurant/${slug}`;

        console.log(`\n🧪 Testing restaurant API endpoint:`);
        console.log(`   URL: ${url}\n`);

        const response = await axios.get(url);

        console.log('✅ Response Status:', response.status);
        console.log('📋 Response Data:', JSON.stringify(response.data.data, null, 2));

    } catch (error) {
        console.error('❌ Error testing API:', error.message);
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
        }
    }
};

testRestaurantAPI();
