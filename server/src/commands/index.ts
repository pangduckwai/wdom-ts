import crypto from 'crypto';
import { Redis } from 'ioredis';

export * from './events';
export * from './commands';
export * from './commits';
// export * from './schema';
// export * from './service';

export const generateToken = () =>
	crypto.createHash('sha256').update(crypto.randomBytes(16).toString('hex')).digest('base64');

export type CommandContext = {
	client: Redis;
	channel: string;
	sessionid?: string;
};

export interface Notification {
	id: string;
	index: number;
}

export const isNotification = (variable: any): variable is Notification => {
	const val = variable as Notification;
	return (val.id !== undefined) &&
		(val.index !== undefined);
}

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
