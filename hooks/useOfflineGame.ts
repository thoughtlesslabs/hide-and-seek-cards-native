import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerId, Player, Card, GamePhase } from "../types/game";

const TURN_TIMEOUT_MS = 8000;
const BOT_DELAY_MS = 1500;

export interface OfflineGameConfig {
  playerCount: number;
  humanSlots: boolean[];
  playerNames: string[];
  roundsToWin: number;
}

export interface OfflineGameState {
  players: Player[];
  cards: Card[];
  currentPlayerIndex: number;
  targetPlayerId: PlayerId | null;
  selectedCardId: string | null;
  phase: GamePhase;
  lastMessage: string;
  winner: Player | null;
  roundNumber: number;
  seriesWinner: Player | null;
  turnStartTime: number;
  isRoundEnd: boolean;
  isSeriesEnd: boolean;
}

export interface OfflineGameActions {
  selectTarget: (targetId: PlayerId) => void;
  selectCard: (cardId: string) => void;
  continueRound: () => void;
  rematchSeries: () => void;
  leaveGame: () => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getRandomBotName(): string {
  const adjectives = ["Swift", "Mystic", "Shadow", "Blazing", "Frozen", "Thunder", "Silent", "Cosmic"];
  const nouns = ["Wolf", "Phoenix", "Dragon", "Falcon", "Serpent", "Knight", "Wizard", "Hunter"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

function createInitialState(config: OfflineGameConfig): OfflineGameState {
  const players: Player[] = [];
  
  for (let i = 0; i < config.playerCount; i++) {
    const playerId = generateId();
    players.push({
      id: playerId,
      name: config.playerNames[i] || getRandomBotName(),
      isHuman: config.humanSlots[i],
      isEliminated: false,
      cardValue: 0,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(config.playerNames[i] || playerId)}`,
    });
  }

  const cards: Card[] = [];
  const cardsPerPlayer = 2;
  const skullCount = Math.floor(config.playerCount / 2);
  const skullOwners = fisherYatesShuffle([...Array(config.playerCount).keys()]).slice(0, skullCount);
  
  let position = 0;
  for (let p = 0; p < config.playerCount; p++) {
    for (let c = 0; c < cardsPerPlayer; c++) {
      cards.push({
        id: generateId(),
        ownerId: players[p].id,
        isRevealed: false,
        position: position++,
      });
    }
  }

  for (const p of skullOwners) {
    const ownerCards = cards.filter(c => c.ownerId === players[p].id);
    if (ownerCards.length > 0) {
      const skullCard = ownerCards[Math.floor(Math.random() * ownerCards.length)];
      (skullCard as any).isSkull = true;
    }
  }

  for (const card of cards) {
    if (!(card as any).isSkull) {
      (card as any).isSkull = false;
    }
  }

  return {
    players,
    cards,
    currentPlayerIndex: 0,
    targetPlayerId: null,
    selectedCardId: null,
    phase: GamePhase.SELECT_TARGET,
    lastMessage: "Choose your target",
    winner: null,
    roundNumber: 1,
    seriesWinner: null,
    turnStartTime: Date.now(),
    isRoundEnd: false,
    isSeriesEnd: false,
  };
}

function getNextAliveIndex(players: Player[], currentIndex: number): number {
  let attempts = 0;
  let nextIndex = currentIndex;
  
  do {
    nextIndex = (nextIndex + 1) % players.length;
    attempts++;
  } while (players[nextIndex].isEliminated && attempts < players.length);
  
  return nextIndex;
}

function getAlivePlayers(players: Player[]): Player[] {
  return players.filter(p => !p.isEliminated);
}

function checkWinCondition(players: Player[]): Player | null {
  const alive = getAlivePlayers(players);
  if (alive.length === 1) {
    return alive[0];
  }
  return null;
}

export function useOfflineGame(config: OfflineGameConfig): [OfflineGameState, OfflineGameActions] {
  const [state, setState] = useState<OfflineGameState>(() => createInitialState(config));
  const botTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
  }, []);

  const findBotIndex = useCallback((): number | null => {
    let index = state.currentPlayerIndex;
    let attempts = 0;
    
    do {
      if (!state.players[index].isHuman && !state.players[index].isEliminated) {
        return index;
      }
      index = (index + 1) % state.players.length;
      attempts++;
    } while (attempts < state.players.length);
    
    return null;
  }, [state.currentPlayerIndex, state.players]);

  const executeBotAction = useCallback((currentState: OfflineGameState) => {
    const botIndex = (() => {
      let index = currentState.currentPlayerIndex;
      let attempts = 0;
      do {
        if (!currentState.players[index].isHuman && !currentState.players[index].isEliminated) {
          return index;
        }
        index = (index + 1) % currentState.players.length;
        attempts++;
      } while (attempts < currentState.players.length);
      return null;
    })();

    if (botIndex === null) return;

    if (currentState.phase === GamePhase.SELECT_TARGET) {
      const currentPlayerId = currentState.players[botIndex].id;
      const alivePlayers = getAlivePlayers(currentState.players).filter(p => p.id !== currentPlayerId);
      if (alivePlayers.length > 0) {
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        setState(prev => ({
          ...prev,
          targetPlayerId: target.id,
          phase: GamePhase.SELECT_CARD,
          lastMessage: `Bot targeting ${target.name}`,
          turnStartTime: Date.now(),
        }));
      }
    } else if (currentState.phase === GamePhase.SELECT_CARD && currentState.targetPlayerId) {
      const targetCards = currentState.cards.filter(
        c => c.ownerId === currentState.targetPlayerId && !c.isRevealed
      );
      if (targetCards.length > 0) {
        const selectedCard = targetCards[Math.floor(Math.random() * targetCards.length)];
        setState(prev => ({
          ...prev,
          selectedCardId: selectedCard.id,
        }));
        setTimeout(() => handleCardReveal(selectedCard.id, selectedCard.ownerId), 300);
      }
    }
  }, []);

  const handleCardReveal = useCallback((cardId: string, cardOwnerId: PlayerId) => {
    setState(prev => {
      const newCards = prev.cards.map(c => 
        c.id === cardId ? { ...c, isRevealed: true } : c
      );
      const revealedCard = newCards.find(c => c.id === cardId) as any;
      const isSkull = revealedCard?.isSkull === true;
      
      const newPlayers = prev.players.map(p => {
        if (isSkull && p.id === prev.players[prev.currentPlayerIndex].id) {
          return { ...p, isEliminated: true };
        }
        return p;
      });

      const currentPlayer = newPlayers[prev.currentPlayerIndex];
      const message = isSkull 
        ? `${currentPlayer.name} flipped a skull and is eliminated!`
        : `${currentPlayer.name} flipped safe!`;

      const winner = checkWinCondition(newPlayers);
      
      if (winner) {
        const newWinner = { 
          ...winner, 
          seriesWins: (winner as any).seriesWins ? (winner as any).seriesWins + 1 : 1 
        };
        const updatedPlayers = newPlayers.map(p => 
          p.id === winner.id ? newWinner : p
        );
        
        const hasSeriesWinner = (newWinner as any).seriesWins >= config.roundsToWin;
        
        if (hasSeriesWinner) {
          return {
            ...prev,
            players: updatedPlayers,
            cards: newCards,
            phase: GamePhase.GAME_OVER,
            winner: newWinner,
            seriesWinner: newWinner,
            lastMessage: `${newWinner.name} wins the series!`,
            isRoundEnd: false,
            isSeriesEnd: true,
          };
        }
        
        return {
          ...prev,
          players: updatedPlayers,
          cards: newCards,
          phase: GamePhase.GAME_OVER,
          winner: newWinner,
          lastMessage: `${newWinner.name} wins the round!`,
          isRoundEnd: true,
          isSeriesEnd: false,
        };
      }

      const nextIndex = getNextAliveIndex(newPlayers, prev.currentPlayerIndex);
      
      return {
        ...prev,
        players: newPlayers,
        cards: newCards,
        phase: GamePhase.SELECT_TARGET,
        targetPlayerId: null,
        selectedCardId: null,
        currentPlayerIndex: nextIndex,
        lastMessage: `${newPlayers[nextIndex].name}'s turn`,
        turnStartTime: Date.now(),
      };
    });
  }, [config.roundsToWin]);

