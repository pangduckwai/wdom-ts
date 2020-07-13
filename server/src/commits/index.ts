import crypto from 'crypto';

export * from './events';
export * from './commands';
export * from './store';

export const generateToken = (timestamp: number) =>
	crypto.createHash('sha256').update('' + (timestamp + Math.floor(Math.random()*10000))).digest('base64');

// ============================
// === Event Sourcing types ===
export interface BaseEvent {
	readonly type: string;
	payload: any;
}

export interface Commit {
	id: string;
	version: number;
	events: BaseEvent[];
	timestamp?: number;
}

export interface Notification {
	id: string;
	timestamp: number;
}

export const isNotification = (variable: any): variable is Notification => {
	const val = variable as Notification;
	return (val.id !== undefined) &&
		(val.timestamp !== undefined);
}

export const isCommit = (variable: any): variable is Commit => {
	const val = variable as Commit;
	return (val.id !== undefined) &&
		(val.version !== undefined) &&
		(val.events && (val.events.length > 0));
}

export const toCommit = (tag: string, str: string) => {
	const result = JSON.parse(str);
	if (isCommit(result))
		return result as Commit;
	else
		throw new Error(`${tag} Unknown object type ${str}`);
}

export const toCommits = (tag: string, values: string[]) => {
	if ((values.length % 2) !== 0) {
		throw new Error(`${tag} Invalid format in incoming data`);
	}

	const results: Commit[] = [];
	for (let idx = 0; idx < values.length; idx += 2) {
		const score = parseInt(values[idx + 1], 10);
		if (score === NaN) {
			throw new Error(`${tag} Invalid format in scores ${idx} - ${values[idx + 1]}`);
		}

		const commit = toCommit(tag, values[idx]);
		commit.timestamp = score;
		results.push(commit);
	}
	return results;
}
// ============================

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
