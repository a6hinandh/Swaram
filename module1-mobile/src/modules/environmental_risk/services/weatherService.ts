import { WeatherData } from '../types';

let Location: any = null;
try {
  Location = require('expo-location');
} catch (e) {
  // Graceful fallback
}

export interface LocationCoordinate {
  id: string;
  name: string;
  nameMl: string;
  district: string;
  latitude: number;
  longitude: number;
}

export const KOTHAMANGALAM_LOCATION: LocationCoordinate = {
  id: 'kothamangalam',
  name: 'Kothamangalam',
  nameMl: 'കോതമംഗലം',
  district: 'Ernakulam',
  latitude: 10.0601,
  longitude: 76.6284
};

export const KERALA_LOCATIONS: LocationCoordinate[] = [
  KOTHAMANGALAM_LOCATION,
  {
    id: 'aluva',
    name: 'Aluva (Ward 4)',
    nameMl: 'ആലുവ (വാർഡ് 4)',
    district: 'Ernakulam',
    latitude: 10.1076,
    longitude: 76.3516
  },
  {
    id: 'palakkad',
    name: 'Palakkad (Chittur)',
    nameMl: 'പാലക്കാട് (ചിറ്റൂർ)',
    district: 'Palakkad',
    latitude: 10.7042,
    longitude: 76.7144
  },
  {
    id: 'kuttanad',
    name: 'Kuttanad (Flood Prone)',
    nameMl: 'കുട്ടനാട് (വെള്ളപ്പൊക്ക സാധ്യത)',
    district: 'Alappuzha',
    latitude: 9.4217,
    longitude: 76.4523
  },
  {
    id: 'wayanad',
    name: 'Wayanad (Mananthavady)',
    nameMl: 'വയനാട് (മാനന്തവാടി)',
    district: 'Wayanad',
    latitude: 11.8028,
    longitude: 76.0044
  },
  {
    id: 'kochi_city',
    name: 'Kochi (Industrial Zone)',
    nameMl: 'കൊച്ചി (ഇൻഡസ്ട്രിയൽ ഏരിയ)',
    district: 'Ernakulam',
    latitude: 9.9312,
    longitude: 76.2673
  },
  {
    id: 'tvm',
    name: 'Thiruvananthapuram',
    nameMl: 'തിരുവനന്തപുരം',
    district: 'Thiruvananthapuram',
    latitude: 8.5241,
    longitude: 76.9366
  }
];

// Helper to categorize US AQI index
export const getAqiCategory = (aqi: number): WeatherData['aqiCategory'] => {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  return 'hazardous';
};

// Weather code translation
export const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear Sky';
  if (code === 1 || code === 2 || code === 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Foggy / Mist';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 80 && code <= 82) return 'Heavy Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
};

/**
 * Fetch live weather and air quality for a given Kerala location
 * Uses Open-Meteo free API (no API key required) with safe offline fallback
 */
export const fetchLocationWeather = async (
  location: LocationCoordinate = KERALA_LOCATIONS[0]
): Promise<WeatherData> => {
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&current=us_aqi,pm2_5,pm10`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl, { signal: AbortSignal.timeout(4000) }),
      fetch(aqiUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null)
    ]);

    if (!weatherRes.ok) {
      throw new Error(`Weather HTTP ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    let aqiVal = 55;
    if (aqiRes && aqiRes.ok) {
      const aqiData = await aqiRes.json();
      aqiVal = Math.round(aqiData.current?.us_aqi || 55);
    }

    const current = weatherData.current || {};
    const temp = Math.round((current.temperature_2m ?? 33) * 10) / 10;
    const apparent = Math.round((current.apparent_temperature ?? temp + 3) * 10) / 10;
    const humidity = Math.round(current.relative_humidity_2m ?? 75);
    const rain = Math.round((current.precipitation ?? 0) * 10) / 10;
    const wCode = current.weather_code ?? 2;

    return {
      locationName: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      temperatureCelsius: temp,
      apparentTemperatureCelsius: apparent,
      humidityPercent: humidity,
      precipitationMm: rain,
      weatherCode: wCode,
      weatherCondition: getWeatherCondition(wCode),
      aqiUs: aqiVal,
      aqiCategory: getAqiCategory(aqiVal),
      isLiveFetched: true,
      fetchedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    console.log('[WeatherService] Live fetch offline fallback:', err);
    // Offline simulated preset
    return getOfflinePresetWeather(location);
  }
};

/**
 * Offline simulation presets for offline field demonstrations
 */
