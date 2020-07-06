
export const CHANNEL = `wdom${Date.now()}`;

export const CHANNEL_IDX = `${CHANNEL}idx`;
export const CHANNEL_PLAYER = `${CHANNEL}ply`;
export const CHANNEL_GAME = `${CHANNEL}gam`;

export interface Notification {
	id: string;
	timestamp: number;
}

export const isNotification = (variable: any): variable is Notification => {
	const val = variable as Notification;
	return (val.id !== undefined) &&
		(val.timestamp !== undefined);
}

export * from './commits';
