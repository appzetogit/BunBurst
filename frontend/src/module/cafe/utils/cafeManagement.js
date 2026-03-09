/**
 * Cafe Management Utility Functions
 * Centralized management for cafe details across the cafe module
 */

// Default cafe data
const DEFAULT_CAFE_DATA = {
  cafeName: {
    english: "Hungry Puppets",
    bengali: "",
    arabic: "",
    spanish: ""
  },
  phoneNumber: "+101747410000",
  address: "House: 00, Road: 00, Test City",
  logo: null,
  cover: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=400&fit=crop",
  metaTitle: "Hungry Puppets Cafe: Where Fla",
  metaDescription: "Satisfy your cravings and indulge in a culinary adventure at Hungry Puppets Cafe. Our menu is a symphony of taste, offering a delightful fusion of flavors that excite both palate and",
  metaImage: null,
  rating: 4.7,
  totalRatings: 3
}

const CAFE_STORAGE_KEY = 'cafe_data'

/**
 * Get cafe data from localStorage
 * @returns {Object} - Cafe data object
 */
export const getCafeData = () => {
  try {
    const saved = localStorage.getItem(CAFE_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
    // Initialize with default data
    setCafeData(DEFAULT_CAFE_DATA)
    return DEFAULT_CAFE_DATA
  } catch (error) {
    console.error('Error reading cafe data from localStorage:', error)
    return DEFAULT_CAFE_DATA
  }
}

/**
 * Save cafe data to localStorage
 * @param {Object} cafeData - Cafe data object
 */
export const setCafeData = (cafeData) => {
  try {
    localStorage.setItem(CAFE_STORAGE_KEY, JSON.stringify(cafeData))
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('cafeDataUpdated'))
    // Trigger storage event for cross-tab updates
    window.dispatchEvent(new Event('storage'))
  } catch (error) {
    console.error('Error saving cafe data to localStorage:', error)
  }
}

/**
 * Update cafe data (merge with existing)
 * @param {Object} updates - Partial cafe data to update
 * @returns {Object} - Updated cafe data
 */
export const updateCafeData = (updates) => {
  const currentData = getCafeData()
  const updatedData = {
    ...currentData,
    ...updates,
    // Merge cafeName object if it exists
    cafeName: updates.cafeName 
      ? { ...currentData.cafeName, ...updates.cafeName }
      : currentData.cafeName
  }
  setCafeData(updatedData)
  return updatedData
}

