import { Redis } from 'ioredis';
import { fromEventPattern, Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Commit, CommitStore } from '../commands';
import { Card, Continent, Continents, Territory, Territories, WildCards } from '../rules';
import { Game, Message, Player, reducer, Snapshot } from '.';

export const Subscriptions = (
	client: Redis,
	world: Record<Continents, Continent>,
	map: Record<Territories, Territory>,
	deck: Record<WildCards | Territories, Card>
) => {
	const subscribers: Record<string, {
		ready: boolean,
		subscriber: Redis,
		lastPosition?: string,
		subscribe$?: Subscription,
		players: Record<string, Player>,
		games: Record<string, Game>,
		messages: Message[]
	}> = {};

	const commitStore: {
		put: (channel: string, commit: Commit) => Promise<Commit>,
		get: (channel: string, args?: { id?: string; from?: string; to?: string}) => Promise<Commit[]>
	} = CommitStore(client);

	const snapshot: {
		take: (channel: string, { players, games }: { players: Record<string, Player>, games: Record<string, Game>}) => Promise<number>,
		read: (channel: string) => Promise<{ players: Record<string, Player>, games: Record<string, Game>}>
	} = Snapshot(client);

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
								const notification: string = event.message;
								const criteria: { from?: string; to?: string } = { to: notification };

								if (subscribers[channel].lastPosition) criteria.from = subscribers[channel].lastPosition;
								const incomings = await commitStore.get(event.channel, criteria);
								if (incomings.length > 0) { // 1
									console.log("HEREHEREHERE", incomings.length, subscribers[channel].lastPosition, notification); // TODO TEMP
								}

								// Get 'next' position
								const streamId = notification.split('-');
								const nextId = parseInt(streamId[1], 10) + 1;
								subscribers[channel].lastPosition = `${streamId[0]}-${nextId}`;

								const results = reducer(world, map, deck)(incomings, {
									players: subscribers[channel].players,
									games: subscribers[channel].games
								});

								subscribers[channel].players = results.players;
								subscribers[channel].games = results.games;
								subscribers[channel].messages.push(...results.messages);

								await snapshot.take(channel, {
									players: results.players,
									games: results.games
								});
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