import { Redis } from 'ioredis';

export enum MessageType {
	Message,
	Error
};

export interface Message {
	commitId: string;
	type: MessageType;
	eventName: string;
	message: string;
	timestamp?: number;
};

export const isMessage = (variable: any): variable is Message => {
	const val = variable as Message;
	return (val.commitId !== undefined) &&
		(val.type !== undefined) &&
		(val.message !== undefined);
};

export const buildMessage = (
	commitId: string,
	type: MessageType,
	eventName: string,
	message: string,
): Message => {
	const result: Message = {
		commitId, type, eventName, message
	};
	return result;
}

// const toMessage = (value1: string, value2: string) => {
// 	const score = parseInt(value2, 10);
// 	if (score === NaN) {
// 		throw new Error(`[MessageSnapshot] Invalid format in scores ${value2}`);
// 	}

// 	const message = JSON.parse(value1);
// 	if (!isMessage(message)) throw new Error(`[MessageSnapshot] Unknown object type ${value1}`);
// 	message.timestamp = score;
// 	return message;
// };

// const toMessages = (values: string[]) => {
// 	if ((values.length % 2) !== 0) {
// 		throw new Error(`[MessageSnapshot] Invalid format in incoming data`);
// 	}

// 	const results: Message[] = [];
// 	for (let idx = 0; idx < values.length; idx += 2) {
// 		const score = parseInt(values[idx + 1], 10);
// 		if (score === NaN) {
// 			throw new Error(`[MessageSnapshot] Invalid format in scores ${idx} - ${values[idx + 1]}`);
// 		}

// 		// const message = toCommit(tag, values[idx]);
// 		const message = JSON.parse(values[idx]);
// 		if (!isMessage(message)) throw new Error(`[MessageSnapshot] Unknown object type ${idx} - ${values[idx]}`);

// 		message.timestamp = score;
// 		results.push(message);
// 	}
// 	return results;
// };

// // KEYS[1] - Message
// // KEYS[2] - Message Index
// // ARGV[1] - timestamp (as score)
// // ARGV[2] - stringified message
// // ARGV[3] - commit id
// const put = `
// local count = redis.call("zadd", KEYS[1], ARGV[1], ARGV[2])
// if count == 1 then
//   local idx = redis.call("zrank", KEYS[1], ARGV[2])
// 	if idx then
// 		local prev = redis.call("hget", KEYS[2], ARGV[3])
// 		if prev then
// 			if redis.call("hset", KEYS[2], ARGV[3], prev .. ',' .. idx) >= 0 then
// 				return "OK"
// 			else
// 				return redis.error_reply("[MessageSnapshot] error appending message index")
// 			end
// 		else
// 			if redis.call("hset", KEYS[2], ARGV[3], idx) >= 0 then
// 				return "OK"
// 			else
// 				return redis.error_reply("[MessageSnapshot] error adding message index")
// 			end
// 		end
// 	else
// 		return redis.error_reply("[MessageSnapshot] message index sorted-set corrupted")
// 	end
// else
// 	if count == 0 then
// 		return redis.error_reply("[MessageSnapshot] message " .. ARGV[2] .. " already exists")
// 	else
// 		return redis.error_reply("[MessageSnapshot] unknown error when writing message (".. count .. ")")
// 	end
// end`;

// export const MessageSnapshot = {
// 	put: (client: Redis, channel: string, message: Message): Promise<Message> => {
// 		return new Promise<Message>(async (resolve, reject) => {
// 			const timestamp = Date.now();
// 			try {
// 				const result = await client.eval(put, 2, [
// 					`${channel}:Message`,
// 					`${channel}:Message:Idx`,
// 					timestamp,
// 					JSON.stringify(message), message.commitId
// 				]);
// 				if (result === 'OK') {
// 					message.timestamp = timestamp;
// 					resolve(message);
// 				} else {
// 					reject(new Error(result));
// 				}
// 			} catch (error) {
// 				reject(error);
// 			}
// 		});
// 	},
// 	get: (client: Redis, channel: string, args?: {
// 		commitId?: string;
// 		fromTime?: number;
// 		toTime?: number;
// 	}): Promise<Message[]> => {
// 		return new Promise<Message[]>(async (resolve, reject) => {
// 			const { commitId, fromTime, toTime } = args ? args : { commitId: undefined, fromTime: undefined, toTime: undefined };
// 			if (commitId) {
// 				const str = await client.hget(`${channel}:Message:Idx`, commitId);
// 				if (str) {
// 					try {
// 						const indices = JSON.parse(`[${str}]`);
// 						const msgs: Message[] = [];
// 						for (const idx of indices) {
// 							const values = await client.zrange(`${channel}:Message`, idx, idx, 'WITHSCORES');
// 							if (values.length != 2) {
// 								throw new Error(`[MessageSnapshot] invalid data retrieved at position ${idx}`);
// 							} else {
// 								msgs.push(toMessage(values[0], values[1]));
// 							}
// 						}
// 						resolve(msgs);
// 					} catch (error) {
// 						reject(new Error(error));
// 					}
// 				} else {
// 					reject(new Error(`[MessageSnapshot] Commit ID ${commitId} not found in message index`));
// 				}
// 			} else {
// 				try {
// 					resolve(toMessages(
// 						await client.zrangebyscore(`${channel}:Message`,
// 							fromTime ? fromTime : '-inf',
// 							toTime ? toTime : '+inf',
// 							'WITHSCORES')
// 					));
// 				} catch (error) {
// 					reject(error);
// 				}
// 			}
// 		});
// 	}
// };