  useEffect(() => {
    clearTimers();

    if (state.phase === GamePhase.SELECT_TARGET || state.phase === GamePhase.SELECT_CARD) {
      const botIndex = findBotIndex();
      
      if (botIndex !== null && botIndex === state.currentPlayerIndex) {
        botTimeoutRef.current = setTimeout(() => {
          executeBotAction(state);
        }, BOT_DELAY_MS);
      }

      timerTimeoutRef.current = setTimeout(() => {
        setState(prev => {
          const winner = checkWinCondition(prev.players);
          if (winner) {
            return {
              ...prev,
              phase: GamePhase.GAME_OVER,
              winner,
              lastMessage: `${winner.name} wins by timeout!`,
              isRoundEnd: true,
            };
          }
          
          const nextIndex = getNextAliveIndex(prev.players, prev.currentPlayerIndex);
          return {
            ...prev,
            currentPlayerIndex: nextIndex,
            targetPlayerId: null,
            selectedCardId: null,
            phase: GamePhase.SELECT_TARGET,
            lastMessage: "Turn skipped - time expired",
            turnStartTime: Date.now(),
          };
        });
      }, TURN_TIMEOUT_MS);
    }

    return clearTimers;
  }, [state.phase, state.currentPlayerIndex, state.targetPlayerId, clearTimers, executeBotAction, findBotIndex]);

