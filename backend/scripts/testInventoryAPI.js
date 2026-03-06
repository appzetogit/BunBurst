import axios from 'axios';

const testInventoryAPI = async () => {
    try {
        const cafeId = 'REST-1771312074475-1182';
        const url = `http://localhost:5001/api/cafe/${cafeId}/inventory`;

        console.log(`\n🧪 Testing inventory API endpoint:`);
        console.log(`   URL: ${url}\n`);

        const response = await axios.get(url);

        console.log('✅ Response Status:', response.status);
        console.log('📋 Response Data:', JSON.stringify(response.data, null, 2));

        if (response.data.data?.inventory?.categories?.length > 0) {
            console.log('\n✅ SUCCESS: Inventory has categories!');
            console.log(`   Total categories: ${response.data.data.inventory.categories.length}`);

            response.data.data.inventory.categories.forEach((cat, idx) => {
                console.log(`   ${idx + 1}. ${cat.name} - ${cat.itemCount} items`);
            });
        } else {
            console.log('\n⚠️  WARNING: Inventory categories array is still empty');
        }

    } catch (error) {
        console.error('❌ Error testing API:', error.message);
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
        }
    }
};

testInventoryAPI();
