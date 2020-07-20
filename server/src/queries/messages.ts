import { Redis } from 'ioredis';

export enum MessageType {
	Message,
	Error
};

export interface Message {
	commitId: string;
	type: MessageType;
	name?: string;
	message: string;
	timestamp?: number;
};

export const MessageSnapshot = {
	put: async (client: Redis, channel: string, message: Message): Promise<Message> => {
		return new Promise<Message>(async (resolve, reject) => {
			const timestamp = Date.now();
			// TODO: what about index for search by commit ID?
			const count = await client.zadd(`${channel}:Message`, timestamp, JSON.stringify(message));
			if (count === 1) {
				message.timestamp = timestamp;
				resolve(message);
			} else if (count === 0) {
				reject(new Error(`[MessageSnapshot] Message ${JSON.stringify(message)} already exists`)); // Should NOT happen
			} else {
				reject(new Error(`[MessageSnapshot] Unknown error when writing message (${count})`));
			}
		});
	},
	get: async (client: Redis, channel: string, { token, name }: {token?: string; name?: string }
	): Promise<Message> => {
		return new Promise<Message>(async (resolve, reject) => {
		});
	}
};