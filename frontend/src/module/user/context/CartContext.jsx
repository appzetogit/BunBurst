// src/context/cart-context.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

// Default cart context value to prevent errors during initial render
const defaultCartContext = {
  _isProvider: false, // Flag to identify if this is from the actual provider
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => {
    console.warn('CartProvider not available - addToCart called');
  },
  removeFromCart: () => {
    console.warn('CartProvider not available - removeFromCart called');
  },
  updateQuantity: () => {
    console.warn('CartProvider not available - updateQuantity called');
  },
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {
    console.warn('CartProvider not available - clearCart called');
  },
  cleanCartForCafe: () => {
    console.warn('CartProvider not available - cleanCartForCafe called');
  },
}

const CartContext = createContext(defaultCartContext)

const isUserAuthenticated = () => {
  if (typeof window === "undefined") return false
  const hasUserToken = !!localStorage.getItem("user_accessToken")
  const hasUserAuthFlag = localStorage.getItem("user_authenticated") === "true"
  const hasLegacyToken = !!localStorage.getItem("accessToken")
  return hasUserToken || hasUserAuthFlag || hasLegacyToken
}

export function CartProvider({ children }) {
  // Safe init (works with SSR and bad JSON)
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("cart")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Track last add event for animation
  const [lastAddEvent, setLastAddEvent] = useState(null)
  // Track last remove event for animation
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null)
  const wasAuthenticatedRef = useRef(isUserAuthenticated())

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart))
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [cart])

  // Clear cart on logout so next login always starts with an empty cart.
  useEffect(() => {
    const handleAuthChange = () => {
      const isAuthenticatedNow = isUserAuthenticated()
      const wasAuthenticated = wasAuthenticatedRef.current
      const hasStoredCart = !!localStorage.getItem("cart")

      if (!isAuthenticatedNow && (wasAuthenticated || hasStoredCart)) {
        setCart([])
        try {
          localStorage.removeItem("cart")
        } catch {
          // ignore storage errors
        }
      }

      wasAuthenticatedRef.current = isAuthenticatedNow
    }

    window.addEventListener("userAuthChanged", handleAuthChange)
    handleAuthChange()

    return () => {
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  const addToCart = (item, sourcePosition = null) => {
    // Prevent adding out of stock items
    const isItemOutOfStockInfo = (item) => {
      if (!item) return false
      if (item.isAvailable === false) return true
      const stockValue = typeof item.stock === "string" ? item.stock.trim().toLowerCase() : item.stock
      return stockValue === 0 || stockValue === "0" || stockValue === "out of stock"
    }

    if (isItemOutOfStockInfo(item)) {
      toast.error("Sorry, this item is out of stock and cannot be added.");
      return;
    }

    setCart((prev) => {
      // CRITICAL: Validate cafe consistency
      // If cart already has items, ensure new item belongs to the same cafe
      if (prev.length > 0) {
        const firstItemCafeId = prev[0]?.cafeId;
        const firstItemCafeName = prev[0]?.cafe;
        const newItemCafeId = item?.cafeId;
        const newItemCafeName = item?.cafe;

        // Normalize cafe names for comparison (trim and case-insensitive)
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstCafeNameNormalized = normalizeName(firstItemCafeName);
        const newCafeNameNormalized = normalizeName(newItemCafeName);

        // Check cafe name first (more reliable than IDs which can have different formats)
        // If names match, allow it even if IDs differ (same cafe, different ID format)
        if (firstCafeNameNormalized && newCafeNameNormalized) {
          if (firstCafeNameNormalized !== newCafeNameNormalized) {
            console.error('❌ Cannot add item: Cafe name mismatch!', {
              cartCafeId: firstItemCafeId,
              cartCafeName: firstItemCafeName,
              newItemCafeId: newItemCafeId,
              newItemCafeName: newItemCafeName
            });
            throw new Error(`Cart already contains items from "${firstItemCafeName}". Please clear cart or complete order first.`);
          }
          // Names match - allow it (even if IDs differ, it's the same cafe)
        } else if (firstItemCafeId && newItemCafeId) {
          // If names are not available, fallback to ID comparison
          if (firstItemCafeId !== newItemCafeId) {
            console.error('❌ Cannot add item: Cart contains items from different cafe!', {
              cartCafeId: firstItemCafeId,
              cartCafeName: firstItemCafeName,
              newItemCafeId: newItemCafeId,
              newItemCafeName: newItemCafeName
            });
            throw new Error(`Cart already contains items from "${firstItemCafeName || 'another cafe'}". Please clear cart or complete order first.`);
          }
        }
      }

      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        // Set last add event for animation when incrementing existing item
        if (sourcePosition) {
          setLastAddEvent({
            product: {
              id: item.id,
              name: item.name,
              imageUrl: item.image || item.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes (increased delay)
          setTimeout(() => setLastAddEvent(null), 1500)
        }
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }

      // Validate item has required cafe info
      if (!item.cafeId && !item.cafe) {
        console.error('❌ Cannot add item: Missing cafe information!', item);
        throw new Error('Item is missing cafe information. Please refresh the page.');
      }

      const newItem = { ...item, quantity: 1 }

      // Set last add event for animation if sourcePosition is provided
      if (sourcePosition) {
        setLastAddEvent({
          product: {
            id: item.id,
            name: item.name,
            imageUrl: item.image || item.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes (increased delay to allow full animation)
        setTimeout(() => setLastAddEvent(null), 1500)
      }

      return [...prev, newItem]
    })
  }

  const removeFromCart = (itemId, sourcePosition = null, productInfo = null) => {
    setCart((prev) => {
      const itemToRemove = prev.find((i) => i.id === itemId)
      if (itemToRemove && sourcePosition && productInfo) {
        // Set last remove event for animation
        setLastRemoveEvent({
          product: {
            id: productInfo.id || itemToRemove.id,
            name: productInfo.name || itemToRemove.name,
            imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return prev.filter((i) => i.id !== itemId)
    })
  }

  const updateQuantity = (itemId, quantity, sourcePosition = null, productInfo = null) => {
    if (quantity <= 0) {
      setCart((prev) => {
        const itemToRemove = prev.find((i) => i.id === itemId)
        if (itemToRemove && sourcePosition && productInfo) {
          // Set last remove event for animation
          setLastRemoveEvent({
            product: {
              id: productInfo.id || itemToRemove.id,
              name: productInfo.name || itemToRemove.name,
              imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes
          setTimeout(() => setLastRemoveEvent(null), 1500)
        }
        return prev.filter((i) => i.id !== itemId)
      })
      return
    }

    // When quantity decreases (but not to 0), also trigger removal animation
    setCart((prev) => {
      const existingItem = prev.find((i) => i.id === itemId)
      
      if (existingItem && quantity > existingItem.quantity) {
        const isItemOutOfStockInfo = (item) => {
          if (!item) return false
          if (item.isAvailable === false) return true
          const stockValue = typeof item.stock === "string" ? item.stock.trim().toLowerCase() : item.stock
          return stockValue === 0 || stockValue === "0" || stockValue === "out of stock"
        }
        if (isItemOutOfStockInfo(existingItem)) {
          toast.error("Sorry, this item is out of stock.");
          return prev; // Do not update quantity
        }
      }

      if (existingItem && quantity < existingItem.quantity && sourcePosition && productInfo) {
        // Set last remove event for animation when decreasing quantity
        setLastRemoveEvent({
          product: {
            id: productInfo.id || existingItem.id,
            name: productInfo.name || existingItem.name,
            imageUrl: productInfo.imageUrl || productInfo.image || existingItem.image || existingItem.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
    })
  }

  const updateCartItem = (itemId, updates) => {
    setCart((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)))
  }

  const getCartCount = () =>
    cart.reduce((total, item) => total + (item.quantity || 0), 0)

  const isInCart = (itemId) => cart.some((i) => i.id === itemId)

  const getCartItem = (itemId) => cart.find((i) => i.id === itemId)

  const clearCart = () => setCart([])

  // Clean cart to remove items from different cafes
  // Keeps only items from the specified cafe
  const cleanCartForCafe = (cafeId, cafeName) => {
    setCart((prev) => {
      if (prev.length === 0) return prev;

      // Normalize cafe name for comparison
      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const targetCafeNameNormalized = normalizeName(cafeName);

      // Filter cart to keep only items from the target cafe
      const cleanedCart = prev.filter((item) => {
        const itemCafeId = item?.cafeId;
        const itemCafeName = item?.cafe;
        const itemCafeNameNormalized = normalizeName(itemCafeName);

        // Check by cafe name first (more reliable)
        if (targetCafeNameNormalized && itemCafeNameNormalized) {
          return itemCafeNameNormalized === targetCafeNameNormalized;
        }
        // Fallback to ID comparison
        if (cafeId && itemCafeId) {
          return itemCafeId === cafeId ||
            itemCafeId === cafeId.toString() ||
            itemCafeId.toString() === cafeId;
        }
        // If no match, remove item
        return false;
      });

      if (cleanedCart.length !== prev.length) {
        console.warn('🧹 Cleaned cart: Removed items from different cafes', {
          before: prev.length,
          after: cleanedCart.length,
          removed: prev.length - cleanedCart.length
        });
      }

      return cleanedCart;
    });
  }

  // Validate and clean cart on mount/load to prevent multiple cafe items
  // This runs only once on initial load to clean up any corrupted cart data from localStorage
  useEffect(() => {
    if (cart.length === 0) return;

    // Get unique cafe IDs and names
    const cafeIds = cart.map(item => item.cafeId).filter(Boolean);
    const cafeNames = cart.map(item => item.cafe).filter(Boolean);
    const uniqueCafeIds = [...new Set(cafeIds)];
    const uniqueCafeNames = [...new Set(cafeNames)];

    // Normalize cafe names for comparison
    const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
    const uniqueCafeNamesNormalized = uniqueCafeNames.map(normalizeName);
    const uniqueCafeNamesSet = new Set(uniqueCafeNamesNormalized);

    // Check if cart has items from multiple cafes
    if (uniqueCafeIds.length > 1 || uniqueCafeNamesSet.size > 1) {
      console.warn('⚠️ Cart contains items from multiple cafes. Cleaning cart...', {
        cafeIds: uniqueCafeIds,
        cafeNames: uniqueCafeNames
      });

      // Keep items from the first cafe (most recent or first in cart)
      const firstCafeId = uniqueCafeIds[0];
      const firstCafeName = uniqueCafeNames[0];

      setCart((prev) => {
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstCafeNameNormalized = normalizeName(firstCafeName);

        return prev.filter((item) => {
          const itemCafeId = item?.cafeId;
          const itemCafeName = item?.cafe;
          const itemCafeNameNormalized = normalizeName(itemCafeName);

          // Check by cafe name first
          if (firstCafeNameNormalized && itemCafeNameNormalized) {
            return itemCafeNameNormalized === firstCafeNameNormalized;
          }
          // Fallback to ID comparison
          if (firstCafeId && itemCafeId) {
            return itemCafeId === firstCafeId ||
              itemCafeId === firstCafeId.toString() ||
              itemCafeId.toString() === firstCafeId;
          }
          return false;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to clean up localStorage data

  // Transform cart to match AddToCartAnimation expected structure
  const cartForAnimation = useMemo(() => {
    const items = cart.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        imageUrl: item.image || item.imageUrl,
      },
      quantity: item.quantity || 1,
    }))

    const itemCount = cart.reduce((total, item) => total + (item.quantity || 0), 0)
    const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)

    return {
      items,
      itemCount,
      total,
    }
  }, [cart])

  const value = useMemo(
    () => ({
      _isProvider: true, // Flag to identify this is from the actual provider
      // Keep original cart array for backward compatibility
      cart,
      // Add animation-compatible structure
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      updateCartItem,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForCafe,
    }),
    [cart, cartForAnimation, lastAddEvent, lastRemoveEvent]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  // Check if context is from the actual provider by checking the _isProvider flag
  if (!context || context._isProvider !== true) {
    // In development, log a warning but don't throw to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ useCart called outside CartProvider. Using default values.');
      console.warn('💡 Make sure the component is rendered inside UserLayout which provides CartProvider.');
    }
    // Return default context instead of throwing
    return defaultCartContext
  }
  return context
}                                                                                        
