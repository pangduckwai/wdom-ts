import { DataSource } from 'apollo-datasource';
import { Redis } from 'ioredis';
import { Errors, Game, Player, reducer } from './queries';
import { isNotification, toCommits } from './commands';

const CHANNEL = `wdom${Date.now()}`;

export class EntityDS extends DataSource {
	constructor(private client: Redis) {
		super();
	}

	private context: any;
	private subscriber: Redis = this.client.duplicate();
	private ready: boolean = false;
	private lastPos: number = -1;

	// Snapshots
	private players: Record<string, Player> = {};
	private games: Record<string, Game> = {};
	private errors: Record<string, Errors> = {};

	isReady() {
		return this.ready;
	}

	initialize(config: any) {
		this.context = config.context;

		this.subscriber.on('message', (channel, message) => {
			try {
				const noti = JSON.parse(message);
				if (isNotification(noti)) {
					this.client.zrangebyscore(
						channel, (this.lastPos >= 0) ? this.lastPos : '-inf', noti.timestamp, 'WITHSCORES', (error, result) => {
							if (error) {
								console.log(`[EntitiesDS.subscriber.on - message]: ${error}`);
							} else {
								const incomings = toCommits('[EntitiesDS.subscriber.on - message]', result);
								const { players, games, errors } = reducer(incomings, { players: this.players, games: this.games, errors: this.errors });
								this.players = players;
								this.games = games;
								this.errors = errors;
							}
						}
					);
					this.lastPos = noti.timestamp + 1;
				}
			} catch (error) {
				console.log(`[EntitiesDS.initialize] parse error: ${error}`);
			}
		});

		this.subscriber.subscribe(CHANNEL, (error, count) => {
			if (error) {
				console.log(`[EntitiesDS.initialize] subscribing to ${CHANNEL} failed: ${JSON.stringify(error)}`);
			} else if (count <= 0) {
				console.log(`[EntitiesDS.initialize] subscribing to ${CHANNEL} failed, total number of subscribers is ${count}`);
			} else {
				this.ready = true;
			}
		});
	}

	shutdown() {
		this.subscriber.unsubscribe(CHANNEL);
		this.subscriber.quit();
	}
}
