# Hide and Seek Cards — Mobile Conversion Plan

**Repo:** https://github.com/thoughtlesslabs/v0-hide-and-seek-cards  
**Date:** 2026-03-21  
**Analyst:** Research Worker (games project)

---

## Executive Summary

The app is a **single-screen, real-time multiplayer card game** built in Next.js 16 (App Router), React 19, Tailwind CSS v4, and Upstash Redis. The entire game runs on one page (`app/page.tsx`) as a mega-component driven by a `gameMode` state machine. Multiplayer state lives in Redis and clients poll at 500ms. Offline mode is fully self-contained client-side.

**Recommendation: React Native (Expo) is the right path** for a production mobile app. Capacitor is acceptable as a fast-path MVP but should be considered a stepping stone, not the destination. Rationale is below.

---

## 1. Codebase Analysis

### 1.1 File Inventory

| File/Dir | Role |
|---|---|
| `app/page.tsx` | 1000+ line monolith: main game state machine, all game modes rendered inline |
| `app/layout.tsx` | HTML shell, Google Fonts (Cinzel), Vercel Analytics |
| `app/globals.css` | Global styles |
| `app/actions/multiplayer.ts` | Next.js Server Actions (rate-limited) proxying the service layer |
| `app/api/flush-redis/route.ts` | Admin endpoint to flush Redis |
| `components/offline-game.tsx` | Full offline game engine (Fisher-Yates shuffle, bot AI, timer) |
| `components/card-component.tsx` | CSS 3D flip card (perspective + rotateY 180°) |
| `components/player-seat.tsx` | Player avatar, turn timer, emoji picker |
| `components/matchmaking-screen.tsx` | Polling lobby UI with emoji reactions |
| `components/private-lobby-screen.tsx` | Host/join private game with 4-letter code |
| `components/animated-card-preview.tsx` | Menu animation, cycles card flips via intervals |
| `components/live-stats.tsx` | Polls global stats every 10s (players online, games live) |
| `lib/multiplayer-service.ts` | Core game engine: lobby management, game tick, bot AI, Redis persistence |
| `lib/redis.ts` | Upstash Redis client + key schema |
| `lib/gemini-service.ts` | Gemini AI integration (unused in game UI, present in codebase) |
| `lib/username-generator.ts` | Random username generation for players |
| `types/game.ts` | `Player`, `Card`, `GamePhase`, `GameState` |
| `types/multiplayer.ts` | `Lobby`, `LobbyPlayer`, `SharedGameState`, `SharedPlayer`, `SharedCard` |
| `public/` | Images: tarot card back, character portraits, icons |

### 1.2 State Management

There is **no external state library** (no Redux, no Zustand, no Context). All state lives in `useState` hooks inside `page.tsx`:

- `gameMode` — navigation state machine (menu → playerSelection → roundSelection → matchmaking → playing → offline, etc.)
- `sharedGameState` — live server state (polled at 500ms via `pollGameState`)
- `currentLobby` — current lobby metadata
- `turnTimeRemaining`, `gameStartCountdown`, `rematchCountdown` — derived timers from `sharedGameState` timestamps
- `playerReactions` — emoji reactions (expiry-aware)
- `localSelectedTarget` — optimistic local target selection

**Game tick** (`processGameTick`) runs entirely server-side: bot turns, timeouts, animations, phase transitions are all computed on poll response. Clients are dumb viewers that only send: `selectTarget`, `selectCard`, `sendHeartbeat`, `sendEmojiReaction`.

### 1.3 Routing / Navigation

**No Next.js routing is used.** Every "screen" is a conditional `if (gameMode === "x") return <Screen />` inside the root component. This is deliberately a SPA with manual state navigation.

**Game modes / screens:**
1. `menu` — main landing with animated card preview
2. `playerSelection` — choose 4 or 8 players
3. `roundSelection` — single / best-of-3 / best-of-5
4. `matchmaking` — waiting room with emoji reactions
5. `hostOrJoin` — private game entry
6. `hostPlayerSelection` → `hostRoundSelection` — host config screens
7. `joinWithCode` — 4-letter code entry
8. `privateLobby` — private lobby waiting room
9. `playing` — live game board (8-position circular table + card grid)
10. `offline` — OfflineGame component (independent sub-app)

### 1.4 Game Logic

