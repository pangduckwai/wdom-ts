import { Card, Continents, Continent, Territories, Territory } from '.';
import { Status } from '..';

export const RuleTypes = [
	'TRADITIONAL', // Player take turns to claim territories during the setup phase
	'RANDOM' // The system randomly assign initial territories to players
] as const;
export type RuleTypes = typeof RuleTypes[number];

export interface Game {
	token: string;
	name: string;
	host: string;
	ruleType: RuleTypes;
	round: number; // -1
	redeemed: number; // 0
	turns: number;
	status: Status;
	players: string[]; // use array because use this to also remember the order of turns
	cards: Card[]; // the deck has to be shuffled, thus need array
	world: Record<Continents, Continent>;
	map: Record<Territories, Territory>;
	lastBattle?: {
		redDice: number[];
		whiteDice: number[];
	}
};

export const isGame = (variable: any): variable is Game => {
	const val = variable as Game;
	return (val.token !== undefined) &&
		(val.name !== undefined) &&
		(val.host !== undefined) &&
		(val.round !== undefined) &&
		(val.redeemed !== undefined) &&
		(val.status !== undefined) &&
		(val.players !== undefined) &&
		(val.turns !== undefined);
};
