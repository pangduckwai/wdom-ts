require('dotenv').config();
import crypto from 'crypto'; 
import RedisClient, { Redis } from 'ioredis';
import { CHANNEL } from '..';

const generateToken = (timestamp: number) =>
	crypto.createHash('sha256').update('' + (timestamp + Math.floor(Math.random()*10000))).digest('base64');

interface TestObj {
	id: string;
	name: string;
	timestamp: number;
	runs: number;
	details: string[];
}

const NUMS = 9;
const RUNS = 5000;
const INTV = 1000;
const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const error_s: any[] = [];
const error_c: any[] = [];
const error_l: any[] = [];
let publisher: Redis;
let mark_s0 = 0;
let mark_s1 = 0;
let mark_c0 = 0;
let mark_c1 = 0;
let mark_l0 = 0;
let mark_l1 = 0;

const start = async () => {
	publisher = new RedisClient({ host, port });
	await new Promise((resolve) => setTimeout(() => resolve(), 100));
	return true;
};

const stop = async () => {
	await publisher.quit();
	return new Promise((resolve) => setTimeout(() => {
		const report = 
			`Speed test of channel ${CHANNEL} finished\n` +
			`Stringify - read: ${Math.round(mark_s0 / NUMS)}; all: ${Math.round(mark_s1 / NUMS)} (${JSON.stringify(error_s)})\n` +
			`Client    - read: ${Math.round(mark_c0 / NUMS)}; all: ${Math.round(mark_c1 / NUMS)} (${JSON.stringify(error_c)})\n` +
			`Lua script- read: ${Math.round(mark_l0 / NUMS)}; all: ${Math.round(mark_l1 / NUMS)} (${JSON.stringify(error_l)})\n`;
		console.log(report);
		resolve();
	}, 1000));
};

// Redis speed test: stringify
// write serialized object to Redis
const test_s = async () => {
	const start = Date.now();
	const details: string[] = [];

	for (let idx = 0; idx < RUNS; idx ++) {
		const timestamp = Date.now();
		if ((idx % INTV) === 0) details.push(`details ${idx}`);
		const obj: TestObj = {
			id: generateToken(timestamp),
			name: `object-s-${idx}`,
			timestamp,
			runs: idx + 1,
			details
		}
		// HERE >>>
		const rtn = await publisher.rpush(`${CHANNEL}:S`, JSON.stringify(obj));
		// <<< HERE
		if (rtn <= 0) error_s.push({ index: idx, type: 0, rtn });
	}

	mark_s0 += Date.now() - start;

	for (let idx = 0; idx < RUNS; idx ++) {
		// HERE >>>
		const rst = await publisher.lrange(`${CHANNEL}:S`, idx, idx);
		const obj = JSON.parse(rst[0]);
		// <<< HERE
		if (obj.runs !== (idx + 1)) error_s.push({ index: idx, type: 1, rst });
	}

	mark_s1 += Date.now() - start;
	publisher.expire(`${CHANNEL}:S`, 599);
	return true;
};

// Redis speed test: client __
// write object as hash to Redis __
const test_c = async () => {
	const start = Date.now();
	const details: string[] = [];

	for (let idx = 0; idx < RUNS; idx ++) {
		const timestamp = Date.now();
		if ((idx % INTV) === 0) details.push(`details ${idx}`);
		const obj: TestObj = {
			id: generateToken(timestamp),
			name: `object-c-${idx}`,
			timestamp,
			runs: idx + 1,
			details
		}
		// HERE >>>
		let rtn = 0;
		if (await publisher.hset(`${CHANNEL}:C:${idx}`, 'id', obj.id) >= 0) rtn ++;
		if (await publisher.hset(`${CHANNEL}:C:${idx}`, 'name', obj.name) >= 0) rtn ++;
		if (await publisher.hset(`${CHANNEL}:C:${idx}`, 'timestamp', obj.timestamp) >= 0) rtn ++;
		if (await publisher.hset(`${CHANNEL}:C:${idx}`, 'runs', obj.runs) >= 0) rtn ++;
		if (await publisher.hset(`${CHANNEL}:C:${idx}`, 'detailsCnt', details.length) >= 0) rtn ++;
		for (let j = 0; j < details.length; j ++) {
			if (await publisher.hset(`${CHANNEL}:C:${idx}`, `details${j}`, details[j]) >= 0) rtn ++;
		}
		// <<< HERE
		if (rtn !== (5 + details.length)) error_c.push({ index: idx, type: 0, rtn });
	}

	mark_c0 += Date.now() - start;

	for (let idx = 0; idx < RUNS; idx ++) {
		// HERE >>>
		const dtls: string[] = [];
		const rst = await publisher.hgetall(`${CHANNEL}:C:${idx}`);
		for (let k = 0; k < parseInt(rst.detailsCnt, 10); k ++) {
			dtls.push(rst[`details${k}`]);
		}
		const obj = {
			id: rst.id,
			name: rst.name,
			timestamp: parseInt(rst.timestamp, 10),
			runs: parseInt(rst.runs),
			details: dtls
		};
		// <<< HERE
		if (obj.runs !== (idx + 1)) error_c.push({ index: idx, type: 1, rst });
	}

	mark_c1 += Date.now() - start;
	for (let idx =0; idx < RUNS; idx ++) {
		publisher.expire(`${CHANNEL}:C:${idx}`, 599);
	}
	return true;
};