**Core mechanics (server-side, `multiplayer-service.ts`):**
- 4 or 8 players; each gets a secret card
- Turn order: clockwise (CLOCKWISE_ORDER_4 or CLOCKWISE_ORDER_8)
- Each turn: `select_target` → `select_card` → `reveal_result` → (`elimination_animation` or `flipping`) → next turn
- Win condition: last player alive wins a round; series win = `roundsToWin` rounds
- Bot AI: random target + random card after 1.5s delay
- Turn timeout: 8s server-side, 15s client-side display
- Card shuffle after each turn (Fisher-Yates)

**Phase state machine:**
```
waiting → select_target → select_card → reveal_result
  → flipping (miss) → select_target
  → elimination_animation → (round_end | series_end | select_target)
  → round_end → (next round) → select_target
  → series_end → (rematch → select_target) | (new game)
```

### 1.5 Backend / Infrastructure

| Concern | Current Implementation |
|---|---|
| State store | Upstash Redis (REST API via `@upstash/redis`) |
| Game logic host | Next.js Server Actions (serverless functions on Vercel) |
| Real-time | Short-polling at 500ms |
| Auth | None — player ID stored in `localStorage`, UUID-like |
| Lobby discovery | Redis sorted set (`lobbies:waiting`) |
| Private games | Redis key `gamecode:{CODE}` → lobby ID |

### 1.6 Styling & Animations

| Pattern | Details |
|---|---|
| Layout | Tailwind v4, absolute positioning, viewport units (`h-[calc(100vh-16px)]`) |
| Game table | 8 absolute-positioned `<PlayerSeat>` components around screen edges |
| Card flip | CSS 3D: `perspective: 1000px`, `transformStyle: preserve-3d`, `rotateY(180deg)`, `backfaceVisibility: hidden` |
| Ambient glow | `drop-shadow`, `shadow-[]` arbitrary values, `radial-gradient` backgrounds |
| Backdrop blur | `backdrop-blur-xl` on modals/overlays |
| Fonts | Cinzel (Google Fonts serif) as primary game font |
| Animations | Tailwind `animate-pulse`, `animate-spin`, `animate-bounce` + duration-500/700 transitions |
| Avatar images | DiceBear SVG via HTTPS URL (e.g. `https://api.dicebear.com/7.x/avataaars/svg?seed=mystic`) |

---

## 2. React Native vs. Capacitor — Recommendation

### 2.1 Capacitor

**What it does:** Wraps the existing Next.js web app in a native WebView shell. You'd likely SSG or export the app and bundle it, or point at the deployed Vercel URL.

| Pros | Cons |
|---|---|
| Near-zero code rewrite — existing CSS, Tailwind, 3D card flip all work | Not a true native app — WebView UX feels different |
| Ship in days/weeks | App Store policies increasingly restrict WebView-only apps |
| Retains all web animations exactly | Viewport/sizing bugs on iOS safe areas, notches, keyboard |
| One codebase for web + mobile | Performance cap: complex animations may stutter on low-end Android |
| Easy PWA → hybrid bridge | Limited access to deep native APIs (haptics, game center, push notifications) |
| Great for prototyping / validating | Runtime: Chrome WebView (Android) vs. WKWebView (iOS) — divergent quirks |

**When Capacitor makes sense:** You want to be in the App Store within 2 weeks, the current app is visually complete, and you're not planning native features.

### 2.2 React Native (Expo)

**What it does:** Rebuild the UI in React Native components. Backend (Redis, Server Actions) remains unchanged — you just swap the HTTP call mechanism.

| Pros | Cons |
|---|---|
| True native UI — 60/120fps, native touch gestures | 4–8 weeks of upfront migration work |
| Access to full native SDK (haptics, push notifications, GameCenter/Play Games) | CSS Tailwind → NativeWind or StyleSheet (translation effort) |
| Better App Store standing (not WebView) | CSS 3D card flip → must use `react-native-reanimated` (non-trivial) |
| Expo SDK: OTA updates, EAS Build, easy device previews | `localStorage` → `@react-native-async-storage` |
| Better offline support (AsyncStorage, netinfo) | Absolute positioning must be recalculated (no viewport units in the same way) |
| Future-proof: push notifications, widgets, watchOS | Google Fonts → `@expo-google-fonts` |
| NativeWind v4 makes Tailwind class reuse possible | DiceBear avatars still work (just `<Image>` from URL) |
| Expo Router gives clean screen navigation | Server Actions → plain `fetch` to Next.js API routes or a new Express/Hono API |

