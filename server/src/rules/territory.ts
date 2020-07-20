
export interface Territory {
	name: Territories;
	continent: Continents;
	connected: Set<Territories>;
};

export interface Continent {
	name: Continents;
	reinforcement: number;
	territories: Set<Territories>;
};

export const Continents = [
	'Africa',
	'Asia',
	'Australia',
	'Europe',
	'North-America',
	'South-America'
] as const;
export type Continents = typeof Continents[number];

export const Territories = [
	'Congo',
	'East-Africa',
	'Egypt',
	'Madagascar',
	'North-Africa',
	'South-Africa',
	'Afghanistan',
	'China',
	'India',
	'Irkutsk',
	'Japan',
	'Kamchatka',
	'Manchuria',
	'Middle-East',
	'Siam',
	'Siberia',
	'Ural',
	'Yakutsk',
	'Eastern-Australia',
	'Indonesia',
	'New-Guinea',
	'Western-Australia',
	'Great-Britain',
	'Iceland',
	'Northern-Europe',
	'Scandinavia',
	'Southern-Europe',
	'Ukraine',
	'Western-Europe',
	'Alaska',
	'Alberta',
	'Eastern-United-States',
	'Greenland',
	'Mexico',
	'Northwest-Territory',
	'Ontario',
	'Quebec',
	'Western-United-States',
	'Argentina',
	'Brazil',
	'Peru',
	'Venezuela',
] as const;
export type Territories = typeof Territories[number];

export const buildMap = (): Record<Territories, Territory> => {
	return { // TODO what about the 2 wild cards
		['Congo']: {
			name: 'Congo', continent: 'Africa', connected: new Set(['East-Africa', 'North-Africa', 'South-Africa'])
		},
		['East-Africa']: {
			name: 'East-Africa', continent: 'Africa', connected: new Set(['Congo', 'Egypt', 'Madagascar', 'North-Africa', 'South-Africa', 'Middle-East'])
		},
		['Egypt']: {
			name: 'Egypt', continent: 'Africa', connected: new Set(['East-Africa', 'North-Africa', 'Middle-East', 'Southern-Europe'])
		},
		['Madagascar']: {
			name: 'Madagascar', continent: 'Africa', connected: new Set(['East-Africa', 'South-Africa'])
		},
		['North-Africa']: {
			name: 'North-Africa', continent: 'Africa', connected: new Set(['Congo', 'Egypt', 'East-Africa', 'Southern-Europe', 'Western-Europe', 'Brazil'])
		},
		['South-Africa']: {
			name: 'South-Africa', continent: 'Africa', connected: new Set(['Congo', 'East-Africa', 'Madagascar'])
		},
		['Afghanistan']: {
			name: 'Afghanistan', continent: 'Asia', connected: new Set(['China', 'India', 'Middle-East', 'Ural', 'Ukraine'])
		},
		['China']: {
			name: 'China', continent: 'Asia', connected: new Set(['Afghanistan', 'India', 'Manchuria', 'Siam', 'Siberia', 'Ural'])
		},
		['India']: {
			name: 'India', continent: 'Asia', connected: new Set(['Afghanistan', 'China', 'Middle-East', 'Siam'])
		},
		['Irkutsk']: {
			name: 'Irkutsk', continent: 'Asia', connected: new Set(['Kamchatka', 'Manchuria', 'Siberia', 'Yakutsk'])
		},
		['Japan']: {
			name: 'Japan', continent: 'Asia', connected: new Set(['Kamchatka', 'Manchuria'])
		},
		['Kamchatka']: {
			name: 'Kamchatka', continent: 'Asia', connected: new Set(['Irkutsk', 'Japan', 'Manchuria', 'Yakutsk', 'Alaska'])
		},
		['Manchuria']: {
			name: 'Manchuria', continent: 'Asia', connected: new Set(['China', 'Irkutsk', 'Japan', 'Kamchatka', 'Siberia'])
		},
		['Middle-East']: {
			name: 'Middle-East', continent: 'Asia', connected: new Set(['Afghanistan', 'India', 'Egypt', 'East-Africa', 'Southern-Europe', 'Ukraine'])
		},
		['Siam']: {
			name: 'Siam', continent: 'Asia', connected: new Set(['China', 'India', 'Indonesia'])
		},
		['Siberia']: {
			name: 'Siberia', continent: 'Asia', connected: new Set(['China', 'Irkutsk', 'Manchuria', 'Ural', 'Yakutsk'])
		},
		['Ural']: {
			name: 'Ural', continent: 'Asia', connected: new Set(['Afghanistan', 'China', 'Siberia', 'Ukraine'])
		},
		['Yakutsk']: {
			name: 'Yakutsk', continent: 'Asia', connected: new Set(['Irkutsk', 'Kamchatka', 'Siberia'])
		},
		['Eastern-Australia']: {
			name: 'Eastern-Australia', continent: 'Australia', connected: new Set(['New-Guinea', 'Western-Australia'])
		},
		['Indonesia']: {
			name: 'Indonesia', continent: 'Australia', connected: new Set(['New-Guinea', 'Western-Australia', 'Siam'])
		},
		['New-Guinea']: {
			name: 'New-Guinea', continent: 'Australia', connected: new Set(['Eastern-Australia', 'Indonesia', 'Western-Australia'])
		},
		['Western-Australia']: {
			name: 'Western-Australia', continent: 'Australia', connected: new Set(['Eastern-Australia', 'Indonesia', 'New-Guinea'])
		},
		['Great-Britain']: {
			name: 'Great-Britain', continent: 'Europe', connected: new Set(['Iceland', 'Northern-Europe', 'Scandinavia', 'Western-Europe'])
		},
		['Iceland']: {
			name: 'Iceland', continent: 'Europe', connected: new Set(['Great-Britain', 'Scandinavia', 'Greenland'])
		},
		['Northern-Europe']: {
			name: 'Northern-Europe', continent: 'Europe', connected: new Set(['Great-Britain', 'Scandinavia', 'Southern-Europe', 'Ukraine', 'Western-Europe'])
		},
		['Scandinavia']: {
			name: 'Scandinavia', continent: 'Europe', connected: new Set(['Great-Britain', 'Iceland', 'Northern-Europe', 'Ukraine'])
		},
		['Southern-Europe']: {
			name: 'Southern-Europe', continent: 'Europe', connected: new Set(['Northern-Europe', 'Ukraine', 'Western-Europe', 'Egypt', 'North-Africa', 'Middle-East'])
		},
		['Ukraine']: {
			name: 'Ukraine', continent: 'Europe', connected: new Set(['Northern-Europe', 'Scandinavia', 'Southern-Europe', 'Afghanistan', 'Middle-East', 'Ural'])
		},
		['Western-Europe']: {
			name: 'Western-Europe', continent: 'Europe', connected: new Set(['Great-Britain', 'Northern-Europe', 'Southern-Europe', 'North-Africa'])
		},
		['Alaska']: {
			name: 'Alaska', continent: 'North-America', connected: new Set(['Alberta', 'Northwest-Territory', 'Kamchatka'])
		},
		['Alberta']: {
			name: 'Alberta', continent: 'North-America', connected: new Set(['Alaska', 'Northwest-Territory', 'Ontario', 'Western-United-States'])
		},
		['Eastern-United-States']: {
			name: 'Eastern-United-States', continent: 'North-America', connected: new Set(['Mexico', 'Ontario', 'Quebec', 'Western-United-States'])
		},
		['Greenland']: {
			name: 'Greenland', continent: 'North-America', connected: new Set(['Northwest-Territory', 'Ontario', 'Quebec', 'Iceland'])
		},
		['Mexico']: {
			name: 'Mexico', continent: 'North-America', connected: new Set(['Eastern-United-States', 'Western-United-States', 'Venezuela'])
		},
		['Northwest-Territory']: {
			name: 'Northwest-Territory', continent: 'North-America', connected: new Set(['Alaska', 'Alberta', 'Greenland', 'Ontario'])
		},
		['Ontario']: {
			name: 'Ontario', continent: 'North-America', connected: new Set(['Alberta', 'Eastern-United-States', 'Greenland', 'Northwest-Territory', 'Quebec', 'Western-United-States'])
		},
		['Quebec']: {
			name: 'Quebec', continent: 'North-America', connected: new Set(['Eastern-United-States', 'Greenland', 'Ontario'])
		},
		['Western-United-States']: {
			name: 'Western-United-States', continent: 'North-America', connected: new Set(['Alberta', 'Eastern-United-States', 'Mexico', 'Ontario'])
		},
		['Argentina']: {
			name: 'Argentina', continent: 'South-America', connected: new Set(['Brazil', 'Peru'])
		},
		['Brazil']: {
			name: 'Brazil', continent: 'South-America', connected: new Set(['Argentina', 'Peru', 'Venezuela', 'North-Africa'])
		},
		['Peru']: {
			name: 'Peru', continent: 'South-America', connected: new Set(['Argentina', 'Brazil', 'Venezuela'])
		},
		['Venezuela']: {
			name: 'Venezuela', continent: 'South-America', connected: new Set(['Brazil', 'Peru', 'Mexico'])
		}
	};
};

