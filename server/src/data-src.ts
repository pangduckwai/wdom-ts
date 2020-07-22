import { DataSource } from 'apollo-datasource';
import { Redis } from 'ioredis';
import { isNotification, toCommits } from './commands';
import { Game, Player, reducer, PlayerSnapshot, GameSnapshot } from './queries';
import { buildDeck, buildMap } from './rules';
import { CHANNEL } from '.';

export class EntityDS extends DataSource {
	constructor(private client: Redis) {
		super();
	}

	private context: any;
	private subscriber: Redis = this.client.duplicate();
	private ready: boolean = false;
	private lastPos: number = -1;

	isReady() {
		return this.ready;
	}

	initialize(config: any) {
		this.context = config.context;

		const map = buildMap();
		const deck = buildDeck();

		this.subscriber.on('message', async (channel, message) => {
			try {
				const noti = JSON.parse(message);
				if (isNotification(noti)) {
					const playerList = await PlayerSnapshot(this.client, map, deck).list(channel);
					const gameList = await GameSnapshot(this.client, deck).list(channel);

					this.client.zrangebyscore(
						channel, (this.lastPos >= 0) ? this.lastPos : '-inf', noti.timestamp, 'WITHSCORES', (error, result) => {
							if (error) {
								console.log(`[EntityDS.subscriber.on - message]: ${error}`);
							} else {
								const incomings = toCommits('[EntityDS.subscriber.on - message]', result);
								const { players, games, messages } = reducer(deck)(incomings, { players: playerList, games: gameList });
							}
						}
					);
					this.lastPos = noti.timestamp + 1;
				}
			} catch (error) {
				console.log(`[EntityDS.initialize] parse error: ${error}`);
			}
		});

		this.subscriber.subscribe(CHANNEL, (error, count) => {
			if (error) {
				console.log(`[EntityDS.initialize] subscribing to ${CHANNEL} failed: ${JSON.stringify(error)}`);
			} else if (count <= 0) {
				console.log(`[EntityDS.initialize] subscribing to ${CHANNEL} failed, total number of subscribers is ${count}`);
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
