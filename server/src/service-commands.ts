// require('dotenv').config();
// import { CHANNEL } from '.';
// import { commandService } from './commands';

// const redisHost = process.env.REDIS_HOST || 'localhost';
// const redisPort = (process.env.REDIS_PORT || 6379) as number;
// const servicePort = (process.env.COMMANDS_PORT || 4000) as number;

// (async () => {
// 	const { start, stop } = await commandService({ channel: CHANNEL, redisHost, redisPort, servicePort});
// 	process.on('SIGINT', async () => process.exit(await stop()));
// 	process.on('SIGTERM', async () => process.exit(await stop()));
// 	process.on('uncaughtException', (err) => {
// 		console.log('Uncaught Exception', err, err.stack);
// 	});

// 	start()
// 		.then(({ url }) => {
// 			if ((process.env.NODE_ENV === 'production') && process.send)
// 				process.send('ready');
// 			console.log(`🚀 WDOM Commands Service started at ${url}`);
// 		});
// })().catch(error => {
// 	console.error(error);
// 	process.exit(1);
// });
