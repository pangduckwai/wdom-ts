import { Redis } from 'ioredis';

export type CommandContext = {
  client: Redis;
  channel: string;
};
