
export interface Territory {
	name: Territories;
	troop: number;
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
	return {
		['Congo']: {
			name: 'Congo', troop: 0, continent: 'Africa', connected: new Set(['East-Africa', 'North-Africa', 'South-Africa'])
		},
		['East-Africa']: {
			name: 'East-Africa', troop: 0, continent: 'Africa', connected: new Set(['Congo', 'Egypt', 'Madagascar', 'North-Africa', 'South-Africa', 'Middle-East'])
		},
		['Egypt']: {
			name: 'Egypt', troop: 0, continent: 'Africa', connected: new Set(['East-Africa', 'North-Africa', 'Middle-East', 'Southern-Europe'])
		},
		['Madagascar']: {
			name: 'Madagascar', troop: 0, continent: 'Africa', connected: new Set(['East-Africa', 'South-Africa'])
		},
		['North-Africa']: {
			name: 'North-Africa', troop: 0, continent: 'Africa', connected: new Set(['Congo', 'Egypt', 'East-Africa', 'Southern-Europe', 'Western-Europe', 'Brazil'])
		},
		['South-Africa']: {
			name: 'South-Africa', troop: 0, continent: 'Africa', connected: new Set(['Congo', 'East-Africa', 'Madagascar'])
		},
		['Afghanistan']: {
			name: 'Afghanistan', troop: 0, continent: 'Asia', connected: new Set(['China', 'India', 'Middle-East', 'Ural', 'Ukraine'])
		},
		['China']: {
			name: 'China', troop: 0, continent: 'Asia', connected: new Set(['Afghanistan', 'India', 'Manchuria', 'Siam', 'Siberia', 'Ural'])
		},
		['India']: {
			name: 'India', troop: 0, continent: 'Asia', connected: new Set(['Afghanistan', 'China', 'Middle-East', 'Siam'])
		},
		['Irkutsk']: {
			name: 'Irkutsk', troop: 0, continent: 'Asia', connected: new Set(['Kamchatka', 'Manchuria', 'Siberia', 'Yakutsk'])
		},
		['Japan']: {
			name: 'Japan', troop: 0, continent: 'Asia', connected: new Set(['Kamchatka', 'Manchuria'])
		},
		['Kamchatka']: {
			name: 'Kamchatka', troop: 0, continent: 'Asia', connected: new Set(['Irkutsk', 'Japan', 'Manchuria', 'Yakutsk', 'Alaska'])
		},
		['Manchuria']: {
			name: 'Manchuria', troop: 0, continent: 'Asia', connected: new Set(['China', 'Irkutsk', 'Japan', 'Kamchatka', 'Siberia'])
		},
		['Middle-East']: {
			name: 'Middle-East', troop: 0, continent: 'Asia', connected: new Set(['Afghanistan', 'India', 'Egypt', 'East-Africa', 'Southern-Europe', 'Ukraine'])
		},
		['Siam']: {
			name: 'Siam', troop: 0, continent: 'Asia', connected: new Set(['China', 'India', 'Indonesia'])
		},
		['Siberia']: {
			name: 'Siberia', troop: 0, continent: 'Asia', connected: new Set(['China', 'Irkutsk', 'Manchuria', 'Ural', 'Yakutsk'])
		},
		['Ural']: {
			name: 'Ural', troop: 0, continent: 'Asia', connected: new Set(['Afghanistan', 'China', 'Siberia', 'Ukraine'])
		},
		['Yakutsk']: {
			name: 'Yakutsk', troop: 0, continent: 'Asia', connected: new Set(['Irkutsk', 'Kamchatka', 'Siberia'])
		},
		['Eastern-Australia']: {
			name: 'Eastern-Australia', troop: 0, continent: 'Australia', connected: new Set(['New-Guinea', 'Western-Australia'])
		},
		['Indonesia']: {
			name: 'Indonesia', troop: 0, continent: 'Australia', connected: new Set(['New-Guinea', 'Western-Australia', 'Siam'])
		},
		['New-Guinea']: {
			name: 'New-Guinea', troop: 0, continent: 'Australia', connected: new Set(['Eastern-Australia', 'Indonesia', 'Western-Australia'])
		},
		['Western-Australia']: {
			name: 'Western-Australia', troop: 0, continent: 'Australia', connected: new Set(['Eastern-Australia', 'Indonesia', 'New-Guinea'])
		},
		['Great-Britain']: {
			name: 'Great-Britain', troop: 0, continent: 'Europe', connected: new Set(['Iceland', 'Northern-Europe', 'Scandinavia', 'Western-Europe'])
		},
		['Iceland']: {
			name: 'Iceland', troop: 0, continent: 'Europe', connected: new Set(['Great-Britain', 'Scandinavia', 'Greenland'])
		},
		['Northern-Europe']: {
			name: 'Northern-Europe', troop: 0, continent: 'Europe', connected: new Set(['Great-Britain', 'Scandinavia', 'Southern-Europe', 'Ukraine', 'Western-Europe'])
		},
		['Scandinavia']: {
			name: 'Scandinavia', troop: 0, continent: 'Europe', connected: new Set(['Great-Britain', 'Iceland', 'Northern-Europe', 'Ukraine'])
		},
		['Southern-Europe']: {
			name: 'Southern-Europe', troop: 0, continent: 'Europe', connected: new Set(['Northern-Europe', 'Ukraine', 'Western-Europe', 'Egypt', 'North-Africa', 'Middle-East'])
		},
		['Ukraine']: {
			name: 'Ukraine', troop: 0, continent: 'Europe', connected: new Set(['Northern-Europe', 'Scandinavia', 'Southern-Europe', 'Afghanistan', 'Middle-East', 'Ural'])
		},
		['Western-Europe']: {
			name: 'Western-Europe', troop: 0, continent: 'Europe', connected: new Set(['Great-Britain', 'Northern-Europe', 'Southern-Europe', 'North-Africa'])
		},
		['Alaska']: {
			name: 'Alaska', troop: 0, continent: 'North-America', connected: new Set(['Alberta', 'Northwest-Territory', 'Kamchatka'])
		},
		['Alberta']: {
			name: 'Alberta', troop: 0, continent: 'North-America', connected: new Set(['Alaska', 'Northwest-Territory', 'Ontario', 'Western-United-States'])
		},
		['Eastern-United-States']: {
			name: 'Eastern-United-States', troop: 0, continent: 'North-America', connected: new Set(['Mexico', 'Ontario', 'Quebec', 'Western-United-States'])
		},
		['Greenland']: {
			name: 'Greenland', troop: 0, continent: 'North-America', connected: new Set(['Northwest-Territory', 'Ontario', 'Quebec', 'Iceland'])
		},
		['Mexico']: {
			name: 'Mexico', troop: 0, continent: 'North-America', connected: new Set(['Eastern-United-States', 'Western-United-States', 'Venezuela'])
		},
		['Northwest-Territory']: {
			name: 'Northwest-Territory', troop: 0, continent: 'North-America', connected: new Set(['Alaska', 'Alberta', 'Greenland', 'Ontario'])
		},
		['Ontario']: {
			name: 'Ontario', troop: 0, continent: 'North-America', connected: new Set(['Alberta', 'Eastern-United-States', 'Greenland', 'Northwest-Territory', 'Quebec', 'Western-United-States'])
		},
		['Quebec']: {
			name: 'Quebec', troop: 0, continent: 'North-America', connected: new Set(['Eastern-United-States', 'Greenland', 'Ontario'])
		},
		['Western-United-States']: {
			name: 'Western-United-States', troop: 0, continent: 'North-America', connected: new Set(['Alberta', 'Eastern-United-States', 'Mexico', 'Ontario'])
		},
		['Argentina']: {
			name: 'Argentina', troop: 0, continent: 'South-America', connected: new Set(['Brazil', 'Peru'])
		},
		['Brazil']: {
			name: 'Brazil', troop: 0, continent: 'South-America', connected: new Set(['Argentina', 'Peru', 'Venezuela', 'North-Africa'])
		},
		['Peru']: {
			name: 'Peru', troop: 0, continent: 'South-America', connected: new Set(['Argentina', 'Brazil', 'Venezuela'])
		},
		['Venezuela']: {
			name: 'Venezuela', troop: 0, continent: 'South-America', connected: new Set(['Brazil', 'Peru', 'Mexico'])
		}
	};
};

export const buildWorld = (): Record<Continents, Continent> => {
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
