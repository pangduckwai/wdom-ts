import crypto from 'crypto';
import { Redis } from 'ioredis';

export * from './events';
export * from './commands';
export * from './commits';
// export * from './schema';
// export * from './service';

export const generateToken = (timestamp: number) =>
	crypto.createHash('sha256').update('' + (timestamp + Math.floor(Math.random()*10000))).digest('base64');

export type CommandContext = {
	client: Redis;
	channel: string;
	sessionid?: string;
};

export interface Notification {
	id: string;
	timestamp: number;
}

export const isNotification = (variable: any): variable is Notification => {
	const val = variable as Notification;
	return (val.id !== undefined) &&
		(val.timestamp !== undefined);
}

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
