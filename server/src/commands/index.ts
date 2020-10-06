import { Redis } from 'ioredis';
import { Commands } from '.';

export * from './events';
export * from './commands';
export * from './commits';
export * from './schema';
export * from './service';

export const BusyTimeout = 900;

export type CommandContext = {
	client: Redis;
	channel: string;
	commands: Commands;
	sessionid?: string;
};

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
