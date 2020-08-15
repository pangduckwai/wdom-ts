import { Redis } from 'ioredis';
import { fromEventPattern, Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CommitStore } from '../commands';
import { Card, Continent, Continents, Territory, Territories, WildCards } from '../rules';
import { Commit, deserialize, isNotification } from '..';
import { Game, Message, Player, reducer } from '.';

export const Subscriptions = (
	client: Redis,
	world: Record<Continents, Continent>,
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
		get: (channel: string, args?: { id?: string; from?: number; to?: number}) => Promise<Commit[]>
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
						players: {},
						games: {},
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
								const criteria: { from?: number; to?: number } = { to: notification.index };

								if (subscribers[channel].lastPosition) criteria.from = subscribers[channel].lastPosition;
								const incomings = await commitStore.get(event.channel, criteria);
								if (incomings.length > 1) {
									console.log("HEREHEREHERE", event.message, subscribers[channel].lastPosition, notification.index); // TODO TEMP
								}
								subscribers[channel].lastPosition = notification.index + 1;

								const results = reducer(world, map, deck)(incomings, {
									players: subscribers[channel].players,
									games: subscribers[channel].games
								});

								subscribers[channel].players = results.players;
								subscribers[channel].games = results.games;
								subscribers[channel].messages.push(...results.messages);
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