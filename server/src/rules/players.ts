import { Card, Territories } from '.';
import { Status } from '..';

export interface Player {
	token: string;
	name: string;
	status: Status;
	reinforcement: number; // 0
	selected?: Territories;
	joined?: string;
	sessionid?: string;
	wonBattle?: number;
	cards: Record<string, Card>;
	holdings: Territories[];
};

export const isPlayer = (variable: any): variable is Player => {
	const val = variable as Player;
	return (val.token !== undefined) &&
		(val.name !== undefined) &&
		(val.reinforcement !== undefined) &&
		(val.status !== undefined);
};
