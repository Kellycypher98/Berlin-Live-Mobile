import Constants from "expo-constants";

/**
 * The Berlin Live Transit server (the same one the web app uses).
 * Set it in app.json → expo.extra.apiUrl, or for development with EXPO_PUBLIC_API_URL,
 * e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start (your Mac's address on Wi-Fi).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string) || "").replace(/\/+$/, "");
export const LIVE_URL = API_URL.replace(/^http/, "ws") + "/live";

// Vector map styles from OpenFreeMap (free, no key; © OpenMapTiles, data © OpenStreetMap)
export const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
export const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

export const BERLIN_CENTER: [number, number] = [13.3777, 52.5163]; // lng, lat
