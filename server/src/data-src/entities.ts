import { DataSource } from 'apollo-datasource';
import { Redis } from 'ioredis';
import { Commit, isCommit } from '../model';
import { CHANNEL } from '.';

export class EntitiesDS extends DataSource {
  private context: any;
  private ready: boolean = false;

	constructor(private client: Redis) {
    super();
	}

	initialize(config: any) {
		this.context = config.context;

    this.client.on('message', (channel, message) => {
      // Process incoming commit
      console.log('subscriber on message', channel, message);
    });

    this.client.subscribe(CHANNEL, (error, count) => {
      if (error) {
        console.log(`[EntitiesDS.initialize] subscribing to ${CHANNEL} failed: ${JSON.stringify(error)}`);
      } else if (count <= 0) {
        console.log(`[EntitiesDS.initialize] subscribing to ${CHANNEL} failed, total number of subscribers is ${count}`);
      } else {
        this.ready = true;
      }
    });
  }
}