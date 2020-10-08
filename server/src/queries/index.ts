import { Message, Snapshot } from '.';

export * from './messages';
export * from './reducer';
export * from './snapshot';
export * from './subscriptions';
export * from './schema';
export * from './service';

export type QueryContext = {
  snapshot: Snapshot;
  messages: (commitId?: string) => Promise<Message[]>
  sessionId?: string;
};
