import { Card, Territory } from '.';
import { Status } from '../queries';
import { Territories } from './territory';

export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	selected?: Territories;
	status: Status;
	holdings: Territories[];
	cards: Record<string, Card>;
	joined?: string;
	sessionid?: string;
	wonBattle?: number;
};

export const isPlayer = (variable: any): variable is Player => {
	const val = variable as Player;
	return (val.token !== undefined) &&
		(val.name !== undefined) &&
		(val.reinforcement !== undefined) &&
		(val.status !== undefined);
};
