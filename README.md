# 🃏 Hide & Seek Cards — Mobile

> A strategic mobile card game for iOS and Android, built under the [Thoughtless Labs](https://github.com/thoughtlesslabs) brand.

Converted from the original [Next.js web app](https://github.com/thoughtlesslabs/hide-and-seek-cards) to a full React Native/Expo mobile experience. Players hide and seek cards using strategy, bluffing, and emoji reactions — now with native haptics, animations, and offline AI opponents.

---

## 📱 Current Status

| Sprint | Description | Status |
|--------|-------------|--------|
| 1–5 | Full web-to-native conversion | ✅ Complete |
| 6 | Asset Pipeline & Polish | 🚧 In Planning |
| 7 | Onboarding & User Retention | 🚧 In Planning |
| 8 | Store Compliance & Metadata | 🚧 In Planning |
| 9 | Testing & Bug Bash | 🚧 In Planning |

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **React Native 0.83** | Core mobile framework |
| **Expo SDK 55** (managed workflow) | Build tooling & native APIs |
| **Expo Router** | File-based navigation |
| **NativeWind** (Tailwind CSS) | Styling |
| **Zustand** | Lightweight state management |
| **React Native Reanimated** | Smooth card animations |
| **expo-haptics** | Native haptic feedback |
| **expo-av** | Audio playback |
| **@react-native-async-storage/async-storage** | Persistent local storage |
| **TypeScript** | Type safety throughout |

---

## 🗺 Roadmap

### Sprint 6 — Asset Pipeline & Polish
- App icons and adaptive icons (iOS/Android)
- Splash screens
- Card animations polish
- Haptics integration

### Sprint 7 — Onboarding & User Retention
- First-time user experience (FTUE) flow
- Daily rewards system
- Push notifications
- Tutorial / rules walkthrough

### Sprint 8 — Store Compliance & Metadata
- Privacy policy
- App Store (iOS) metadata and screenshots
- Google Play Store listing
- Age rating compliance

### Sprint 9 — Testing & Bug Bash
- Cross-device QA (iPhone SE → Pro Max, Android small/large)
- Performance profiling
- Final crash testing
- Store submission

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ ([nvm recommended](https://github.com/nvm-sh/nvm))
- **Expo CLI** — installed automatically via npx, or globally:
  ```bash
  npm install -g expo-cli
  ```
- **Expo Go** app on your physical device ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- For iOS simulator: **Xcode** with iOS Simulator
- For Android emulator: **Android Studio** with a virtual device

### Installation

```bash
# Clone the repository
git clone git@github.com:thoughtlesslabs/hide-and-seek-cards-native.git
cd hide-and-seek-cards-native

# Install dependencies
npm install
```

### Running the App

```bash
# Start the Expo dev server
npx expo start

# Open directly on a platform
npm run ios       # iOS Simulator
npm run android   # Android Emulator
npm run web       # Web browser (dev only)
```

After running `npx expo start`, scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS) to load the app on your device.

---

## 📁 Project Structure

```
hide-and-seek-cards-native/
├── app/                    # Expo Router pages (file-based routing)
│   ├── _layout.tsx         # Root layout / navigation shell
│   ├── index.tsx           # Home / landing screen
│   ├── offline/            # Offline game mode routes
│   ├── game/               # Live game screens
│   ├── find-match/         # Matchmaking flow
│   └── private/            # Private lobby screens
├── components/             # Reusable UI components
│   ├── card-component.tsx  # Core card rendering
│   ├── offline-game.tsx    # Offline game logic component
│   ├── matchmaking-screen.tsx
│   ├── screens/            # Full-screen view components
│   ├── game/               # In-game UI components
│   └── ui/                 # Generic UI primitives
├── store/                  # Zustand state stores
│   ├── gameStore.ts        # Active game state
│   ├── sessionStore.ts     # User session & auth
│   └── settingsStore.ts    # App settings
├── lib/                    # Utilities & services
│   ├── api.ts              # API client
│   ├── gemini-service.ts   # AI opponent integration
│   ├── multiplayer-service.ts
│   ├── redis.ts            # Real-time state sync
│   ├── username-generator.ts
│   └── utils.ts
├── assets/                 # Static assets (images, fonts)
├── docs/                   # Internal planning docs & sprint notes
├── app.json                # Expo configuration
├── eas.json                # EAS Build configuration
├── tailwind.config.ts      # NativeWind/Tailwind config
└── tsconfig.json           # TypeScript config
```

---

## 🔗 Related

- [Hide & Seek Cards (Web)](https://github.com/thoughtlesslabs/hide-and-seek-cards) — the original Next.js web app

---

## 🏢 Contributing

This is an **internal Thoughtless Labs project**. External contributions are not accepted at this time. If you're a Thoughtless Labs team member, please follow the internal development workflow and branch conventions documented in `docs/`.

---

## 📄 License

Private — All rights reserved © [Thoughtless Labs](https://github.com/thoughtlesslabs)
