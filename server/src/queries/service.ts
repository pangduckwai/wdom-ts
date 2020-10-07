import { ApolloServer, ServerInfo } from 'apollo-server';
import RedisClient, { Redis } from 'ioredis';
import { buildDeck, buildMap, buildWorld } from '../rules';
import { getSnapshot, getSubscriptions, QueryContext, schema } from '.';

// =================================
// === Starting Query Service ===
export const queryService: (args: {
	channel: string;
	redisHost: string;
	redisPort: number;
	servicePort: number;
}) => Promise<{
	start: () => Promise<ServerInfo>;
	stop: () => Promise<void>
}> = async ({
	channel, redisHost, redisPort, servicePort
}) => {
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
		console.log('Redis client connected');
	});

	const subscriptions = getSubscriptions(client, buildWorld(), buildMap(), buildDeck());
	const snapshot = getSnapshot(channel, client);

	const service = new ApolloServer({
		context: async ({ req }) => {
			const context: QueryContext = {
				snapshot
			};
			const auth = (req.headers && req.headers.authorization) ? req.headers.authorization : null;
			if (auth) {
				context.sessionId = auth;
			}
			return context;
		},
		schema,
	});

	return {
		start: async () => {
			await subscriptions.start(channel);
			return service.listen({ port: servicePort })
		},
		stop: async () => {
			return new Promise<void>(async (resolve, reject) => {
				await subscriptions.stop(channel)
					.then(_ => {
						console.log('Subscription stopped');
					})
					.catch((err) => {
						console.log(`Error ${err} while stopping subscription`);
					});

				await client.quit()
					.then(result => {
						console.log(`Redis disconnected ${result}`);
					})
					.catch((err) => {
						console.log(`Error ${err} while disconnecting Redis`);
					});

				await service.stop()
					.then(() => {
						console.log(`Command service stopped`);
						resolve();
					})
					.catch((err) => {
						console.log(`Error ${err} while shutting down`);
						reject();
					});
			});
		}
	};
};