**When React Native makes sense:** You want a polished, long-lived mobile product with native feel and future native feature hooks.

### 2.3 Recommendation

**Go React Native with Expo.** Here's why for this specific project:

1. **The game already has clean separation of concerns** — the backend is all server-side (Redis + Server Actions). Converting the actions layer to plain `fetch` calls against Next.js API routes (or a small Hono server) is straightforward.

2. **The frontend is a single-screen app** — there's almost no routing complexity. React Native navigation (Expo Router or React Navigation) maps cleanly.

3. **The key animations are achievable** — card flip is non-trivial but well-solved with `react-native-reanimated` + `react-native-card-flip` patterns. The rest are opacity/scale transitions.

4. **The business case** — a family card game is exactly the kind of thing that benefits from native distribution, App Store discovery, push notification re-engagement ("Your game starts in 30s!"), and haptic feedback on card reveals.

5. **NativeWind v4** makes it possible to reuse Tailwind class names, reducing the style translation friction significantly.

**Use Capacitor only if:** timeline is 2 weeks or less, or as an interim while the native app is built.

---

## 3. Estimated Scope and Effort

### 3.1 Phase Breakdown

| Phase | Description | Estimate |
|---|---|---|
| **P0: Foundation** | Expo project scaffold, NativeWind, navigation, API layer, AsyncStorage, theme | 3–4 days |
| **P1: Core Types & State** | Port game types, state management (Zustand recommended), polling hook | 2–3 days |
| **P2: UI Components** | CardComponent (3D flip), PlayerSeat, game table layout | 5–7 days |
| **P3: Screens** | Menu, PlayerSelection, RoundSelection, Matchmaking, Game board | 5–7 days |
| **P4: Offline Mode** | Offline game engine + setup screen | 3–4 days |
| **P5: Private Games** | HostOrJoin, PrivateLobby, JoinWithCode | 2–3 days |
| **P6: Polish** | Animations, sounds, haptics, safe area insets, dark mode | 4–5 days |
| **P7: Backend Adaptation** | Server Actions → API routes, ensure mobile-safe | 2 days |
| **P8: QA & Submission** | TestFlight / Play Store beta, crash monitoring | 3–5 days |
| **Total** | | **29–40 days** (~6–8 sprints) |

### 3.2 Complexity Hotspots

| Component | Complexity | Notes |
|---|---|---|
| `CardComponent` (3D flip) | 🔴 High | Requires `react-native-reanimated` v3, shared values, `withTiming`, `interpolate`, 3D transform matrix |
| Game table (8-player circular layout) | 🔴 High | Absolute positioning based on screen dimensions; must measure screen and place seats mathematically |
| 500ms polling loop | 🟡 Medium | `setInterval` works; must handle `AppState` visibility pausing (same as `document.visibilityState`) |
| Emoji reactions | 🟡 Medium | Straightforward, but `AnimatedToast`-style overlays need RN treatment |
| Tailwind → NativeWind | 🟡 Medium | Most classes translate; `backdrop-blur`, `radial-gradient`, `drop-shadow` need fallbacks |
| Server Actions → fetch | 🟢 Low | Create `lib/api.ts` wrapper that calls `/api/*` endpoints |
| LocalStorage → AsyncStorage | 🟢 Low | Drop-in replacement with `await` |
| AppState visibility detection | 🟢 Low | `AppState.addEventListener('change', ...)` |
| DiceBear avatars | 🟢 Low | `<Image source={{ uri: ... }} />` works |

---

## 4. Proposed React Native Folder Structure