  useEffect(() => {
    if (state.phase === GamePhase.SELECT_CARD && state.targetPlayerId) {
      const botIndex = findBotIndex();
      if (botIndex !== null && botIndex === state.currentPlayerIndex) {
        botTimeoutRef.current = setTimeout(() => {
          executeBotAction(state);
        }, BOT_DELAY_MS);
      }
    }
  }, [state.phase, state.targetPlayerId, state.currentPlayerIndex, findBotIndex, executeBotAction]);

  const selectTarget = useCallback((targetId: PlayerId) => {
    setState(prev => {
      if (prev.phase !== GamePhase.SELECT_TARGET) return prev;
      if (prev.players[prev.currentPlayerIndex].isHuman === false) return prev;
      
      return {
        ...prev,
        targetPlayerId: targetId,
        phase: GamePhase.SELECT_CARD,
        lastMessage: "Choose a card to flip",
        turnStartTime: Date.now(),
      };
    });
  }, []);

  const selectCard = useCallback((cardId: string) => {
    setState(prev => {
      if (prev.phase !== GamePhase.SELECT_CARD) return prev;
      if (prev.players[prev.currentPlayerIndex].isHuman === false) return prev;
      if (!prev.targetPlayerId) return prev;
      
      const card = prev.cards.find(c => c.id === cardId);
      if (!card || card.ownerId !== prev.targetPlayerId || card.isRevealed) return prev;
      
      return {
        ...prev,
        selectedCardId: cardId,
      };
    });
    
    setTimeout(() => {
      setState(prev => {
        const card = prev.cards.find(c => c.id === cardId);
        if (card) {
          handleCardReveal(cardId, card.ownerId);
        }
        return prev;
      });
    }, 300);
  }, [handleCardReveal]);

