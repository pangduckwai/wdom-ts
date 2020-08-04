import { BaseEvent, deserialize, generateToken } from '.';

export interface Notification {
	id: string;
	index: number;
}

export const isNotification = (variable: any): variable is Notification => {
	const val = variable as Notification;
	return (val.id !== undefined) &&
		(val.index !== undefined);
}

export interface Commit {
	id: string;
	version: number;
	events: BaseEvent[];
	timestamp?: number;
};

export const isCommit = (variable: any): variable is Commit => {
	const val = variable as Commit;
	return (val.id !== undefined) &&
		(val.version !== undefined) &&
		(val.events && (val.events.length > 0));
};

export const toCommits = (tag: string, values: string[]) => {
	const results: Commit[] = [];
	for (const value of values) {
		const commit = deserialize(tag, value, isCommit);
		results.push(commit);
	}
	return results;
};

export const createCommit = () => {
	const commit: Commit = {
		id: generateToken(),
		version: 0,
		events: []
	};

	const build = (): Commit => {
		if (commit.events.length < 1)  throw new Error('[createCommit] Invalid parameter(s)');
		return commit;
	}

	const addEvent = <E extends BaseEvent>(event: E) => {
		commit.events.push(event);
		return {
			build,
			addEvent
		};
	}

	return { addEvent };
};
