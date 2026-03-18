import { BallsPerSecondSetting, MatchData } from 'requests';
import { ballsPerSecondApp, matchApp } from './Schema.js';

async function exportAllData() {
    return {
        matchApp: (await matchApp.find({})) satisfies MatchData[],
        // Keep this key for backwards-compatibility with older backups.
        superApp: [],
        ballsPerSecondApp: (await ballsPerSecondApp.find({})) satisfies BallsPerSecondSetting[],
    };
}

async function sendExport() {
    const REMOTE_SERVER = process.env.REMOTE_SERVER_URL;

    if (!REMOTE_SERVER) {
        console.error('No remote server to send to');
        return;
    }

    return await fetch(`${REMOTE_SERVER}/data/sync`, {
        method: 'POST',
        body: JSON.stringify(await exportAllData()),
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function scheduleExport() {
    setInterval(sendExport, 60 * 1000 * 5);
}

async function importAllData(data: {
    matchApp: MatchData[];
    superApp?: unknown[];
    ballsPerSecondApp?: BallsPerSecondSetting[];
}) {
    await Promise.all([matchApp.deleteMany(), ballsPerSecondApp.deleteMany()]);
    await Promise.all([
        matchApp.insertMany(data.matchApp),
        ballsPerSecondApp.insertMany(data.ballsPerSecondApp ?? []),
    ]);
}

export { exportAllData, importAllData, sendExport, scheduleExport };
