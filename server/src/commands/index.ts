import { Snapshot } from '../queries';
import { CommitStore, Commands } from '.';

export * from './events';
export * from './commands';
export * from './commits';
export * from './schema';
export * from './service';

export type CommandContext = {
	snapshot: Snapshot;
	commands: Commands;
	commitStore: CommitStore;
	sessionId?: string;
};

// export type BaseCommands<T> = {
// 	[C in keyof T]: (command: T[C]) => Promise<Commit>;
// }
