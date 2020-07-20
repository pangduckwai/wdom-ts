
export * from './data-src';

export const CHANNEL = `wdom${Date.now()}`;

export const isEmpty = (obj: any) =>
	obj ? !Object.values(obj).some(value => (value !== null) && (typeof value !== 'undefined')) : true;
