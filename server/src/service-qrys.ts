require('dotenv').config();
import { getChannel } from '.';
import { queryService } from './queries';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = (process.env.REDIS_PORT || 6379) as number;
const servicePort = (process.env.QUERIES_PORT || 4000) as number;

const channel = getChannel(process.argv[2]);

(async () => {
	const { start, stop } = await queryService({ channel, redisHost, redisPort, servicePort});
  process.on('SIGINT', async () =>
    await stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1)));
  process.on('SIGTERM', async () =>
    await stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1)));
	process.on('uncaughtException', (err) => {
		console.log('Uncaught Exception', err, err.stack);
	});

	start()
		.then(({ url }) => {
			process.send?.('ready'); // (process.env.NODE_ENV === 'production')
			console.log(`🚀 WDOM Queries Service started at  ${url} with channel ${channel}`);
		});
})().catch(error => {
	console.error(error);
	process.exit(1);
});
