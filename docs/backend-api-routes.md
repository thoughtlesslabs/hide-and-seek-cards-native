# Backend API Routes Spec

REST endpoints needed in the existing Next.js app to replace Server Actions for React Native clients.
All endpoints live under `app/api/multiplayer/` in the Next.js project.

## Matchmaking

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| POST | `/api/multiplayer/join-matchmaking` | `{ playerId, roundsToWin, maxPlayers }` | `multiplayerService.joinMatchmaking()` | `LobbyPlayer` |
| POST | `/api/multiplayer/lobby-status` | `{ playerId }` | `multiplayerService.getLobbyStatus()` | `Lobby \| null` |
| POST | `/api/multiplayer/leave-lobby` | `{ playerId }` | `multiplayerService.leaveLobby()` | `{ success: true }` |

## Game State

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| POST | `/api/multiplayer/poll-game-state` | `{ playerId }` | `multiplayerService.pollGameState()` | `{ state: SharedGameState \| null, reactions: Record<string, string> }` |
| POST | `/api/multiplayer/get-game-state` | `{ playerId }` | `multiplayerService.getGameState()` | `SharedGameState \| null` |
| POST | `/api/multiplayer/select-target` | `{ playerId, targetId }` | `multiplayerService.selectTarget()` | `SharedGameState \| null` |
| POST | `/api/multiplayer/select-card` | `{ playerId, cardId, targetId? }` | `multiplayerService.selectCard()` | `SharedGameState \| null` |

## Activity

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| POST | `/api/multiplayer/heartbeat` | `{ playerId }` | `multiplayerService.sendHeartbeat()` | `{ success: true }` |
| POST | `/api/multiplayer/emoji-reaction` | `{ playerId, emoji }` | `multiplayerService.sendEmojiReaction()` | `{ success: true }` |
| POST | `/api/multiplayer/emoji-reactions` | `{ lobbyId }` | `multiplayerService.getEmojiReactions()` | `Record<string, string>` |

## Game Lifecycle

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| POST | `/api/multiplayer/finish-game` | `{ playerId }` | `multiplayerService.finishGame()` | `{ success: true }` |
| POST | `/api/multiplayer/leave-game` | `{ playerId }` | `multiplayerService.leaveGame()` | `{ success: true }` |
| POST | `/api/multiplayer/vote-rematch` | `{ playerId }` | `multiplayerService.voteForRematch()` | `SharedGameState \| null` |
| POST | `/api/multiplayer/start-rematch` | `{ playerId }` | `multiplayerService.startRematchVote()` | `SharedGameState \| null` |

## Private Games

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| POST | `/api/multiplayer/host-private-lobby` | `{ playerId, roundsToWin, maxPlayers }` | `multiplayerService.hostPrivateLobby()` | `{ lobby: Lobby, gameCode: string }` |
| POST | `/api/multiplayer/join-by-code` | `{ playerId, gameCode }` | `multiplayerService.joinByCode()` | `{ success: boolean, error?: string }` |
| POST | `/api/multiplayer/host-start-game` | `{ playerId }` | `multiplayerService.hostStartGame()` | `{ success: boolean, error?: string }` |

## Stats

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| GET | `/api/multiplayer/global-stats` | — | `multiplayerService.getGlobalStats()` | `{ playersOnline, gamesInProgress }` |
| GET | `/api/multiplayer/lobby-stats` | — | `multiplayerService.getLobbiesWaitingByConfig()` | `{ lobbies: [{ maxPlayers, roundsToWin, count }] }` |

## Turn Management

| Method | Path | Request Body | Service Function | Response |
|--------|------|-------------|-----------------|----------|
| POST | `/api/multiplayer/check-turn-timeout` | `{ lobbyId }` | `multiplayerService.checkTurnTimeout()` | `SharedGameState \| null` |
| POST | `/api/multiplayer/check-disconnects` | `{ lobbyId }` | `multiplayerService.checkDisconnects()` | `string[]` |
| POST | `/api/multiplayer/check-bot-only` | `{ lobbyId }` | `multiplayerService.checkBotOnlyGame()` | `boolean` |

## Implementation Notes

Each route handler follows this pattern:
```typescript
// app/api/multiplayer/join-matchmaking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { multiplayerService } from '@/lib/multiplayer-service';

export async function POST(req: NextRequest) {
  const { playerId, roundsToWin, maxPlayers } = await req.json();
  const result = await multiplayerService.joinMatchmaking(playerId, roundsToWin, maxPlayers);
  return NextResponse.json(result);
}
```

- Add rate limiting middleware (existing rate limiter from Server Actions can be reused)
- Add CORS headers for mobile clients: `Access-Control-Allow-Origin: *`
- All endpoints should validate required fields and return 400 on missing params
- Error responses: `{ error: string, code?: string }`
