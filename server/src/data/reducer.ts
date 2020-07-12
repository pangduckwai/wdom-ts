import { Redis } from 'ioredis';
import { Commit, Reducer } from '../model';
import { Player } from '.';

export const reducer: Reducer = async (
	client: Redis,
	channel: string,
	commits: Commit[]
) => {
	const players: Player[] = [];

	return '' as any;
}
