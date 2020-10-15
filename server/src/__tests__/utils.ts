export const SELECTS = [
['messages', 'Messages', `
query Messages($commitId: String!) {
  messages(commitId: $commitId) {
    commitId
    type
    eventName
    message
    timestamp
  }
}`],
['me', 'Me', `
query Me {
  me {
    token
    name
    status
    reinforcement
    selected
    joined
    cards
    holdings {
      name
      troop
    }
  }
}`],
['myGame', 'MyGame', `
query MyGame {
  myGame {
    token
    name
    status
    round
    turns
    players {
      token
      name
      status
      selected
      joined
      holdings {
        name
        troop
      }
    }
    lastBattleR
    lastBattleW
  }
}`]
];

export const UPDATES = [
// 0
['registerPlayer', 'RegisterPlayer', `
mutation RegisterPlayer($playerName: String!) {
	registerPlayer(playerName: $playerName) {
		... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
	}
}`], // 1
['leaveGameRoom', 'LeaveGameRoom', `
mutation LeaveGameRoom {
	leaveGameRoom {
		... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
	}
}`], // 2
['openGame', 'OpenGame', `
mutation OpenGame($gameName: String!, $ruleType: String!) {
  openGame(gameName: $gameName, ruleType: $ruleType) {
    ... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
  }
}`], // 3
['closeGame', 'CloseGame', `
mutation CloseGame {
  closeGame {
    ... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
  }
}`], // 4
['joinGame', 'JoinGame', `
mutation JoinGame($gameToken: String!) {
  joinGame(gameToken: $gameToken) {
    ... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
  }
}`], // 5
['quitGame', 'QuitGame', `
mutation QuitGame {
  quitGame {
    ... on Commit {
			id
			version
			timestamp
      session
		}
		... on Error {
			message
		}
  }
}`],
];

export const START_GAME = `
mutation StartGame($playerToken: String!, $gameToken: String!) {
  startGame(playerToken: $playerToken, gameToken: $gameToken) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

export const ASSIGN_TERRITORY = `
mutation AssignTerritory($playerToken: String!, $gameToken: String!, $territoryName: String!) {
  assignTerritory(playerToken: $playerToken, gameToken: $gameToken, territoryName: $territoryName) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

/*
mutation {
  registerPlayer(playerName: "josh") {
    ... on Commit {
      id
      version
      session
      timestamp
      events {
        type
      }
    }
    ... on Error {
      message
    }
  }
}

mutation {
  leaveGameRoom {
    ... on Commit {
      id
      version
      session
      timestamp
      events {
        type
      }
    }
    ... on Error {
      message
    }
  }
}
{
  "authorization": "iCzKyzlDXwlMTgctwIHer8qHtYlFUnCVjigSiH/8Dmg="
}

query {
  me {
    token
    name
    status
    reinforcement
    selected
    joined
    cards
    holdings {
      name
      troop
    }
    sessionid
  }
}
{
  "authorization": "iCzKyzlDXwlMTgctwIHer8qHtYlFUnCVjigSiH/8Dmg="
}
*/