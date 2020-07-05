require('dotenv').config();
import RedisClient, { Redis } from 'ioredis';
import { Commands, DEFAULT_TOPIC, EventDs } from '../model';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
let publisher: Redis;
let subscriber: Redis;
let dataSrc: EventDs;
const mockInSubscriber = jest.fn();

beforeAll(async () => {
	publisher = new RedisClient({ host, port });

	subscriber = new RedisClient({ host, port });
	subscriber.on('message', (channel, message) => {
		console.log(`Subscribed: ${channel} - ${message}`);
		mockInSubscriber(channel, message);
	});

	await new Promise((resolve) => setTimeout(() => resolve(), 100));
	dataSrc = new EventDs(publisher);
});

afterAll(async () => {
	subscriber.quit();
	publisher.quit();
	return new Promise((resolve) => setTimeout(() => resolve(), 1000));
});

describe('Unit Test', () => {
	it('connect to redis', async () => {
		await publisher.incr(`counter${timestamp}`);
		await publisher.incr(`counter${timestamp}`);
		await publisher.incr(`counter${timestamp}`);
		await publisher.decr(`counter${timestamp}`);
		const result = await publisher.get(`counter${timestamp}`);
		expect(result).toEqual('2');
	});

	it('write a commit to redis', async () => {
		const commit = await Commands.RegisterPlayer({ playerName: 'paul' });

		mockInSubscriber.mockImplementation((channel, message) => {
			// expect(channel).toEqual(DEFAULT_TOPIC);
			expect(JSON.parse(message)).toEqual(commit.id);
		});

		subscriber.subscribe(DEFAULT_TOPIC);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		await dataSrc.write(commit);
	});
});