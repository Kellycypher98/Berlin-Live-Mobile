# Berlin Live (iOS & Android)

The native app for Berlin Live Transit, built with Expo (SDK 58) and MapLibre. It talks to the same
server as the web app, so deploy that first (see `deploy/` in the web repo).

Everything from the web app is here: the live map with every vehicle, stations and departures,
search for any address or station, journeys with Earlier/Later and refresh, live tracking that
follows your vehicle, stations near you, German/English, the first-use tour, and notifications
while the app is closed.

## 1. Point it at your server

In `app.json`, set `expo.extra.apiUrl` to your server, e.g. `"https://3-121-45-67.sslip.io"`
(your Lightsail address). For a one-off you can also use an environment variable:

```bash
EXPO_PUBLIC_API_URL=https://3-121-45-67.sslip.io npx expo start
```

Push notifications need the server version with Expo support (`lib/push.js`): run `./update.sh` on
the server after pulling.

## 2. Install

```bash
npm install
```

## 3. Run it on your phone (development build)

MapLibre and notifications are native code, so the app runs as a **development build**, not in Expo Go.

**With EAS (no Xcode needed):**

```bash
npm install -g eas-cli
eas login
eas init                                   # creates the project and writes its id into app.json (needed for notifications)
eas build --profile development --platform ios       # or android
```

Install the build on your phone from the link EAS gives you, then:

```bash
npx expo start
```

and open the app; it connects to the dev server on your Mac (same Wi-Fi).

**On your Mac directly:** `npx expo run:ios` (needs Xcode) or `npx expo run:android` (needs Android Studio).
iPhone notifications only work on a real device, not the simulator.

## 4. Release

```bash
eas build --profile production --platform all
eas submit --platform ios      # App Store Connect
eas submit --platform android  # Google Play
```

iOS needs an Apple Developer account. For notifications, EAS sets up the push key the first time
you build (say yes when it asks). The app uses the "time-sensitive" notification level so the
"get off now" alert breaks through Focus modes.

## Layout

```
src/app/           screens (Expo Router): _layout.tsx, index.tsx (the map screen)
src/components/    TransitMap (MapLibre layers), panels/ (search, journeys, station, tracking,
                   nearby, settings, vehicle), overlays/ (loading screen, tour), icons, ui
src/hooks/         live vehicles (WebSocket), stations, lines, tracking, location
src/lib/           API client, modes and line colours, search, nearby, push, theme
src/i18n/          English in the code, German in de.ts (shared with the web app)
assets/map/        vehicle badges and heading arrow used on the map
```

## Checks

```bash
npm run typecheck
```

## Credits

Map tiles: OpenFreeMap (© OpenMapTiles, data © OpenStreetMap contributors). Transit data: VBB (CC BY 4.0).
