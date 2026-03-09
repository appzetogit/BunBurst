// Utility for managing cafe data across pages
import { cafesDummy } from "../data/cafesDummy"

const STORAGE_KEY = "appzeto_cafes"

// Get cafes from localStorage or use dummy data
export const getCafes = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
    // Initialize with dummy data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cafesDummy))
    return cafesDummy
  } catch (error) {
    console.error("Error loading cafes:", error)
    return cafesDummy
  }
}

// Save cafes to localStorage
export const saveCafes = (cafes) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cafes))
    return true
  } catch (error) {
    console.error("Error saving cafes:", error)
    return false
  }
}

// Add a new cafe
export const addCafe = (cafeData) => {
  const cafes = getCafes()
  const newCafe = {
    id: cafes.length > 0 ? Math.max(...cafes.map(r => r.id)) + 1 : 1,
    name: cafeData.cafeName,
    ownerName: `${cafeData.firstName} ${cafeData.lastName}`,
    ownerPhone: `${cafeData.phoneCode} ${cafeData.phone}`,
    zone: cafeData.zone,
    cuisine: cafeData.cuisine,
    status: true,
    rating: 0,
    logo: cafeData.logo ? URL.createObjectURL(cafeData.logo) : null,
    ...cafeData
  }
  const updatedCafes = [...cafes, newCafe]
  saveCafes(updatedCafes)
  return newCafe
}

// Update a cafe
export const updateCafe = (id, updates) => {
  const cafes = getCafes()
  const updatedCafes = cafes.map(r => 
    r.id === id ? { ...r, ...updates } : r
  )
  saveCafes(updatedCafes)
  return updatedCafes.find(r => r.id === id)
}

// Delete a cafe
export const deleteCafe = (id) => {
  const cafes = getCafes()
  const updatedCafes = cafes.filter(r => r.id !== id)
  saveCafes(updatedCafes)
  return true
}

