import { Redis } from 'ioredis';
import { fromEventPattern, Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { deserialize } from '..';
import { Commit, isNotification, toCommits, CommitStore } from '../commands';
import { Card, Territory, Territories, WildCards } from '../rules';
import { Game, GameSnapshot, Message, MessageSnapshot, Player, PlayerSnapshot, reducer } from '.';

export const Subscriptions = (
	client: Redis,
	map: Record<Territories, Territory>,
	deck: Record<WildCards | Territories, Card>
) => {
	const subscribers: Record<string, {
		ready: boolean,
		subscriber: Redis,
		lastPosition?: number,
		subscribe$?: Subscription,
		players: Record<string, Player>,
		games: Record<string, Game>,
		messages: Message[]
	}> = {};

	const commitStore: {
		put: (channel: string, commit: Commit) => Promise<Commit>,
		pub: (channel: string, commit: Commit) => Promise<Commit>,
		get: (channel: string, args?: { id?: string; fromTime?: number; toTime?: number}) => Promise<{
			index: number;
			commit: Commit;
		}[]>
	} = CommitStore(client);

	return {
		start: (channel: string): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
				if (subscribers[channel]) {
					reject(new Error(`Channel ${channel} already subscribed`));
				} else {
					subscribers[channel] = {
						ready: false,
						subscriber: client.duplicate(),
						players: await PlayerSnapshot(client, map, deck).list(channel),
						games: await GameSnapshot(client, deck).list(channel),
						messages: []
					};

					const source$: Observable<any> = fromEventPattern(
						handler => {
							subscribers[channel].subscriber.on('message', (channel: string, message: string) => {
								handler({ channel, message });
							});
							subscribers[channel].subscriber.subscribe(channel)
								.then(count => {
									if (count <= 0)
										reject(new Error(`[Subscription] subscribing to ${channel} failed, total number of subscribers is ${count}`));
									else {
										subscribers[channel].ready = true;
										resolve(count);
									}
								})
								.catch(error => reject(new Error(`[Subscription] subscribing to ${channel} failed: ${error}`)));
						},
						_ => {
							subscribers[channel].subscriber.unsubscribe(channel)
								.then(count => console.log(`Redis publication unsubscribed ${count}`))
								.catch(error => console.log(`Redis publication unsubscribe error ${error}`));
						}
					);

					subscribers[channel].subscribe$ = source$
						.pipe(
							debounceTime(100)
						)
						.subscribe({
							next: async event => {
								const notification = deserialize('[Subscriptions]', event.message, isNotification);
								const criteria: { fromTime?: number; toTime?: number } = { toTime: notification.timestamp };

								if (subscribers[channel].lastPosition) criteria.fromTime = subscribers[channel].lastPosition;
								const incomings = await commitStore.get(event.channel, criteria);
								subscribers[channel].lastPosition = notification.timestamp + 1;

								const { players, games, messages } = reducer(map, deck)(incomings.map(r => r.commit), {
									players: subscribers[channel].players,
									games: subscribers[channel].games
								});
								subscribers[channel].players = players;
								subscribers[channel].games = games;
								subscribers[channel].messages.push(...messages);
							},
							error: error => reject(error),
							complete: () => console.log('complete!')
						});
				}
			});
		},
		stop: async (channel: string) => {
			subscribers[channel].subscribe$?.unsubscribe();
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
			}>(async (resolve) => {
				resolve({
					ready: subscribers[channel].ready,
					players: subscribers[channel].players,
					games: subscribers[channel].games,
					messages: subscribers[channel].messages
				});
			});
		}
	};
}