export const buildContinents = (): Record<Continents, Continent> => {
	return {
		['Africa']: {
			name: 'Africa',
			reinforcement: 3,
			territories: new Set([
				'Congo', 'East-Africa', 'Egypt', 'Madagascar', 'North-Africa', 'South-Africa'
			])
		},
		['Asia']: {
			name: 'Asia',
			reinforcement: 7,
			territories: new Set([
				'Afghanistan',
				'China',
				'India',
				'Irkutsk',
				'Japan',
				'Kamchatka',
				'Manchuria',
				'Middle-East',
				'Siam',
				'Siberia',
				'Ural',
				'Yakutsk'
			])
		},
		['Australia']: {
			name: 'Australia',
			reinforcement: 2,
			territories: new Set([
				'Eastern-Australia', 'Indonesia', 'New-Guinea', 'Western-Australia'
			])
		},
		['Europe']: {
			name: 'Europe',
			reinforcement: 5,
			territories: new Set([
				'Great-Britain',
				'Iceland',
				'Northern-Europe',
				'Scandinavia',
				'Southern-Europe',
				'Ukraine',
				'Western-Europe'
			])
		},
		['North-America']: {
			name: 'North-America',
			reinforcement: 5,
			territories: new Set([
				'Alaska',
				'Alberta',
				'Eastern-United-States',
				'Greenland',
				'Mexico',
				'Northwest-Territory',
				'Ontario',
				'Quebec',
				'Western-United-States'
			])
		},
		['South-America']: {
			name: 'South-America',
			reinforcement: 2,
			territories: new Set([
				'Argentina', 'Brazil', 'Peru', 'Venezuela'
			])
		},
	}
};
