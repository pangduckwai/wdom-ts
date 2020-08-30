import { Territories } from '..';

export enum CardTypes {
	Wildcard,
	Artillery,
	Cavalry,
	Infantry
};

export const WildCards = [
	'Wildcard-1',
	'Wildcard-2'
] as const;
export type WildCards = typeof WildCards[number];

export interface Card {
	name: Territories | WildCards;
	type: CardTypes;
};

const rand = [
	37,  1, 36, 12, 15, 37, 37, 21, 21, 29, 13,  2,  9,  2,
	 7, 15, 13, 21, 15,  1,  7,  1,  1,  6,	 0,  5,  8,  0,
	 5, 13, 12,  4,  2, 10,  3,	 6,  0,  1,  2,  2,  0,  1,
	 0,  0
];
export const shuffle = <K extends string, V>(source: Record<K, V>): V[] => {
	return _shuffle(Object.values(source));
};
export const _shuffle = <T>(list: T[]): T[] => {
	let size = list.length;
	let cnt = rand.length - size;
	if (cnt < 0) return list;
	while (size > 0) {
		size --;
		const indx = rand[cnt ++]; // Math.floor(Math.random() * size);
		const frst = list[0];
		list[0] = list[indx];
		list[indx] = frst;
	}
	return list;
};

export const buildDeck = (): Record<WildCards | Territories, Card> => {
	return {
		['Wildcard-1']: {
			name: 'Wildcard-1', type: CardTypes.Wildcard
		},
		['Wildcard-2']: {
			name: 'Wildcard-2', type: CardTypes.Wildcard
		},
		['Congo']: {
			name: 'Congo', type: CardTypes.Artillery
		},
		['East-Africa']: {
			name: 'East-Africa', type: CardTypes.Infantry
		},
		['Egypt']: {
			name: 'Egypt', type: CardTypes.Cavalry
		},
		['Madagascar']: {
			name: 'Madagascar', type: CardTypes.Cavalry
		},
		['North-Africa']: {
			name: 'North-Africa', type: CardTypes.Infantry
		},
		['South-Africa']: {
			name: 'South-Africa', type: CardTypes.Artillery
		},
		['Afghanistan']: {
			name: 'Afghanistan', type: CardTypes.Infantry
		},
		['China']: {
			name: 'China', type: CardTypes.Artillery
		},
		['India']: {
			name: 'India', type: CardTypes.Cavalry
		},
		['Irkutsk']: {
			name: 'Irkutsk', type: CardTypes.Artillery
		},
		['Japan']: {
			name: 'Japan', type: CardTypes.Cavalry
		},
		['Kamchatka']: {
			name: 'Kamchatka', type: CardTypes.Artillery
		},
		['Manchuria']: {
			name: 'Manchuria', type: CardTypes.Cavalry
		},
		['Middle-East']: {
			name: 'Middle-East', type: CardTypes.Artillery
		},
		['Siam']: {
			name: 'Siam', type: CardTypes.Cavalry
		},
		['Siberia']: {
			name: 'Siberia', type: CardTypes.Infantry
		},
		['Ural']: {
			name: 'Ural', type: CardTypes.Infantry
		},
		['Yakutsk']: {
			name: 'Yakutsk', type: CardTypes.Artillery
		},
		['Eastern-Australia']: {
			name: 'Eastern-Australia', type: CardTypes.Cavalry
		},
		['Indonesia']: {
			name: 'Indonesia', type: CardTypes.Infantry
		},
		['New-Guinea']: {
			name: 'New-Guinea', type: CardTypes.Cavalry
		},
		['Western-Australia']: {
			name: 'Western-Australia', type: CardTypes.Artillery
		},
		['Great-Britain']: {
			name: 'Great-Britain', type: CardTypes.Infantry
		},
		['Iceland']: {
			name: 'Iceland', type: CardTypes.Cavalry
		},
		['Northern-Europe']: {
			name: 'Northern-Europe', type: CardTypes.Cavalry
		},
		['Scandinavia']: {
			name: 'Scandinavia', type: CardTypes.Infantry
		},
		['Southern-Europe']: {
			name: 'Southern-Europe', type: CardTypes.Infantry
		},
		['Ukraine']: {
			name: 'Ukraine', type: CardTypes.Infantry
		},
		['Western-Europe']: {
			name: 'Western-Europe', type: CardTypes.Infantry
		},
		['Alaska']: {
			name: 'Alaska', type: CardTypes.Artillery
		},
		['Alberta']: {
			name: 'Alberta', type: CardTypes.Artillery
		},
		['Eastern-United-States']: {
			name: 'Eastern-United-States', type: CardTypes.Artillery
		},
		['Greenland']: {
			name: 'Greenland', type: CardTypes.Cavalry
		},
		['Mexico']: {
			name: 'Mexico', type: CardTypes.Infantry
		},
		['Northwest-Territory']: {
			name: 'Northwest-Territory', type: CardTypes.Cavalry
		},
		['Ontario']: {
			name: 'Ontario', type: CardTypes.Artillery
		},
		['Quebec']: {
			name: 'Quebec', type: CardTypes.Artillery
		},
		['Western-United-States']: {
			name: 'Western-United-States', type: CardTypes.Artillery
		},
		['Argentina']: {
			name: 'Argentina', type: CardTypes.Infantry
		},
		['Brazil']: {
			name: 'Brazil', type: CardTypes.Infantry
		},
		['Peru']: {
			name: 'Peru', type: CardTypes.Cavalry
		},
		['Venezuela']: {
			name: 'Venezuela', type: CardTypes.Cavalry
		}
	};
};