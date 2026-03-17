import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react"
import { orderAPI } from "@/lib/api"

const OrdersContext = createContext(null)

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("userOrders")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [isHydrating, setIsHydrating] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem("userOrders", JSON.stringify(orders))
    } catch {
      // ignore storage errors
    }
  }, [orders])

  const normalizeOrderId = (order) => order?.id || order?._id || order?.orderId

  const mergeOrders = useCallback((incoming = []) => {
    setOrders((prev) => {
      const map = new Map()
      for (const o of prev || []) {
        const key = normalizeOrderId(o)
        if (key) map.set(String(key), o)
      }
      for (const o of incoming || []) {
        const key = normalizeOrderId(o)
        if (!key) continue
        const existing = map.get(String(key))
        map.set(String(key), existing ? { ...existing, ...o } : o)
      }
      return Array.from(map.values()).sort((a, b) => {
        const ad = new Date(a.createdAt || a.created_at || 0).getTime()
        const bd = new Date(b.createdAt || b.created_at || 0).getTime()
        return bd - ad
      })
    })
  }, [])

  const refetchOrders = useCallback(async (params = { limit: 50, page: 1 }) => {
    const userToken =
      localStorage.getItem("user_accessToken") ||
      localStorage.getItem("accessToken")
    if (!userToken) return

    setIsHydrating(true)
    try {
      const response = await orderAPI.getOrders(params)
      const apiOrders =
        response?.data?.data?.orders ||
        response?.data?.orders ||
        (Array.isArray(response?.data?.data) ? response.data.data : []) ||
        []
      mergeOrders(apiOrders)
    } catch {
      // Do not break UI if API is unavailable; local cache remains as fallback.
    } finally {
      setIsHydrating(false)
    }
  }, [mergeOrders])

  // Initial sync + keep in sync on app focus/visibility.
  useEffect(() => {
    refetchOrders()

    const onFocus = () => refetchOrders()
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetchOrders()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refetchOrders])

  const createOrder = (orderData) => {
    // Backward compatible: keep a local placeholder (optimistic UI),
    // but never treat it as the source of truth for status.
    const newOrder = {
      id: `LOCAL-${Date.now()}`,
      ...orderData,
      status: orderData?.status || "pending",
      createdAt: orderData?.createdAt || new Date().toISOString(),
    }
    setOrders((prev) => [newOrder, ...(prev || [])])
    return newOrder.id
  }

  const getOrderById = (orderId) => {
    return orders.find(order => normalizeOrderId(order) === orderId)
  }

  const getAllOrders = () => {
    return (orders || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  const updateOrderStatus = (orderId, status) => {
    // Legacy helper. Prefer `refetchOrders()` after any status-changing action.
    setOrders((prev) =>
      (prev || []).map((order) => {
        if (normalizeOrderId(order) === orderId) {
          return { ...order, status }
        }
        return order
      }),
    )
  }

  const value = useMemo(() => ({
    orders,
    isHydrating,
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    refetchOrders,
  }), [orders, isHydrating, mergeOrders, refetchOrders])

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}

