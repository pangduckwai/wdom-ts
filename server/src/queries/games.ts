import { Redis } from 'ioredis';
import { Card, Territories, WildCards } from '../rules';
import { isEmpty } from '..';
import { Status } from '.';

export interface Game {
	token: string;
	name: string;
	host: string;
	round: number; // -1
	redeemed: number; // 0
	turns: number;
	status: Status;
	players: string[]; // use array because use this to also remember the order of turns
	cards: Card[]; // the deck has to be shuffled, thus need array
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
