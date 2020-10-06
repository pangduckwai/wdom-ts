
export enum MessageType {
	Message,
	Error
};

export interface Message {
	commitId: string;
	type: MessageType;
	eventName: string;
	message: string;
	timestamp?: number;
};

export const isMessage = (variable: any): variable is Message => {
	const val = variable as Message;
	return (val.commitId !== undefined) &&
		(val.type !== undefined) &&
		(val.message !== undefined);
};

export const buildMessage = (
	commitId: string,
	type: MessageType,
	eventName: string,
	message: string,
): Message => {
	const result: Message = {
		commitId, type, eventName, message
	};
	return result;
}
