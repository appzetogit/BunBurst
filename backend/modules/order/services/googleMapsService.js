import axios from 'axios';
import { getGoogleMapsApiKey } from '../../../shared/utils/envService.js';

/**
 * Google Maps Distance Matrix API Service
 * Calculates travel time and distance between two points
 */
class GoogleMapsService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    this.googleDistanceMatrixEnabled = process.env.ENABLE_GOOGLE_DISTANCE_MATRIX === 'true';
    this.cache = new Map();
    this.inFlightRequests = new Map();
    this.cacheTtlMs = 5 * 60 * 1000;
  }

  /**
   * Get API key from database (lazy loading)
   */
  async getApiKey() {
    if (!this.apiKey) {
      this.apiKey = await getGoogleMapsApiKey();
      if (!this.apiKey) {
        console.warn('Google Maps API key not found in database. Please set it in Admin -> System -> Environment Variables');
      }
    }
    return this.apiKey;
  }

  /**
   * Get travel time and distance between two points
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @param {String} mode - 'driving', 'walking', 'bicycling', 'transit'
   * @param {String} trafficModel - 'best_guess', 'pessimistic', 'optimistic'
   * @returns {Promise<Object>} - { distance (km), duration (minutes), trafficLevel }
   */
  async getTravelTime(origin, destination, mode = 'driving', trafficModel = 'best_guess') {
    if (!this.googleDistanceMatrixEnabled) {
      return this.calculateHaversineDistance(origin, destination);
    }

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.warn('Google Maps API key not available, using fallback calculation');
      return this.calculateHaversineDistance(origin, destination);
    }

    const cacheKey = this.buildCacheKey(origin, destination, mode, trafficModel);
    const cached = this.getCachedValue(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const requestPromise = this.fetchTravelTime(origin, destination, mode, trafficModel, apiKey);
    this.inFlightRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      this.setCachedValue(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error calling Google Maps API:', error.message);
      return this.calculateHaversineDistance(origin, destination);
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  async fetchTravelTime(origin, destination, mode, trafficModel, apiKey) {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    const params = {
      origins: originStr,
      destinations: destStr,
      mode,
      key: apiKey,
      units: 'metric',
      departure_time: 'now'
    };

    if (mode === 'driving') {
      params.traffic_model = trafficModel;
    }

    const response = await axios.get(this.baseUrl, { params });

    if (response.data.status !== 'OK') {
      console.error('Google Maps API Error:', response.data.status, response.data.error_message);
      return this.calculateHaversineDistance(origin, destination);
    }

    const element = response.data?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      console.error('Google Maps Element Error:', element?.status || 'UNKNOWN');
      return this.calculateHaversineDistance(origin, destination);
    }

    const distance = element.distance.value / 1000;
    let duration = element.duration.value / 60;

    let trafficLevel = 'low';
    if (element.duration_in_traffic) {
      const trafficDuration = element.duration_in_traffic.value / 60;
      const trafficMultiplier = trafficDuration / duration;

      if (trafficMultiplier >= 1.4) {
        trafficLevel = 'high';
      } else if (trafficMultiplier >= 1.2) {
        trafficLevel = 'medium';
      }

      duration = trafficDuration;
    }

    return {
      distance: parseFloat(distance.toFixed(2)),
      duration: Math.ceil(duration),
      trafficLevel,
      raw: {
        distance: element.distance,
        duration: element.duration,
        durationInTraffic: element.duration_in_traffic
      }
    };
  }

  /**
   * Fallback: Calculate distance using Haversine formula
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @returns {Object} - { distance (km), duration (minutes), trafficLevel }
   */
  calculateHaversineDistance(origin, destination) {
    const R = 6371;
    const dLat = this.toRad(destination.latitude - origin.latitude);
    const dLon = this.toRad(destination.longitude - origin.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(origin.latitude)) * Math.cos(this.toRad(destination.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const duration = Math.ceil((distance / 30) * 60);

    return {
      distance: parseFloat(distance.toFixed(2)),
      duration,
      trafficLevel: 'low'
    };
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  buildCacheKey(origin, destination, mode, trafficModel) {
    const normalize = (value) => Number(value).toFixed(4);
    return [
      normalize(origin.latitude),
      normalize(origin.longitude),
      normalize(destination.latitude),
      normalize(destination.longitude),
      mode,
      trafficModel
    ].join('|');
  }

  getCachedValue(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  setCachedValue(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    const cutoff = Date.now() - this.cacheTtlMs;
    for (const [entryKey, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoff) {
        this.cache.delete(entryKey);
      }
    }
  }

  /**
   * Batch calculate travel times for multiple destinations
   * @param {Object} origin - { latitude, longitude }
   * @param {Array} destinations - [{ latitude, longitude }, ...]
   * @returns {Promise<Array>} - Array of travel time results
   */
  async getBatchTravelTimes(origin, destinations) {
    const promises = destinations.map((dest) => this.getTravelTime(origin, dest));
    return Promise.all(promises);
  }
}

export default new GoogleMapsService();
