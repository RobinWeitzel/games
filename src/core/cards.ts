import type { Rng } from './random';

/**
 * Playing cards for the card games (Solitaire, FreeCell, Spider…): pure logic, no UI.
 *
 * A card is a number. Its face is `card % 52`: suit * 13 + (rank - 1), suits 0 ♠, 1 ♥, 2 ♦,
 * 3 ♣. Games with more than one deck (Spider) use `copy * 52 + face`, so every card on the table
 * still has its own id. Games persist these numbers, so this encoding must never change.
 */
export type Card = number;

export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'] as const;

export const suitOf = (c: Card) => Math.floor((c % 52) / 13);
/** 1 (ace) – 13 (king). */
export const rankOf = (c: Card) => (c % 13) + 1;
export const isRed = (c: Card) => suitOf(c) === 1 || suitOf(c) === 2;
/** "7♥" */
export const cardText = (c: Card) => `${RANKS[rankOf(c) - 1]}${SUITS[suitOf(c)]}`;
/** "7 of hearts" (VoiceOver). */
export const cardName = (c: Card) => `${RANK_NAMES[rankOf(c) - 1]} of ${SUIT_NAMES[suitOf(c)]}`;

/**
 * `cards` shuffled in place (Fisher–Yates) and returned. With the same seed, a game always
 * gets the same deal (daily challenges depend on this, so don't change the algorithm).
 */
export function shuffleCards(cards: Card[], rng: Rng): Card[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** A shuffled standard deck: the cards 0–51. */
export const shuffledDeck = (rng: Rng): Card[] => shuffleCards(Array.from({ length: 52 }, (_, i) => i), rng);
