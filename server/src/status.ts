import { Application } from 'express';
import expressWs from 'express-ws';
import {
    MatchSchedule,
    StatusRecieve,
    StatusReport,
    RobotPosition,
} from 'requests';
import { matchApp } from './Schema.js';
import { gameConfig } from './gameConfig.js';
import { readMatchSchedule } from './appSettings.js';

const bluePositionsAll: RobotPosition[] = [
    'blue_1',
    'blue_2',
    'blue_3',
    'blue_4',
];
const redPositionsAll: RobotPosition[] = [
    'red_1',
    'red_2',
    'red_3',
    'red_4',
];
const bluePositions = bluePositionsAll.slice(
    0,
    gameConfig.allianceSizeRobots.default
);
const redPositions = redPositionsAll.slice(
    0,
    gameConfig.allianceSizeRobots.default
);

let schedule: MatchSchedule | undefined;
try {
    schedule = readMatchSchedule();
} catch {
    schedule = undefined;
}

const status: StatusRecieve = { matches: {}, scouters: [] };

// array of functions to call whenever status changes;
const statusWatchers: (() => void)[] = [];

// run all watchers, should be called whenever status is updated
function notifyWatchers() {
    statusWatchers.forEach(watcher => watcher());
}

async function updateMatchStatus() {
    const matchEntries = DB_ENABLED
        ? await matchApp
              .find()
              .select(
                  'metadata.matchNumber metadata.robotTeam metadata.robotPosition'
              )
              .catch(() => [])
        : [];

    const matchNumbers = [
        ...[...Object.keys(schedule ?? {})].map(number => parseInt(number)),
        ...matchEntries.map(match => match.metadata.matchNumber),
    ].filter((value, index, self) => self.indexOf(value) === index);

    const matchOutput = Object.fromEntries(
        matchNumbers.map(matchNumber => [
            matchNumber,
            {
                ...Object.fromEntries(
                    (
                        [...redPositions, ...bluePositions] satisfies RobotPosition[]
                    ).map(robotPosition => [
                        robotPosition,
                        {
                            schedule: schedule?.[matchNumber]?.[robotPosition],
                            real: matchEntries
                                .filter(
                                    matchEntry =>
                                        matchEntry.metadata.matchNumber ===
                                            matchNumber &&
                                        matchEntry.metadata.robotPosition ===
                                            robotPosition
                                )
                                .map(
                                    matchEntry => matchEntry.metadata.robotTeam
                                ),
                        },
                    ])
                ),
            },
        ])
    );

    status.matches = matchOutput as unknown as StatusRecieve['matches'];
    notifyWatchers();
}

updateMatchStatus().catch(() => undefined);

function setUpSocket(expressApp: Application) {
    const { app } = expressWs(expressApp);

    app.ws('/status/scouter', (ws, _req) => {
        // Create an object to hold the scouter info
        const scouter: StatusReport = {
            tabletId: '',
            battery: undefined,
            matchNumber: undefined,
            robotPosition: undefined,
            scouterName: '',
        };

        // put the scouter into the list of scouters
        status.scouters.push(scouter);
        notifyWatchers();

        // When new data is recieved
        ws.on('message', (msg: string) => {
            // Update `scouter` with all the new data
            Object.assign(scouter, JSON.parse(msg));
            notifyWatchers();
        });

        // When the websocket closes
        ws.on('close', () => {
            // Remove this scouter from the list
            status.scouters.splice(status.scouters.indexOf(scouter), 1);
            notifyWatchers();
        });
    });

    app.ws('/status/admin', (ws, _req) => {
        // Function to send an update
        const sendUpdate = () => {
            ws.send(JSON.stringify(status));
        };

        // Send immediately
        sendUpdate();

        // Send updates whenever it changes
        statusWatchers.push(sendUpdate);

        // When the socket closes
        ws.on('close', () => {
            // Remove from the array of watchers
            statusWatchers.splice(statusWatchers.indexOf(sendUpdate), 1);
        });
    });
}

export { setUpSocket, updateMatchStatus };