const lua = `
local rst = 0
local idx = 6
if redis.call("hset", KEYS[1], "id", ARGV[2]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "name", ARGV[3]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "timestamp", ARGV[4]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "runs", ARGV[5]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "detailsCnt", ARGV[1]) >= 0 then rst = rst + 1 end
for i = 1, ARGV[1] do
	if redis.call("hset", KEYS[1], "details" .. i, ARGV[idx]) >= 0 then
		rst = rst + 1
	end
	idx = idx + 1
end
return rst
`;

// Redis speed test: lua _____
// write object via lua to Redis __
const test_l = async () => {
	const start = Date.now();
	const details: string[] = [];

	for (let idx = 0; idx < RUNS; idx ++) {
		const timestamp = Date.now();
		if ((idx % INTV) === 0) details.push(`details ${idx}`);
		const obj: TestObj = {
			id: generateToken(timestamp),
			name: `object-l-${idx}`,
			timestamp,
			runs: idx + 1,
			details
		}
		// HERE >>>
		const rtn = await publisher.eval(lua, 1, [
			`${CHANNEL}:L:${idx}`,
			details.length,
			obj.id, obj.name, obj.timestamp, obj.runs, ...details
		]);
		// <<< HERE
		if (rtn <= 0) error_l.push({ index: idx, type: 0, rtn });
	}

	mark_l0 += Date.now() - start;

	for (let idx = 0; idx < RUNS; idx ++) {
		// HERE >>>
		const dtls: string[] = [];
		const rst = await publisher.hgetall(`${CHANNEL}:L:${idx}`);
		for (let k = 0; k < parseInt(rst.detailsCnt, 10); k ++) {
			dtls.push(rst[`details${k}`]);
		}
		const obj = {
			id: rst.id,
			name: rst.name,
			timestamp: parseInt(rst.timestamp, 10),
			runs: parseInt(rst.runs),
			details: dtls
		};
		// <<< HERE
		if (obj.runs !== (idx + 1)) error_l.push({ index: idx, type: 1, rst });
	}

	mark_l1 += Date.now() - start;
	for (let idx =0; idx < RUNS; idx ++) {
		publisher.expire(`${CHANNEL}:L:${idx}`, 599);
	}
	return true;
};

(async () => {
	if (await start()) {
		try {
			for (let i = 0; i < NUMS; i ++) {
				switch (i % 3) {
					case 0:
						console.log(`Running stringify test ${i}`);
						if (!await test_s()) throw new Error('Stringify test failed');
						console.log(`Running client test ${i}`);
						if (!await test_c()) throw new Error('Client test failed');
						console.log(`Running lua test ${i}`);
						if (!await test_l()) throw new Error('Lua test failed');
						break;
					case 1:
						console.log(`Running client test ${i}`);
						if (!await test_c()) throw new Error('Client test failed');
						console.log(`Running lua test ${i}`);
						if (!await test_l()) throw new Error('Lua test failed');
						console.log(`Running stringify test ${i}`);
						if (!await test_s()) throw new Error('Stringify test failed');
						break;
					case 2:
						console.log(`Running lua test ${i}`);
						if (!await test_l()) throw new Error('Lua test failed');
						console.log(`Running stringify test ${i}`);
						if (!await test_s()) throw new Error('Stringify test failed');
						console.log(`Running client test ${i}`);
						if (!await test_c()) throw new Error('Client test failed');
						break;
				}
			}
		} catch (error) {
			console.log(error);
		} finally {
			await stop();
		}
	}
})();
