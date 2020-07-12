
// =====================

import { Interface } from "readline";

// === Runtime types ===
export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	cards: Record<Cards, Card>;
	sessionid?: string;
	ready: boolean;
}

export interface Game {
  token: string;
  name: string;
  host: Player;
  round: number; // -1
  redeemed: number; // 0
  cards: Record<Cards, Card>;
  map: Record<Territories, Territory>;
}
// =====================

// ======================
// === Constant types ===
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

export enum Continents {
  Africa = 'Africa',
  Asia = 'Asia',
  Australia = 'Australia',
  Europe = 'Europe',
  NorthAmerica = 'North-America',
  SouthAmerica = 'South-America'
}

export enum Cards {
	Wildcard,
	Artillery,
	Cavalry,
	Infantry
}

export interface Card {
	name: Territories;
	type: Cards;
}

export interface Continent {
  name: Continents;
  reinforcement: number;
  territories: Territories;
}

export interface Territory {
  name: Territories;
  continent: Continents;
  connected: Territory[];
}
// ======================
