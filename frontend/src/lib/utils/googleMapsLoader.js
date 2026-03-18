import { Loader } from "@googlemaps/js-api-loader";
import { getGoogleMapsApiKey } from "./googleMapsApiKey";

let loaderPromise = null;
let loadedLibraries = new Set();

async function ensureLibrariesLoaded(libraries = []) {
  if (!window.google?.maps || !libraries.length) {
    return;
  }

  if (typeof window.google.maps.importLibrary !== "function") {
    return;
  }

  for (const library of libraries) {
    if (!library || loadedLibraries.has(library)) continue;
    await window.google.maps.importLibrary(library);
    loadedLibraries.add(library);
  }
}

export async function loadGoogleMaps({ libraries = [], version = "weekly" } = {}) {
  const requestedLibraries = Array.from(new Set(libraries.filter(Boolean)));

  if (window.google?.maps) {
    await ensureLibrariesLoaded(requestedLibraries);
    return window.google;
  }

  if (!loaderPromise) {
    loaderPromise = (async () => {
      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        throw new Error("Google Maps API key not found.");
      }

      const loader = new Loader({
        apiKey,
        version,
        libraries: requestedLibraries,
      });

      const google = await loader.load();
      requestedLibraries.forEach((library) => loadedLibraries.add(library));
      return google;
    })();
  }

  const google = await loaderPromise;
  await ensureLibrariesLoaded(requestedLibraries);
  requestedLibraries.forEach((library) => loadedLibraries.add(library));
  return google;
}

export function clearGoogleMapsLoaderCache() {
  loaderPromise = null;
  loadedLibraries = new Set();
}
