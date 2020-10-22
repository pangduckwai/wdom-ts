import { buildWorld, buildDeck, buildMap, Card, CardTypes, Continents, Game, Player, _shuffle, shuffle, Territories, WildCards } from '../rules';

describe('Export constructs', () => {
  it('export continents', () => {
    const continents = Object.values(buildWorld());
    let output = ''
    for (let i = 0; i < continents.length; i++) {
      output += `Continent{${i}, ${continents[i].reinforcement}, "${continents[i].name}"},\n`
    }
    console.log(output)
  });

  it('export territories', () => {
    const world = Object.values(buildWorld());
    const territories = Object.values(buildMap());
    let output = '';
    for (let i = 0; i < territories.length; i++) {
      let connected = '';
      let comment = '';
      for (const territory of territories[i].connected) {
        connected += `${(!connected) ? '' : ', '}${territories.findIndex(t => t.name === territory)}`;
        comment += ` ${territory}`;
      }
      output += `Territory{${i}, 0, ${world.findIndex(c => c.name === territories[i].continent)}, "${territories[i].name}", []uint8{${connected}}}, // ${comment}\n`;
    } 
    console.log(output);
  });

  it('export cards', () => {
    const deck = Object.values(buildDeck());
    let output = '';
    for (let i = 0; i < deck.length; i++) {
      output += `Card{${i}, ${CardTypes.findIndex(c => c === deck[i].type)}, "${deck[i].name}"}, // ${deck[i].type}\n`;
    }
    console.log(output);
  });
})