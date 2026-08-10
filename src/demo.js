// Demo-Daten für ?demo=true — keine Datenbankverbindung nötig.
//
// Bewusst ohne vorberechnete Statistiken und ohne eloChange: beides wird beim
// Laden aus der Historie berechnet. Standen hier eigene Zahlen, widersprachen
// sie der Rangliste daneben — ausgerechnet in der Ansicht, die ein Interessent
// als erstes öffnet.

import { STARTING_ELO } from './elo.js';

const player = (name) => ({
    name,
    elo:            STARTING_ELO,
    matches:        0, wins: 0, losses: 0,
    doublesElo:     STARTING_ELO,
    doublesMatches: 0, doublesWins: 0, doublesLosses: 0,
});

export const DEMO_PLAYERS = {
    p1: player('Anna'),
    p2: player('Ben'),
    p3: player('Clara'),
    p4: player('David'),
    p5: player('Emma'),
    p6: player('Felix'),
};

const d = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const match = (id, daysAgo, type, winnerId, loserId) => {
    const name = (ids) => ids.split(',').map(x => DEMO_PLAYERS[x].name).join(' & ');
    return {
        id,
        date: d(daysAgo),
        type,
        winnerId,
        loserId,
        winnerName: name(winnerId),
        loserName:  name(loserId),
    };
};

export const DEMO_MATCHES = [
    match(1001, 14, 'singles', 'p1',    'p3'),
    match(1002, 12, 'singles', 'p2',    'p4'),
    match(1003, 10, 'doubles', 'p1,p2', 'p3,p4'),
    match(1004,  9, 'singles', 'p5',    'p6'),
    match(1005,  8, 'doubles', 'p5,p6', 'p1,p3'),
    match(1006,  7, 'singles', 'p4',    'p1'),
    match(1007,  6, 'doubles', 'p1,p2', 'p3,p4'),
    match(1008,  5, 'singles', 'p1',    'p2'),
    match(1009,  4, 'singles', 'p3',    'p5'),
    match(1010,  4, 'doubles', 'p2,p5', 'p4,p6'),
    match(1011,  3, 'doubles', 'p3,p4', 'p1,p2'),
    match(1012,  2, 'singles', 'p2',    'p6'),
    match(1013,  1, 'singles', 'p1',    'p5'),
    match(1014,  0, 'doubles', 'p1,p2', 'p3,p4'),
];