export const getOfflinePresetWeather = (
  location: LocationCoordinate = KERALA_LOCATIONS[0],
  scenarioOverride?: 'heatwave' | 'heavy_rain' | 'poor_aqi' | 'normal'
): WeatherData => {
  if (scenarioOverride === 'heatwave' || location.id === 'palakkad') {
    return {
      locationName: `${location.name} (Heatwave Alert)`,
      latitude: location.latitude,
      longitude: location.longitude,
      temperatureCelsius: 38.5,
      apparentTemperatureCelsius: 43.2,
      humidityPercent: 68,
      precipitationMm: 0,
      weatherCode: 0,
      weatherCondition: 'Extreme Heat / Scorching',
      aqiUs: 85,
      aqiCategory: 'moderate',
      isLiveFetched: false,
      fetchedAt: 'Just now (Simulated)'
    };
  }

  if (scenarioOverride === 'heavy_rain' || location.id === 'kuttanad') {
    return {
      locationName: `${location.name} (Monsoon Alert)`,
      latitude: location.latitude,
      longitude: location.longitude,
      temperatureCelsius: 26.4,
      apparentTemperatureCelsius: 29.1,
      humidityPercent: 92,
      precipitationMm: 38.5,
      weatherCode: 82,
      weatherCondition: 'Heavy Monsoon Rain / Flood Warning',
      aqiUs: 28,
      aqiCategory: 'good',
      isLiveFetched: false,
      fetchedAt: 'Just now (Simulated)'
    };
  }

  if (scenarioOverride === 'poor_aqi' || location.id === 'kochi_city') {
    return {
      locationName: `${location.name} (High AQI)`,
      latitude: location.latitude,
      longitude: location.longitude,
      temperatureCelsius: 31.0,
      apparentTemperatureCelsius: 36.2,
      humidityPercent: 78,
      precipitationMm: 0,
      weatherCode: 45,
      weatherCondition: 'Dense Smog / Haze',
      aqiUs: 165,
      aqiCategory: 'unhealthy',
      isLiveFetched: false,
      fetchedAt: 'Just now (Simulated)'
    };
  }

  // Default Aluva ambient
  return {
    locationName: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    temperatureCelsius: 33.5,
    apparentTemperatureCelsius: 38.2,
    humidityPercent: 76,
    precipitationMm: 2.0,
    weatherCode: 2,
    weatherCondition: 'Warm & Humid',
    aqiUs: 64,
    aqiCategory: 'moderate',
    isLiveFetched: false,
    fetchedAt: 'Just now (Cached)'
  };
};

/**
 * Check if device location services are enabled and if permission is granted
 */
export const checkLocationStatus = async (): Promise<{
  available: boolean;
  servicesEnabled: boolean;
  permissionGranted: boolean;
}> => {
  if (!Location) {
    return { available: false, servicesEnabled: false, permissionGranted: false };
  }
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const perm = await Location.getForegroundPermissionsAsync();
    return {
      available: true,
      servicesEnabled: !!servicesEnabled,
      permissionGranted: perm?.status === 'granted'
    };
  } catch (e) {
    return { available: false, servicesEnabled: false, permissionGranted: false };
  }
};

/**
 * Automatically fetch weather using the device's real GPS coordinates.
 * Falls back to Kothamangalam if GPS is disabled or permission denied.
 */
export const fetchCurrentDeviceLocationWeather = async (
  fallbackLocation: LocationCoordinate = KOTHAMANGALAM_LOCATION
): Promise<{ weather: WeatherData; location: LocationCoordinate; isGps: boolean; errorReason?: 'services_off' | 'permission_denied' | 'fetch_failed' }> => {
  try {
    if (!Location) {
      const weather = await fetchLocationWeather(fallbackLocation);
      return { weather, location: fallbackLocation, isGps: false, errorReason: 'fetch_failed' };
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      console.log('[WeatherService] Device location services are OFF.');
      const weather = await fetchLocationWeather(fallbackLocation);
      return { weather, location: fallbackLocation, isGps: false, errorReason: 'services_off' };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[WeatherService] Permission to access location was denied.');
      const weather = await fetchLocationWeather(fallbackLocation);
      return { weather, location: fallbackLocation, isGps: false, errorReason: 'permission_denied' };
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    const lat = loc.coords.latitude;
    const lon = loc.coords.longitude;

    let locName = 'Current Location';
    let districtName = 'Kerala';
    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (reverse && reverse.length > 0) {
        const place = reverse[0];
        const primary = place.name || place.street || place.subregion || place.city;
        const district = place.district || place.city || place.subregion;
        const region = place.region || 'Kerala';
        
        const parts = [primary, district !== primary ? district : null, region].filter(Boolean);
        locName = parts.join(', ');
        districtName = district || region || 'Kerala';
      }
    } catch {
      // keep default
    }

    const deviceLocation: LocationCoordinate = {
      id: 'gps_device',
      name: locName,
      nameMl: locName,
      district: districtName,
      latitude: lat,
      longitude: lon
    };

    const weather = await fetchLocationWeather(deviceLocation);
    return { weather, location: deviceLocation, isGps: true };
  } catch (err: any) {
    console.log('[WeatherService] Device GPS failed, falling back to Kothamangalam:', err?.message || err);
    const weather = await fetchLocationWeather(fallbackLocation);
    return { weather, location: fallbackLocation, isGps: false, errorReason: 'fetch_failed' };
  }
};
