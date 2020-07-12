import { Continents, Territories} from '.';

export interface Continent {
	name: Continents;
	reinforcement: number;
	territories: Set<Territories>;
}

export const buildContinents = (): Record<Continents, Continent> => {
	return {
		[Continents.Africa]: {
			name: Continents.Africa,
			reinforcement: 3,
			territories: new Set([
				Territories.Congo, Territories.EastAfrica, Territories.Egypt, Territories.Madagascar, Territories.NorthAfrica, Territories.SouthAfrica
			])
		},
		[Continents.Asia]: {
			name: Continents.Asia,
			reinforcement: 7,
			territories: new Set([
				Territories.Afghanistan,
				Territories.China,
				Territories.India,
				Territories.Irkutsk,
				Territories.Japan,
				Territories.Kamchatka,
				Territories.Manchuria,
				Territories.MiddleEast,
				Territories.Siam,
				Territories.Siberia,
				Territories.Ural,
				Territories.Yakutsk
			])
		},
		[Continents.Australia]: {
			name: Continents.Australia,
			reinforcement: 2,
			territories: new Set([
				Territories.EasternAustralia, Territories.Indonesia, Territories.NewGuinea, Territories.WesternAustralia
			])
		},
		[Continents.Europe]: {
			name: Continents.Europe,
			reinforcement: 5,
			territories: new Set([
				Territories.GreatBritain,
				Territories.Iceland,
				Territories.NorthernEurope,
				Territories.Scandinavia,
				Territories.SouthernEurope,
				Territories.Ukraine,
				Territories.WesternEurope
			])
		},
		[Continents.NorthAmerica]: {
			name: Continents.NorthAmerica,
			reinforcement: 5,
			territories: new Set([
				Territories.Alaska,
				Territories.Alberta,
				Territories.EasternUnitedStates,
				Territories.Greenland,
				Territories.Mexico,
				Territories.NorthwestTerritory,
				Territories.Ontario,
				Territories.Quebec,
				Territories.WesternUnitedStates
			])
		},
		[Continents.SouthAmerica]: {
			name: Continents.SouthAmerica,
			reinforcement: 2,
			territories: new Set([
				Territories.Argentina, Territories.Brazil, Territories.Peru, Territories.Venezuela
			])
		},
	}
};
