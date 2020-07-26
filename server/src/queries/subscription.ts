import { Redis } from 'ioredis';
import { isNotification, toCommits, CommitStore } from '../commands';
import { Card, Territory, Territories, WildCards } from '../rules';
import { Game, GameSnapshot, Message, MessageSnapshot, Player, PlayerSnapshot, reducer } from '.';

export const Subscription = (
	client: Redis,
	map: Record<Territories, Territory>,
	deck: Record<WildCards | Territories, Card>
) => {
	const subscribers: Record<string, {
		subscriber: Redis, ready: boolean, busy: boolean
		players: Record<string, Player>,
		games: Record<string, Game>,
		messages: Message[]
	}> = {};

	return {
		start: (channel: string): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
				if (subscribers[channel]) {
					reject(new Error(`Channel ${channel} already subscribed`));
				} else {
					subscribers[channel] = {
						subscriber: client.duplicate(), ready: false, busy: false,
						players: await PlayerSnapshot(client, map, deck).list(channel),
						games: await GameSnapshot(client, deck).list(channel),
						messages: []
					};

					subscribers[channel].subscriber.on('message', async (channel, message) => {
						try {
							subscribers[channel].busy = true;
							const notification = JSON.parse(message);
							if (isNotification(notification)) {
								if (!subscribers[channel].ready) {
									reject(new Error(`Subscription ${channel} not ready`));
								} else {
									const incomings = await CommitStore(client).get(channel, { id: notification.id });

									const { players, games, messages } = reducer(map, deck)(incomings, {
										players: subscribers[channel].players,
										games: subscribers[channel].games
									});
									subscribers[channel].players = players;
									subscribers[channel].games = games;
									subscribers[channel].messages.push(...messages);
									subscribers[channel].busy = false;
									// for (const player of Object.values(players)) {
									// 	PlayerSnapshot(client, map, deck).put(channel, player);
									// }
									// for (const game of Object.values(games)) {
									// 	GameSnapshot(client, deck).put(channel, game);
									// }
									// for (const message of messages) {
									// 	MessageSnapshot.put(client, channel, message);
									// }
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
		},
		report: async (channel: string) => {
			return new Promise<{
				ready: boolean;
				players: Record<string, Player>;
				games: Record<string, Game>;
				messages: Message[];
			}>(async (resolve, reject) => {
				let count = 5;
				while (subscribers[channel].busy && (count > 0)) {
					await new Promise((resolve) => setTimeout(() => resolve(), 100));
					count --;
				}
				if (subscribers[channel].busy) {
					reject(new Error(`Subscriptiong ${channel} busy`));
				} else {
					resolve({
						ready: subscribers[channel].ready,
						players: subscribers[channel].players,
						games: subscribers[channel].games,
						messages: subscribers[channel].messages
					});
				}
			});
		}
	};
}