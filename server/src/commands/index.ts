import { Redis } from 'ioredis';

export * from './events';
export * from './commands';
export * from './commits';
export * from './schema';
export * from './service';

export const BusyTimeout = 900;

export type CommandContext = {
	client: Redis;
	channel: string;
	sessionid?: string;
};

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