```
hide-and-seek-cards-native/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (theme, fonts, providers)
│   ├── index.tsx                 # Menu screen (replaces menu gameMode)
│   ├── find-match/
│   │   ├── players.tsx           # Player count selection
│   │   └── rounds.tsx            # Round selection + matchmaking entry
│   ├── matchmaking.tsx           # Matchmaking waiting room
│   ├── private/
│   │   ├── index.tsx             # Host or Join
│   │   ├── host-players.tsx      # Host player count selection
│   │   ├── host-rounds.tsx       # Host round selection
│   │   ├── lobby.tsx             # Private lobby waiting room
│   │   └── join.tsx              # Join with 4-letter code
│   ├── game/
│   │   └── index.tsx             # Live game board
│   └── offline/
│       ├── setup.tsx             # Offline player setup
│       └── game.tsx              # Offline game board
│
├── components/
│   ├── game/
│   │   ├── CardComponent.tsx     # 3D flip card (reanimated)
│   │   ├── PlayerSeat.tsx        # Avatar, timer, emoji display
│   │   ├── GameTable.tsx         # 8-position table layout (absolute)
│   │   ├── CardGrid.tsx          # Center card grid (2x2, 2x4, 3+3+2)
│   │   ├── EmojiPicker.tsx       # Emoji selection overlay
│   │   └── TurnTimer.tsx         # Countdown display
│   ├── lobby/
│   │   ├── PlayerSlot.tsx        # Player slot in matchmaking/lobby
│   │   ├── WaitingIndicator.tsx  # Spinner + "finding players"
│   │   └── EmojiBar.tsx          # Emoji reaction strip
│   ├── screens/
│   │   ├── RoundEndScreen.tsx    # Round winner overlay
│   │   ├── SeriesEndScreen.tsx   # Series end + rematch/donate
│   │   ├── GameOverScreen.tsx    # Offline game over
│   │   └── RulesModal.tsx        # Rules bottom sheet
│   ├── ui/
│   │   ├── AnimatedCardPreview.tsx  # Menu preview animation
│   │   ├── LiveStats.tsx            # Online/games counter
│   │   ├── GlowBackground.tsx       # Radial gradient bg approximation
│   │   └── BottomSheet.tsx          # Reusable modal sheet
│   └── shared/
│       ├── Avatar.tsx             # DiceBear image component
│       └── SectionTitle.tsx       # Cinzel serif heading
│
├── store/
│   ├── gameStore.ts              # Zustand: game state, lobby, player
│   ├── settingsStore.ts          # Zustand: player preferences, sound
│   └── sessionStore.ts           # Player ID persistence (AsyncStorage)
│
├── hooks/
│   ├── useGamePolling.ts         # 500ms polling loop (AppState-aware)
│   ├── useHeartbeat.ts           # 5s heartbeat
│   ├── useTurnTimer.ts           # Countdown from turnStartTime
│   ├── useGameStartCountdown.ts  # 3s countdown from gameStartTime
│   ├── useAppStateHandler.ts     # Resume/background handling
│   └── useHaptics.ts             # Haptic feedback hooks
│
├── lib/
│   ├── api.ts                    # All HTTP calls to backend (fetch wrappers)
│   ├── storage.ts                # AsyncStorage helpers
│   ├── constants.ts              # TURN_TIMEOUT_MS, POLL_INTERVAL_MS, etc.
│   └── gameLogic.ts              # Client-side helpers: getVisualPlayer, isCardSelectable
│
├── types/
│   ├── game.ts                   # (copied from web, unchanged)
│   └── multiplayer.ts            # (copied from web, unchanged)
│
├── assets/
│   ├── fonts/                    # Cinzel via @expo-google-fonts/cinzel
│   └── images/                   # ornate-tarot-card-back.png, etc.
│
├── backend/                      # Shared with web OR deployed separately
│   └── (existing Next.js backend stays as-is, exposed via API routes)
│
├── app.json                      # Expo config
├── tailwind.config.ts            # NativeWind config
├── babel.config.js               # Babel with NativeWind + Reanimated
└── tsconfig.json
```

---

## 5. First Implementation Steps & Task Breakdown

### Sprint 1: Foundation (Days 1–4)

**Goal:** Working skeleton with navigation, fonts, and API connectivity.

#### Task 1.1 — Expo Project Scaffold
- `npx create-expo-app hide-and-seek-cards-native --template expo-template-blank-typescript`
- Install dependencies:
  ```bash
  npx expo install expo-router react-native-safe-area-context react-native-screens
  npx expo install nativewind tailwindcss
  npx expo install @expo-google-fonts/cinzel expo-font
  npx expo install @react-native-async-storage/async-storage
  npx expo install react-native-reanimated
  npx expo install zustand
  ```
- Configure `babel.config.js` with `nativewind/babel` and `react-native-reanimated/plugin`
- Configure `tailwind.config.ts` for NativeWind v4

#### Task 1.2 — Theme & Fonts
- Load Cinzel via `useFonts` in `_layout.tsx`
- Create `GlowBackground` component (approximates `radial-gradient` with a `View` + gradient from `expo-linear-gradient`)
- Define color tokens: `amber-700 = #b45309`, `amber-950 = #1c0a00`, etc.

