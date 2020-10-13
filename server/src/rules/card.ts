import { Territories } from '.';

export const CardTypes = [
	'Wildcard', 'Artillery', 'Cavalry', 'Infantry'
] as const;
export type CardTypes = typeof CardTypes[number];

export const WildCards = [
	'Wildcard-1',
	'Wildcard-2'
] as const;
export type WildCards = typeof WildCards[number];

export interface Card {
	name: Territories | WildCards;
	type: CardTypes;
};

export const shuffle = <K extends string, V>(source: Record<K, V>): V[] => {
	return _shuffle(Object.values(source));
};
export const _shuffle = <T>(list: T[]): T[] => {
	let size = list.length;
	while (size > 0) {
		const indx = Math.floor(Math.random() * size);
		const last = list[-- size];
		list[size] = list[indx];
		list[indx] = last;
	}
	return list;
};

export const buildDeck = (): Record<WildCards | Territories, Card> => {
	return {
		['Wildcard-1']: {
			name: 'Wildcard-1', type: 'Wildcard'
		},
		['Wildcard-2']: {
			name: 'Wildcard-2', type: 'Wildcard'
		},
		['Congo']: {
			name: 'Congo', type: 'Artillery'
		},
		['East-Africa']: {
			name: 'East-Africa', type: 'Infantry'
		},
		['Egypt']: {
			name: 'Egypt', type: 'Cavalry'
		},
		['Madagascar']: {
			name: 'Madagascar', type: 'Cavalry'
		},
		['North-Africa']: {
			name: 'North-Africa', type: 'Infantry'
		},
		['South-Africa']: {
			name: 'South-Africa', type: 'Artillery'
		},
		['Afghanistan']: {
			name: 'Afghanistan', type: 'Infantry'
		},
		['China']: {
			name: 'China', type: 'Artillery'
		},
		['India']: {
			name: 'India', type: 'Cavalry'
		},
		['Irkutsk']: {
			name: 'Irkutsk', type: 'Artillery'
		},
		['Japan']: {
			name: 'Japan', type: 'Cavalry'
		},
		['Kamchatka']: {
			name: 'Kamchatka', type: 'Artillery'
		},
		['Manchuria']: {
			name: 'Manchuria', type: 'Cavalry'
		},
		['Middle-East']: {
			name: 'Middle-East', type: 'Artillery'
		},
		['Siam']: {
			name: 'Siam', type: 'Cavalry'
		},
		['Siberia']: {
			name: 'Siberia', type: 'Infantry'
		},
		['Ural']: {
			name: 'Ural', type: 'Infantry'
		},
		['Yakutsk']: {
			name: 'Yakutsk', type: 'Artillery'
		},
		['Eastern-Australia']: {
			name: 'Eastern-Australia', type: 'Cavalry'
		},
		['Indonesia']: {
			name: 'Indonesia', type: 'Infantry'
		},
		['New-Guinea']: {
			name: 'New-Guinea', type: 'Cavalry'
		},
		['Western-Australia']: {
			name: 'Western-Australia', type: 'Artillery'
		},
		['Great-Britain']: {
			name: 'Great-Britain', type: 'Infantry'
		},
		['Iceland']: {
			name: 'Iceland', type: 'Cavalry'
		},
		['Northern-Europe']: {
			name: 'Northern-Europe', type: 'Cavalry'
		},
		['Scandinavia']: {
			name: 'Scandinavia', type: 'Infantry'
		},
		['Southern-Europe']: {
			name: 'Southern-Europe', type: 'Infantry'
		},
		['Ukraine']: {
			name: 'Ukraine', type: 'Infantry'
		},
		['Western-Europe']: {
			name: 'Western-Europe', type: 'Infantry'
		},
		['Alaska']: {
			name: 'Alaska', type: 'Artillery'
		},
		['Alberta']: {
			name: 'Alberta', type: 'Artillery'
		},
		['Eastern-United-States']: {
			name: 'Eastern-United-States', type: 'Artillery'
		},
		['Greenland']: {
			name: 'Greenland', type: 'Cavalry'
		},
		['Mexico']: {
			name: 'Mexico', type: 'Infantry'
		},
		['Northwest-Territory']: {
			name: 'Northwest-Territory', type: 'Cavalry'
		},
		['Ontario']: {
			name: 'Ontario', type: 'Artillery'
		},
		['Quebec']: {
			name: 'Quebec', type: 'Artillery'
		},
		['Western-United-States']: {
			name: 'Western-United-States', type: 'Artillery'
		},
		['Argentina']: {
			name: 'Argentina', type: 'Infantry'
		},
		['Brazil']: {
			name: 'Brazil', type: 'Infantry'
		},
		['Peru']: {
			name: 'Peru', type: 'Cavalry'
		},
		['Venezuela']: {
			name: 'Venezuela', type: 'Cavalry'
		}
	};
};