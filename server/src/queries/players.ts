import { Card, Territory } from '../rules';
import { Status } from '.';

export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	selected: string; // ''
	status: Status;
	holdings: Record<string, Territory>;
	holdingsCount: number; // 0
	cards: Record<string, Card>;
	joined?: string;
	sessionid?: string;
};

export const isPlayer = (variable: any): variable is Player => {
	const val = variable as Player;
	return (val.token !== undefined) &&
		(val.name !== undefined) &&
		(val.reinforcement !== undefined) &&
		(val.status !== undefined);
};