#### Task 1.3 — API Layer
- Create `lib/api.ts` mirroring all `app/actions/multiplayer.ts` functions
- Each function: `fetch(BACKEND_URL + '/api/multiplayer/...', { method: 'POST', body: JSON.stringify({playerId, ...}) })`
- **Backend change required:** Add `app/api/multiplayer/[action]/route.ts` routes that call the same `multiplayerService.*` functions already used by Server Actions
- Alternatively: keep Server Actions and call from RN via next-action or a custom Next.js endpoint

#### Task 1.4 — Session Store
- `store/sessionStore.ts`: generate player ID once, persist to AsyncStorage
- `hooks/usePlayerId.ts`: loads on app start, returns stable ID

#### Task 1.5 — Navigation Skeleton
- Expo Router `app/` directory with all route files (empty screens)
- Menu → FindMatch → Matchmaking → Game (as a flow)
- Test navigation transitions on device

---

### Sprint 2: Game Types & State (Days 5–7)

#### Task 2.1 — Copy Types
- Copy `types/game.ts` and `types/multiplayer.ts` directly (pure TypeScript, no web deps)

#### Task 2.2 — Zustand Game Store
```typescript
// store/gameStore.ts
interface GameStore {
  gameMode: GameMode
  currentLobby: Lobby | null
  sharedGameState: SharedGameState | null
  selectedPlayerCount: number
  selectedRoundsToWin: number
  playerId: string
  // actions
  setGameMode: (mode: GameMode) => void
  setSharedGameState: (state: SharedGameState) => void
  // ...
}
```
- Replace all `useState` in `page.tsx` with store slices
- `sessionStore` handles player ID persistence

#### Task 2.3 — Polling Hook
```typescript
// hooks/useGamePolling.ts
export function useGamePolling(playerId: string, gameMode: string) {
  const { setSharedGameState } = useGameStore()
  
  useEffect(() => {
    if (gameMode !== 'playing') return
    
    const interval = setInterval(async () => {
      const result = await api.pollGameState(playerId)
      if (result?.state) setSharedGameState(result.state)
    }, 500)
    
    return () => clearInterval(interval)
  }, [gameMode, playerId])
}
```

#### Task 2.4 — AppState Handler
```typescript
// hooks/useAppStateHandler.ts
// Replace document.visibilityState with AppState.addEventListener
AppState.addEventListener('change', (state) => {
  if (state === 'active' && pendingGameLobby) {
    setGameStartedWhileAway(true)
  }
})
```

---

### Sprint 3: Core UI Components (Days 8–14)

#### Task 3.1 — CardComponent (3D Flip)
This is the hardest single component. Use `react-native-reanimated` v3:

```typescript
// components/game/CardComponent.tsx
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate
} from 'react-native-reanimated'

export function CardComponent({ card, canFlip, onFlip, playerAvatar, size }) {
  const rotateY = useSharedValue(card.isRevealed ? 180 : 0)
  
  useEffect(() => {
    rotateY.value = withTiming(card.isRevealed ? 180 : 0, { duration: 700 })
  }, [card.isRevealed])
  
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rotateY.value}deg` }],
    backfaceVisibility: 'hidden',
  }))
  
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${180 - rotateY.value}deg` }],
    backfaceVisibility: 'hidden',
  }))
  
  return (
    <TouchableOpacity onPress={() => canFlip && !card.isRevealed && onFlip()}>
      <View style={{ width: cardWidth, height: cardHeight }}>
        <Animated.View style={[StyleSheet.absoluteFill, cardBackStyle, backStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, cardFrontStyle, frontStyle]}>
          {playerAvatar && <Image source={{ uri: playerAvatar }} />}
          <Text>☠</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  )
}
```

#### Task 3.2 — PlayerSeat Component
- Port `player-seat.tsx` logic
- Use `Animated.View` for scale/glow effects
- Emoji picker: render as a `Modal` or absolute positioned `View` above the avatar
- Series win dots: `View` array with amber circular styles

#### Task 3.3 — GameTable Layout
The 8-position circular layout is screen-size dependent. Use `useWindowDimensions`:

