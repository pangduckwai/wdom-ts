import { BaseEvent } from '../commands';
import { Card } from './card';
import { Territory } from './territory';

export * from './card';
export * from './territory';
export * from './reducer';

export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	cards: Record<string, Card>;
	sessionid?: string;
	ready: boolean;
	joined?: Game;
}

export interface Game {
  token: string;
  name: string;
  host: Player;
  round: number; // -1
  redeemed: number; // 0
  cards: Card[]; // the deck has to be shuffled, thus need array
  map: Record<Territories, Territory>;
}

export interface Errors {
  event: BaseEvent;
  message: string;
}

export enum CardTypes {
	Wildcard,
	Artillery,
	Cavalry,
	Infantry
}

export enum WildCards {
	One = 'Wildcard-1',
	Two = 'Wildcard-2'
}

export enum Continents {
	Africa = 'Africa',
	Asia = 'Asia',
	Australia = 'Australia',
	Europe = 'Europe',
	NorthAmerica = 'North-America',
	SouthAmerica = 'South-America'
}

export enum Territories {
	Congo = 'Congo',
	EastAfrica = 'East-Africa',
	Egypt = 'Egypt',
	Madagascar = 'Madagascar',
	NorthAfrica = 'North-Africa',
	SouthAfrica = 'South-Africa',
	Afghanistan = 'Afghanistan',
	China = 'China',
	India = 'India',
	Irkutsk = 'Irkutsk',
	Japan = 'Japan',
	Kamchatka = 'Kamchatka',
	Manchuria = 'Manchuria',
	MiddleEast = 'Middle-East',
	Siam = 'Siam',
	Siberia = 'Siberia',
	Ural = 'Ural',
	Yakutsk = 'Yakutsk',
	EasternAustralia = 'Eastern-Australia',
	Indonesia = 'Indonesia',
	NewGuinea = 'New-Guinea',
	WesternAustralia = 'Western-Australia',
	GreatBritain = 'Great-Britain',
	Iceland = 'Iceland',
	NorthernEurope = 'Northern-Europe',
	Scandinavia = 'Scandinavia',
	SouthernEurope = 'Southern-Europe',
	Ukraine = 'Ukraine',
	WesternEurope = 'Western-Europe',
	Alaska = 'Alaska',
	Alberta = 'Alberta',
	EasternUnitedStates = 'Eastern-United-States',
	Greenland = 'Greenland',
	Mexico = 'Mexico',
	NorthwestTerritory = 'Northwest-Territory',
	Ontario = 'Ontario',
	Quebec = 'Quebec',
	WesternUnitedStates = 'Western-United-States',
	Argentina = 'Argentina',
	Brazil = 'Brazil',
	Peru = 'Peru',
	Venezuela = 'Venezuela'
}
