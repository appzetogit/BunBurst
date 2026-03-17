import { createContext, useContext, useEffect, useState } from "react"

const CUSTOMER_THEME_KEY = "customer_theme"
const LEGACY_THEME_KEY = "appTheme"

const CustomerThemeContext = createContext({
  theme: "light",
  setTheme: () => { }
})

const normalizeTheme = (value) => (value === "dark" ? "dark" : "light")

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light"

  try {
    const saved = localStorage.getItem(CUSTOMER_THEME_KEY)
    if (saved) {
      return normalizeTheme(saved)
    }

    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    if (legacy) {
      const normalized = normalizeTheme(legacy)
      localStorage.setItem(CUSTOMER_THEME_KEY, normalized)
      localStorage.removeItem(LEGACY_THEME_KEY)
      return normalized
    }
  } catch {
    // Ignore storage errors and fall back to light
  }

  return "light"
}

export function CustomerThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  const setTheme = (nextTheme) => {
    const normalized = normalizeTheme(nextTheme)
    setThemeState(normalized)
    try {
      localStorage.setItem(CUSTOMER_THEME_KEY, normalized)
    } catch {
      // Ignore storage errors and keep UI responsive
    }
  }

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== CUSTOMER_THEME_KEY) return
      setThemeState(normalizeTheme(event.newValue))
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  return (
    <CustomerThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </CustomerThemeContext.Provider>
  )
}

export function useCustomerTheme() {
  return useContext(CustomerThemeContext)
}
