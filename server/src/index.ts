import crypto from 'crypto';

export const getChannel = (variable: string) => {
	return `wdom${variable}`;
};

export const isEmpty = (obj: any) =>
	obj ? !Object.values(obj).some(value => (value !== null) && (typeof value !== 'undefined')) : true;

export const deserialize = <T>(tag: string, str: string, typeGuard: (x: any) => x is T) => {
	const result: any = JSON.parse(str);
	if (typeGuard(result))
		return result as T;
	else
		throw new Error(`${tag} Unknown object type ${str}`);
};

export const generateToken = (len = 16) =>
	crypto.createHash('sha256').update(crypto.randomBytes(len).toString('hex')).digest('base64');

export const FLAG_SHIFT = 1; // 0001
export const FLAG_ALT = 2;   // 0010
export const FLAG_CTRL = 4;  // 0100

export enum Status {
  Deleted, New, Ready, Defeated, Finished
};
