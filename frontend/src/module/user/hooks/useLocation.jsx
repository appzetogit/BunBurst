import { useLocationContext } from "../context/LocationContext"

/**
 * Hook to access the global location state.
 * Refactored to use LocationContext so state is shared across all components.
 */
export function useLocation() {
  const context = useLocationContext()

  // Return the context values to maintain compatibility with existing usages
  return {
    location: context.location,
    loading: context.loading,
    error: context.error,
    permissionGranted: context.permissionGranted,
    requestLocation: context.getLocation,
    // Add other context methods if needed by components
    setManualLocation: context.setManualLocation,
    updateLocationInDB: context.updateLocationInDB
  }
}