```typescript
// components/game/GameTable.tsx
const { width, height } = useWindowDimensions()
const positions = computePlayerPositions(width, height, playerCount) 
// Returns { top, left } for each of 8 positions

const computePlayerPositions = (w, h, count) => {
  // Position 0: bottom center (South)
  // Position 4: top center (North)
  // etc.
  const cx = w / 2
  const cy = h / 2
  const rx = w * 0.42   // horizontal radius
  const ry = h * 0.38   // vertical radius
  const angles = count === 4 
    ? [90, 180, 270, 0]      // S, W, N, E
    : [90, 135, 180, 225, 270, 315, 0, 45]  // S, SW, W, NW, N, NE, E, SE
  return angles.map(deg => ({
    top: cy + ry * Math.sin(deg * Math.PI / 180) - SEAT_HEIGHT/2,
    left: cx + rx * Math.cos(deg * Math.PI / 180) - SEAT_WIDTH/2,
  }))
}
```

#### Task 3.4 — CardGrid
- 2-column grid for 4 cards, 4-column for 8 cards
- Use `FlatList` or mapped `View` rows

---

### Sprint 4: Screens (Days 15–21)

#### Task 4.1 — Menu Screen
- Title (Cinzel font), animated card preview, 3 main buttons
- `AnimatedCardPreview` port: just `setInterval` cycling `rotateY` on 4 cards

#### Task 4.2 — Player/Round Selection Screens
- Straightforward button grids
- Lobby stats badge via `api.getLobbiesWaitingByConfig()`
- LiveStats component (polling every 10s)

#### Task 4.3 — Matchmaking Screen
- Player slots grid with DiceBear avatars
- Countdown timer (server `startTimer` → local display)
- Emoji reaction strip

#### Task 4.4 — Live Game Screen
- Compose `GameTable`, `CardGrid`, message box, header, footer
- Round/Series end overlays: render as `Modal` (fullscreen)
- Leave/Rules buttons at bottom

#### Task 4.5 — Modals (Rules, Leave, Game-over, Round-end, Series-end)
- Use `Modal` from React Native or `@gorhom/bottom-sheet` for the rules panel
- Keep the same content, translate styling

---

### Sprint 5: Offline Mode (Days 22–25)

#### Task 5.1 — Offline Game Engine
- Port `offline-game.tsx` game logic to `hooks/useOfflineGame.ts`
- Pure TypeScript: Fisher-Yates shuffle, bot AI, turn timer, game phases
- No network calls needed
- Reuse `CardComponent`, `PlayerSeat`, `GameTable` from Sprint 3

#### Task 5.2 — Offline Setup Screen
- Player config grid (toggle human/computer per seat)
- Avatars + names displayed

---

### Sprint 6: Private Games (Days 26–28)

#### Task 6.1 — Host/Join Entry
- Two buttons: Host Game, Join Game
- Navigate to respective flows

#### Task 6.2 — Private Lobby Screen
- Port `private-lobby-screen.tsx`
- Show game code prominently (Cinzel, large font)
- Player list, host controls, start button

#### Task 6.3 — Join With Code
- 4-character code input (custom `TextInput` with letter-only filtering, mono font)
- API call to `joinByCode`

---

### Sprint 7: Polish & Native Features (Days 29–33)

#### Task 7.1 — Haptic Feedback
```typescript
import * as Haptics from 'expo-haptics'
// Card reveal: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
// Elimination: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
// My turn: Haptics.selectionAsync()
```

#### Task 7.2 — Sound Effects (optional)
- `expo-av` for card flip sound, elimination sting, victory fanfare

#### Task 7.3 — Safe Area Handling
- `SafeAreaProvider` + `useSafeAreaInsets` around all screens
- Ensure game table positions account for notch/home indicator

#### Task 7.4 — Ambient Glow Backgrounds
- `expo-linear-gradient` for approximating the `radial-gradient` dark amber background
- Add subtle particle animation (or just static gradient)

#### Task 7.5 — Push Notifications (optional but high-value)
```typescript
import * as Notifications from 'expo-notifications'
// "Your game is about to start!" when lobby fills
```

---

### Sprint 8: Backend Adaptation (Days 29–30, parallel with Sprint 7)

#### Task 8.1 — Expose Server Actions as API Routes
The existing `app/actions/multiplayer.ts` Server Actions must be accessible from React Native (not via Next.js `"use server"` form calls, but via plain fetch).

Options:
1. **Add API routes** in the existing Next.js app at `app/api/multiplayer/route.ts` that forward to the same service functions. Clean and keeps one codebase.
2. **Deploy a small Hono/Express service** that wraps `multiplayer-service.ts`. Clean separation, slightly more infra.

