import { DataSource } from 'apollo-datasource';
import { Redis } from 'ioredis';
import { Commit, isCommit } from '../model';
import { CHANNEL, isNotification, Notification } from '.';

export class EntitiesDS extends DataSource {
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

		this.subscriber.on('message', (channel, message) => {
			try {
				const noti = JSON.parse(message);
				if (isNotification(noti)) {
					reducer(this.client, channel, noti, this.lastPos);
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

const reducer = async (client: Redis, channel: string, notification: Notification, lastPosition: number) => {
	const incomings = await (await client.zrangebyscore(channel, (lastPosition >= 0) ? lastPosition : '-inf', notification.timestamp)).map(str => {
		try {
			const incoming = JSON.parse(str);
			if (isCommit(incoming))
				return incoming;
			else
				return new Error(`Unknow type ${str}`);
		} catch (error) {
			return error;
		}
	});
}
