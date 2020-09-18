import { Redis } from 'ioredis';
import { fromEventPattern, Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CommitStore, getCommitStore } from '../commands';
import { Card, Continent, Continents, Territory, Territories, WildCards } from '../rules';
import { Game, getSnapshot, Message, Player, reducer, Snapshot } from '.';

export type Subscriptions = {
	start: (channel: string) => Promise<number>;
	stop: (channel: string) => Promise<void>;
	report: (channel: string) => Promise<Message[]>;
};

export const getSubscriptions = (
	client: Redis,
	world: Record<Continents, Continent>,
	map: Record<Territories, Territory>,
	deck: Record<WildCards | Territories, Card>
): Subscriptions => {
	const subscribers: Record<string, {
		ready: boolean,
		busy: boolean,
		subscriber: Redis,
		lastPosition?: string,
		subscribe$?: Subscription,
		players: Record<string, Player>,
		games: Record<string, Game>,
		messages: Message[]
	}> = {};

	return {
		start: (channel: string): Promise<number> => {
			const commitStore: CommitStore = getCommitStore(channel, client);
			const snapshot: Snapshot = getSnapshot(channel, client);
		
			return new Promise<number>(async (resolve, reject) => {
				if (subscribers[channel]) {
					reject(new Error(`Channel ${channel} already subscribed`));
				} else {
					subscribers[channel] = {
						ready: false,
						busy: false,
						subscriber: client.duplicate(),
						players: {},
						games: {},
						messages: []
					};

					const source$: Observable<any> = fromEventPattern(
						handler => {
							subscribers[channel].subscriber.on('message', (chnl: string, message: string) => {
								handler({ chnl, message });
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
								subscribers[channel].busy = true;
								const notification: string = event.message;
								const criteria: { from?: string; to?: string } = { to: notification };

								if (subscribers[channel].lastPosition) criteria.from = subscribers[channel].lastPosition;
								const incomings = await commitStore.get(criteria);
								if (incomings.length > 1) console.log("INCOMING!!!", incomings.length, criteria); // TODO TEMP

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

								await snapshot.take({
									players: results.players,
									games: results.games
								})
								.then(_ => subscribers[channel].busy = false)
								.catch(_ => subscribers[channel].busy = false);
							},
							error: error => reject(error),
							complete: () => console.log('complete!')
						});
				}
			});
		},
		stop: async (channel: string) => {
			subscribers[channel].subscribe$?.unsubscribe();

			await subscribers[channel].subscriber.unsubscribe(channel)
				.catch(error => console.log(`Error unsubscribing from redis: ${error}`));

			subscribers[channel].ready = false;

			await subscribers[channel].subscriber.quit()
				.catch(error => console.log(`Error closing redis subscription client: ${error}`));

			delete subscribers[channel];
		},
		report: async (channel: string) => {
			return new Promise<Message[]>(async (resolve, reject) => {
				let retry = 5;
				while (subscribers[channel].busy && retry > 0) {
					retry --;
					await new Promise((resolve) => setTimeout(() => resolve(), 100));
				}

				if (subscribers[channel].busy)
					reject(new Error('Subscription still busy...'));
				else
					resolve(subscribers[channel].messages);
			});
		}
	};
}