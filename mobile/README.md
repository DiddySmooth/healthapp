# HealthApp mobile

Native iOS/Android client (Expo SDK 57, React Native, Expo Router). Shares its
API client, types, and React Query hooks with the web app via
[`@healthapp/shared`](../shared). Signs in with a bearer token from
`POST /api/auth/token` instead of the web session cookie.

## Run on your iPhone (no Mac needed)

1. Install **Expo Go** from the App Store.
2. Start the server and the Metro bundler from the repo root:

   ```bash
   npm run dev
   npm run dev:mobile
   ```

3. Scan the QR code with the iPhone camera. Phone and PC must be on the same
   Wi‑Fi.
4. Sign in with your PC's LAN address, e.g. `192.168.1.20:3420` (find it with
   `ipconfig`). If it can't connect, allow Node.js through Windows Firewall on
   private networks.

Expo Go only covers the modules bundled into it. Once the app needs extra
native modules (background GPS for runs), switch to a development build via
EAS Build (`npx eas-cli@latest build --profile development --platform ios`),
which builds iOS in the cloud.

## Layout

- `src/app/` — routes (Expo Router). `(tabs)/` is the signed-in native tab bar;
  `sign-in.tsx` is shown when there's no token.
- `src/lib/session.ts` — server URL + token in SecureStore, wired into the
  shared API client.
- `src/components/ui.tsx` — primitives on the Night Gym Instrument tokens in
  `src/theme.ts` (mirrors `client/src/index.css`).

Keep a single copy of `react` and `@tanstack/react-query` in the repo. A second
copy breaks hooks and the query context at runtime. The root `overrides` pins
React.
