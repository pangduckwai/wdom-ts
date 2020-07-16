require('dotenv').config();
import { ApolloServer } from 'apollo-server';
import RedisClient, { Redis } from 'ioredis';
import { CHANNEL } from '.';
import { CommandContext, schema } from './commands';

const redisHost = process.env.REDIS_HOST;
const redisPort = (process.env.REDIS_PORT || 6379) as number;
const port = process.env.COMMANDS_PORT || 4000;

const shutdown = async (client: Redis, server: ApolloServer) => {
	client.quit()
		.then(value => {
			console.log(`Redis disconnected ${value}`);
		})
		.catch((err) => {
			console.log(`Error ${err} while disconnecting Redis`);
		})

	server.stop()
		.then(() => {
			console.log(`Service stopped`);
			process.exit(0);
		})
		.catch((err) => {
			console.log(`Error ${err} while shutting down`);
			process.exit(1);
		});
};

(async () => {
	const client: Redis = new RedisClient({
		host: redisHost,
		port: redisPort,
		retryStrategy: (times) => {
			if (times > 3) { // the 4th return will exceed 10 seconds, based on the return value...
				console.log(`Redis: connection retried ${times} times, exceeded 10 seconds.`);
				process.exit(-1);
			}
			return Math.min(times * 100, 3000); // reconnect after (ms)
		},
		reconnectOnError: (err) => {
			const targetError = 'READONLY';
			if (err.message.includes(targetError)) {
				// Only reconnect when the error contains "READONLY"
				return true;
			} else
				return false;
		},
	});

	client.on('error', (err) => {
		console.log(`Redis Error: ${err}`);
	});
	
	client.on('connect', () => {
		console.log('Redis client connected.');
	});

	const service = new ApolloServer({
		context: async ({ req }) => {
			const context: CommandContext = {
				channel: CHANNEL,
				client
			};
			const auth = (req.headers && req.headers.authorization) ? req.headers.authorization : null;
			if (auth) {
				context.sessionid = auth;
			}
			return context;
		},
		schema,
	});

	process.on('SIGINT', async () => await shutdown(client, service));
	process.on('SIGTERM', async () => await shutdown(client, service));
	process.on('uncaughtException', (err) => {
		console.log('Uncaught Exception', err, err.stack);
	});

	service.listen({ port })
		.then(({ url }) => {
			if ((process.env.NODE_ENV === 'production') && process.send)
				process.send('ready');
			console.log(`🚀 WDOM Commands Service started at ${url}`);
		});
})().catch(error => {
	console.error(error);
	process.exit(1);
});
