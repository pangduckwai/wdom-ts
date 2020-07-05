import crypto from 'crypto';

export interface BaseEvent {
	readonly type: string;
	payload: any;
}

export interface Commit {
	id: string;
	timestamp: number;
	version: number;
	events: BaseEvent[];
}

export const isCommit = (variable: any): variable is Commit => {
	const val = variable as Commit;
	return (val.id !== undefined) &&
		(val.timestamp !== undefined) &&
		(val.version !== undefined) &&
		(val.events && (val.events.length > 0));
}

export const generateToken = (timestamp: number) =>
	crypto.createHash('sha256').update('' + (timestamp + Math.floor(Math.random()*10000))).digest('base64');

export * from './events';
export * from './commands';
export * from './source';

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
