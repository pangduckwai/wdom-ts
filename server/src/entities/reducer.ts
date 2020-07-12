import { Redis } from 'ioredis';
import { Commit } from '../commits';
import { Cards, Card, Territories, Territory } from '.';

// =====================
// === Runtime types ===
export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	cards: Record<Cards, Card>;
	sessionid?: string;
	ready: boolean;
}

export interface Game {
  token: string;
  name: string;
  host: Player;
  round: number; // -1
  redeemed: number; // 0
  cards: Card[]; // the deck has to be shuffled, thus need array
  map: Record<Territories, Territory>;
}
// =====================

export type Reducer = (
	client: Redis,
	channel: string,
	commits: Commit[]
) => Promise<any>;
	
export const reducer: Reducer = async (
	client: Redis,
	channel: string,
	commits: Commit[]
) => {
	const players: Record<string, Player> = {};
	const games: Record<string, Game> = {};

	return '' as any;
}