**Recommended:** Option 1. Add POST endpoints like:
```
POST /api/multiplayer/poll-game-state
POST /api/multiplayer/select-target
POST /api/multiplayer/select-card
POST /api/multiplayer/heartbeat
POST /api/multiplayer/join-matchmaking
POST /api/multiplayer/leave
POST /api/multiplayer/emoji-reaction
POST /api/multiplayer/vote-rematch
POST /api/multiplayer/host-private-lobby
POST /api/multiplayer/join-by-code
POST /api/multiplayer/host-start-game
GET  /api/multiplayer/lobby-stats
GET  /api/multiplayer/global-stats
```

Each endpoint: validate body, call `multiplayerService.xxx()`, return JSON.

---

## 6. Key Conversion Decisions Summary

| Web Pattern | React Native Solution |
|---|---|
| `localStorage` | `@react-native-async-storage/async-storage` |
| `document.visibilityState` | `AppState.addEventListener('change', ...)` |
| CSS 3D card flip (`perspective`, `rotateY`) | `react-native-reanimated` v3 shared values + transform |
| `backdrop-blur-xl` | No direct equivalent; use semi-opaque backgrounds (`rgba`) |
| `radial-gradient` CSS | `expo-linear-gradient` (diagonal approximation) or SVG |
| Tailwind classes | NativeWind v4 (`className` prop on View/Text) |
| `min-h-screen` | `flex: 1` |
| `h-[calc(100vh-16px)]` | `useWindowDimensions().height - 16` |
| Absolute card/player positioning | `position: 'absolute'` + `useWindowDimensions` math |
| Google Fonts (Cinzel) | `@expo-google-fonts/cinzel` + `useFonts` |
| DiceBear SVG avatars | `<Image source={{ uri: ... }}>` (HTTPS URLs work) |
| Next.js Server Actions | `fetch()` against Next.js API routes |
| `setInterval` / `clearInterval` | Same API — works in React Native |
| Emoji picker `onMouseDown` dismiss | `TouchableWithoutFeedback` outside press |
| CSS animations (`animate-pulse`) | NativeWind works, or `Animated.loop` + `withRepeat` |
| `details/summary` accordion | `Pressable` + animated height, or `expo-accordion` |

---

## 7. Recommended Tech Stack (Final)

```json
{
  "framework": "Expo SDK 52 (React Native 0.76)",
  "router": "Expo Router v4",
  "styling": "NativeWind v4 (Tailwind CSS for RN)",
  "animation": "react-native-reanimated v3",
  "state": "Zustand v5",
  "storage": "@react-native-async-storage/async-storage",
  "fonts": "@expo-google-fonts/cinzel",
  "gradient": "expo-linear-gradient",
  "haptics": "expo-haptics",
  "build": "EAS Build (Expo Application Services)",
  "backend": "Existing Next.js + Upstash Redis (no change)",
  "api_access": "New Next.js /api/multiplayer/* REST endpoints"
}
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 3D card flip performance on low-end Android | Medium | High | Profile early; `react-native-reanimated` uses native thread |
| 8-player table layout on small phones (375px wide) | Medium | Medium | Use `small` size mode for all seats on phones < 390px wide |
| Upstash Redis latency causes poll lag | Low | Medium | Already in production; 500ms polling masks it |
| App Store rejection (no significant native features) | Low | High | Add haptics, push notifications, offline mode to qualify |
| NativeWind v4 breaking changes | Medium | Low | Pin version; NativeWind is stable for Tailwind v3 class mapping |
| `backfaceVisibility` on Android | Medium | Medium | Test with `renderToHardwareTextureAndroid` prop |

---

## 9. Suggested First PR / Immediate Next Steps

1. **Create Expo project** with Expo Router, NativeWind, Reanimated, Zustand
2. **Implement `CardComponent`** with 3D flip (the hardest and most visually distinctive piece — validate it looks good early)
3. **Implement API layer** (add REST routes to the Next.js backend)
4. **Implement session store** (player ID in AsyncStorage)
5. **Implement Menu screen** (validates fonts, gradients, layout)
6. **Wire up matchmaking flow** (validates full round-trip: join → lobby → game start → poll)
7. At this point you have a playable MVP to test on device

---

*Plan generated from full static analysis of the v0-hide-and-seek-cards repository. All file references are accurate as of the main branch at time of analysis.*
