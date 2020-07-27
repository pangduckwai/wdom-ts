
export * from './data-src';

export const CHANNEL = `wdom${Date.now()}`;

export const isEmpty = (obj: any) =>
	obj ? !Object.values(obj).some(value => (value !== null) && (typeof value !== 'undefined')) : true;

export const deserialize = <T>(tag: string, str: string, typeGuard: (x: any) => x is T) => {
	const result: any = JSON.parse(str);
	if (typeGuard(result))
		return result as T;
	else
		throw new Error(`${tag} Unknown object type ${str}`);
};