  const continueRound = useCallback(() => {
    setState(prev => {
      const newRoundNumber = prev.roundNumber + 1;
      
      const newPlayers = prev.players.map(p => ({
        ...p,
        isEliminated: false,
        avatar: p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`,
      }));

      const cards: Card[] = [];
      const cardsPerPlayer = 2;
      const skullCount = Math.floor(config.playerCount / 2);
      const skullOwners = fisherYatesShuffle([...Array(config.playerCount).keys()]).slice(0, skullCount);
      
      let position = 0;
      for (let p = 0; p < config.playerCount; p++) {
        for (let c = 0; c < cardsPerPlayer; c++) {
          cards.push({
            id: generateId(),
            ownerId: newPlayers[p].id,
            isRevealed: false,
            position: position++,
          });
        }
      }

      for (const p of skullOwners) {
        const ownerCards = cards.filter(c => c.ownerId === newPlayers[p].id);
        if (ownerCards.length > 0) {
          const skullCard = ownerCards[Math.floor(Math.random() * ownerCards.length)];
          (skullCard as any).isSkull = true;
        }
      }

      for (const card of cards) {
        if (!(card as any).isSkull) {
          (card as any).isSkull = false;
        }
      }

      const firstHumanIndex = newPlayers.findIndex(p => p.isHuman && !p.isEliminated);
      const startIndex = firstHumanIndex >= 0 ? firstHumanIndex : 0;

      return {
        ...prev,
        players: newPlayers,
        cards,
        currentPlayerIndex: startIndex,
        targetPlayerId: null,
        selectedCardId: null,
        phase: GamePhase.SELECT_TARGET,
        lastMessage: `${newPlayers[startIndex].name}'s turn`,
        winner: null,
        roundNumber: newRoundNumber,
        turnStartTime: Date.now(),
        isRoundEnd: false,
        isSeriesEnd: false,
      };
    });
  }, [config.playerCount]);

  const rematchSeries = useCallback(() => {
    setState(prev => {
      const newPlayers = prev.players.map(p => ({
        ...p,
        isEliminated: false,
        seriesWins: 0,
      }));

      const cards: Card[] = [];
      const cardsPerPlayer = 2;
      const skullCount = Math.floor(config.playerCount / 2);
      const skullOwners = fisherYatesShuffle([...Array(config.playerCount).keys()]).slice(0, skullCount);
      
      let position = 0;
      for (let p = 0; p < config.playerCount; p++) {
        for (let c = 0; c < cardsPerPlayer; c++) {
          cards.push({
            id: generateId(),
            ownerId: newPlayers[p].id,
            isRevealed: false,
            position: position++,
          });
        }
      }

      for (const p of skullOwners) {
        const ownerCards = cards.filter(c => c.ownerId === newPlayers[p].id);
        if (ownerCards.length > 0) {
          const skullCard = ownerCards[Math.floor(Math.random() * ownerCards.length)];
          (skullCard as any).isSkull = true;
        }
      }

      for (const card of cards) {
        if (!(card as any).isSkull) {
          (card as any).isSkull = false;
        }
      }

      const firstHumanIndex = newPlayers.findIndex(p => p.isHuman && !p.isEliminated);
      const startIndex = firstHumanIndex >= 0 ? firstHumanIndex : 0;

      return {
        ...prev,
        players: newPlayers,
        cards,
        currentPlayerIndex: startIndex,
        targetPlayerId: null,
        selectedCardId: null,
        phase: GamePhase.SELECT_TARGET,
        lastMessage: `${newPlayers[startIndex].name}'s turn`,
        winner: null,
        seriesWinner: null,
        roundNumber: 1,
        turnStartTime: Date.now(),
        isRoundEnd: false,
        isSeriesEnd: false,
      };
    });
  }, [config.playerCount]);

  const leaveGame = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const actions: OfflineGameActions = {
    selectTarget,
    selectCard,
    continueRound,
    rematchSeries,
    leaveGame,
  };

  return [state, actions];
}

export function useOfflineTimer(turnStartTime: number, phase: GamePhase): { 
  turnTimeRemaining: number | null; 
  turnProgress: number | null;
} {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const isActiveTurn = phase === GamePhase.SELECT_TARGET || phase === GamePhase.SELECT_CARD;
    
    if (!isActiveTurn) {
      setTimeRemaining(null);
      setProgress(null);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsed = now - turnStartTime;
      const remainingMs = TURN_TIMEOUT_MS - elapsed;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1_000));
      const prog = Math.min(1, elapsed / TURN_TIMEOUT_MS);

      setTimeRemaining(remainingSecs);
      setProgress(prog);
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [turnStartTime, phase]);

  return { turnTimeRemaining: timeRemaining, turnProgress: progress };
}
