// Demo-Daten für ?demo=true — keine Datenbankverbindung nötig.

export const DEMO_PLAYERS = {
    "p1": { name: "Anna",   elo: 1085, matches: 10, wins: 6, losses: 4, doublesElo: 1048, doublesMatches: 6, doublesWins: 4, doublesLosses: 2 },
    "p2": { name: "Ben",    elo: 1042, matches:  9, wins: 5, losses: 4, doublesElo: 1062, doublesMatches: 6, doublesWins: 4, doublesLosses: 2 },
    "p3": { name: "Clara",  elo:  963, matches:  8, wins: 3, losses: 5, doublesElo:  978, doublesMatches: 6, doublesWins: 2, doublesLosses: 4 },
    "p4": { name: "David",  elo: 1010, matches:  7, wins: 4, losses: 3, doublesElo:  985, doublesMatches: 6, doublesWins: 2, doublesLosses: 4 },
    "p5": { name: "Emma",   elo: 1033, matches:  6, wins: 3, losses: 3, doublesElo: 1027, doublesMatches: 0, doublesWins: 0, doublesLosses: 0 },
    "p6": { name: "Felix",  elo:  987, matches:  5, wins: 2, losses: 3, doublesElo: 1000, doublesMatches: 0, doublesWins: 0, doublesLosses: 0 },
};

const d = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const DEMO_MATCHES = [
    { id: 1001, date: d(14), type: "singles", winnerId: "p1",    loserId: "p3",    winnerName: "Anna",          loserName: "Clara",          eloChange: 15 },
    { id: 1002, date: d(12), type: "singles", winnerId: "p2",    loserId: "p4",    winnerName: "Ben",           loserName: "David",          eloChange: 16 },
    { id: 1003, date: d(10), type: "doubles", winnerId: "p1,p2", loserId: "p3,p4", winnerName: "Anna & Ben",    loserName: "Clara & David",  eloChange: 18 },
    { id: 1004, date: d(9),  type: "singles", winnerId: "p5",    loserId: "p6",    winnerName: "Emma",          loserName: "Felix",          eloChange: 14 },
    { id: 1005, date: d(7),  type: "singles", winnerId: "p4",    loserId: "p1",    winnerName: "David",         loserName: "Anna",           eloChange: 13 },
    { id: 1006, date: d(6),  type: "doubles", winnerId: "p1,p2", loserId: "p3,p4", winnerName: "Anna & Ben",    loserName: "Clara & David",  eloChange: 17 },
    { id: 1007, date: d(5),  type: "singles", winnerId: "p1",    loserId: "p2",    winnerName: "Anna",          loserName: "Ben",            eloChange: 16 },
    { id: 1008, date: d(4),  type: "singles", winnerId: "p3",    loserId: "p5",    winnerName: "Clara",         loserName: "Emma",           eloChange: 15 },
    { id: 1009, date: d(3),  type: "doubles", winnerId: "p3,p4", loserId: "p1,p2", winnerName: "Clara & David", loserName: "Anna & Ben",     eloChange: 19 },
    { id: 1010, date: d(2),  type: "singles", winnerId: "p2",    loserId: "p6",    winnerName: "Ben",           loserName: "Felix",          eloChange: 12 },
    { id: 1011, date: d(1),  type: "singles", winnerId: "p1",    loserId: "p5",    winnerName: "Anna",          loserName: "Emma",           eloChange: 14 },
    { id: 1012, date: d(0),  type: "doubles", winnerId: "p1,p2", loserId: "p3,p4", winnerName: "Anna & Ben",    loserName: "Clara & David",  eloChange: 16 },
];
