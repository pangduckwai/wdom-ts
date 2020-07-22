import { Redis } from 'ioredis';
import { isNotification, toCommits } from '../commands';
import { Card, Territory, Territories, WildCards } from '../rules';
import { GameSnapshot, PlayerSnapshot, reducer } from '.';
import { MessageSnapshot } from './messages';

export const Subscription = (
	client: Redis,
	map: Record<Territories, Territory>,
	deck: Record<WildCards | Territories, Card>
) => {
	const subscribers: Record<string, { lastPosition: number, subscriber: Redis, ready: boolean }> = {};

	return {
		start: (channel: string): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
				if (subscribers[channel]) {
					reject(new Error(`Channel ${channel} already subscribed`));
				} else {
					subscribers[channel] = { lastPosition: -1, subscriber: client.duplicate(), ready: false };

					subscribers[channel].subscriber.on('message', async (channel, message) => {
						try {
							const notification = JSON.parse(message);
							if (isNotification(notification)) {
								if (!subscribers[channel].ready) {
									reject(new Error(`Subscription ${channel} not ready`));
								} else {
									const playerList = await PlayerSnapshot(client, map, deck).list(channel);
									const gameList = await GameSnapshot(client, deck).list(channel);

									const result = await client.zrangebyscore(
										`${channel}:Commit`,
										subscribers[channel].lastPosition >= 0 ? subscribers[channel].lastPosition : '-inf',
										notification.timestamp, 'WITHSCORES'
									);
									const incomings = toCommits('[Subscription]', result);
									subscribers[channel].lastPosition = notification.timestamp + 1;

									const { players, games, messages } = reducer(deck)(incomings, { players: playerList, games: gameList });
									for (const player of Object.values(players)) {
										await PlayerSnapshot(client, map, deck).put(channel, player);
									}
									for (const game of Object.values(games)) {
										await GameSnapshot(client, deck).put(channel, game);
									}
									for (const message of messages) {
										await MessageSnapshot.put(client, channel, message);
									}
								}
							}
						} catch (error) {
							reject(error);
						}
					});

					subscribers[channel].subscriber.subscribe(channel, (error, count) => {
						if (error) {
							reject(new Error(`[Subscription] subscribing to ${channel} failed: ${JSON.stringify(error)}`));
						} else if (count <= 0) {
							reject(new Error(`[Subscription] subscribing to ${channel} failed, total number of subscribers is ${count}`));
						} else {
							subscribers[channel].ready = true;
							resolve(count);
						}
					});
				}
			});
		},
		stop: async (channel: string) => {
			await subscribers[channel].subscriber.unsubscribe(channel);
			subscribers[channel].ready = false;
			await subscribers[channel].subscriber.quit();
			delete subscribers[channel];
		}
	};
}