import express from 'express';
import path from 'path';
import chalk from 'chalk';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ballsPerSecondApp, matchApp, pitApp } from './Schema.js';
import {
    averageAndMax,
    superAverageAndMax,
    robotImageDisplay,
    scouterRankings,
    maxIndividual,
    superMaxIndividual,
    matchOutlier,
} from './aggregate.js';
import { setUpSocket, updateMatchStatus } from './status.js';
import { BallsPerSecondSetting, MatchData, PitFile, PitResult } from 'requests';
import { dataUriToBuffer } from 'data-uri-to-buffer';

// import { MatchData } from 'requests';

// If DEV is true then the app should forward requests to localhost:5173 instead of serving from /static
const DEV = process.env.NODE_ENV === 'dev';
const DEFAULT_BALLS_PER_SECOND = 5;

const app = express();

app.use(express.json({ limit: '200mb' }));

setUpSocket(app);

const emptyActionTimeBySegment: MatchData['shootTimeBySegment'] = {
    auto: 0,
    transition: 0,
    shift1: 0,
    shift2: 0,
    shift3: 0,
    shift4: 0,
    endgame: 0,
};

const emptyFouls: MatchData['fouls'] = {
    pinning: 0,
    towerContactInEndgame: 0,
    outOfZoneShooting: 0,
    ejectedFuel: 0,
    other: 0,
};

const emptyBreaks: MatchData['breaks'] = {
    mechanism: 0,
    battery: 0,
    comms: 0,
    bumper: 0,
};

function roundToHundredth(value: number) {
    return Math.round(value * 100) / 100;
}

function getActionTimeBySegment(
    value: MatchData['shootTimeBySegment'] | undefined
) {
    return {
        ...emptyActionTimeBySegment,
        ...(value ?? {}),
    };
}

function computeFuelFromShootTime(
    shootTimeBySegment: MatchData['shootTimeBySegment'],
    ballsPerSecond: number
) {
    const autoFuelScored = roundToHundredth(
        shootTimeBySegment.auto * ballsPerSecond
    );
    const teleFuelBySegment: MatchData['teleFuelBySegment'] = {
        transition: roundToHundredth(
            shootTimeBySegment.transition * ballsPerSecond
        ),
        shift1: roundToHundredth(shootTimeBySegment.shift1 * ballsPerSecond),
        shift2: roundToHundredth(shootTimeBySegment.shift2 * ballsPerSecond),
        shift3: roundToHundredth(shootTimeBySegment.shift3 * ballsPerSecond),
        shift4: roundToHundredth(shootTimeBySegment.shift4 * ballsPerSecond),
        endgame: roundToHundredth(shootTimeBySegment.endgame * ballsPerSecond),
    };
    return { autoFuelScored, teleFuelBySegment };
}

async function getBallsPerSecond(
    matchNumber: number,
    robotTeam: number | undefined
) {
    if (robotTeam === undefined) return DEFAULT_BALLS_PER_SECOND;
    const saved = await ballsPerSecondApp
        .findOne({ matchNumber, robotTeam })
        .lean();
    return saved?.ballsPerSecond ?? DEFAULT_BALLS_PER_SECOND;
}

app.post('/data/match', async (req, res) => {
    const body = req.body as MatchData;
    const shootTimeBySegment = getActionTimeBySegment(body.shootTimeBySegment);
    const passTimeBySegment = getActionTimeBySegment(body.passTimeBySegment);
    const ballsPerSecondUsed = await getBallsPerSecond(
        body.metadata.matchNumber,
        body.metadata.robotTeam
    );
    const estimatedFuel = computeFuelFromShootTime(
        shootTimeBySegment,
        ballsPerSecondUsed
    );

    const normalizedBody: MatchData = {
        ...body,
        shootTimeBySegment,
        passTimeBySegment,
        ballsPerSecondUsed,
        autoFuelScored: estimatedFuel.autoFuelScored,
        teleFuelBySegment: estimatedFuel.teleFuelBySegment,
        defenseProvided: body.defenseProvided ?? 'None',
        defenseReceived: body.defenseReceived ?? false,
        fouls: {
            ...emptyFouls,
            ...(body.fouls ?? {}),
        },
        breaks: {
            ...emptyBreaks,
            ...(body.breaks ?? {}),
        },
        comments: body.comments ?? [],
        freeText: body.freeText ?? '',
    };

    await matchApp
        .replaceOne(
            {
                'metadata.robotTeam': body.metadata.robotTeam,
                'metadata.matchNumber': body.metadata.matchNumber,
            },
            normalizedBody
        )
        .setOptions({ upsert: true });

    updateMatchStatus();
    console.log(
        chalk.gray(
            `Match data received for team ${body.metadata.robotTeam} match ${body.metadata.matchNumber}`
        )
    );

    res.end();
});

app.get('/config/balls-per-second', async (req, res) => {
    const matchNumber = Number.parseInt(String(req.query.matchNumber), 10);
    const teamRaw = req.query.teamNumber ?? req.query.robotTeam;
    const robotTeam = Number.parseInt(String(teamRaw), 10);

    if (Number.isFinite(matchNumber) && Number.isFinite(robotTeam)) {
        const ballsPerSecond = await getBallsPerSecond(matchNumber, robotTeam);
        res.send({
            matchNumber,
            robotTeam,
            ballsPerSecond,
        } satisfies BallsPerSecondSetting);
        return;
    }

    const entries = await ballsPerSecondApp.find().select('-_id -__v').lean();
    res.send(entries);
});

app.post('/config/balls-per-second', async (req, res) => {
    const body = req.body as Partial<BallsPerSecondSetting>;
    const matchNumber = Number(body.matchNumber);
    const robotTeam = Number(body.robotTeam);
    const ballsPerSecond = Number(body.ballsPerSecond);

    if (
        !Number.isFinite(matchNumber) ||
        !Number.isFinite(robotTeam) ||
        !Number.isFinite(ballsPerSecond) ||
        ballsPerSecond < 0
    ) {
        res.status(400).send('Invalid balls per second config payload');
        return;
    }

    await ballsPerSecondApp
        .replaceOne(
            { matchNumber, robotTeam },
            { matchNumber, robotTeam, ballsPerSecond }
        )
        .setOptions({ upsert: true });

    res.send({
        matchNumber,
        robotTeam,
        ballsPerSecond,
    } satisfies BallsPerSecondSetting);
});

app.post('/data/pit', async (req, res) => {
    const body = req.body as PitFile;
    try {
        const photo =
            body.photo === ''
                ? Buffer.from([])
                : Buffer.from(dataUriToBuffer(body.photo).buffer);

        await pitApp
            .replaceOne({ teamNumber: body.teamNumber }, { ...body, photo })
            .setOptions({ upsert: true });

        console.log(chalk.gray(`Pit data recieved for ${body.teamNumber}`));

        res.end();
    } catch (e) {
        res.status(500);
        res.end();
    }
});

app.get('/data/retrieve', async (req, res) => {
    res.send(await averageAndMax());
});

app.get('/data/retrieve/individualMatch', async (req, res) => {
    res.send(await maxIndividual());
});
//:)

app.get('/data/retrieve/super', async (req, res) => {
    res.send(await superAverageAndMax());
});

app.get('/data/retrieve/matchOutlier', async (req, res) => {
    res.send(await matchOutlier());
});

app.get('/data/retrieve/individualSuper', async (req, res) => {
    res.send(await superMaxIndividual());
});
//:)

app.get('/data/retrieve/scouter', async (req, res) => {
    res.send(await scouterRankings());
});

app.get('/data/pit/scouted-teams', async (req, res) => {
    res.send((await pitApp.find({}, { teamNumber: 1 })).map(e => e.teamNumber));
});

app.get('/image/:teamId.jpeg', async (req, res) => {
    const { teamId } = req.params;

    //Search the pit scouting database for info on this teamId
    const teamNumber = parseInt(teamId);

    if (isNaN(teamNumber)) {
        res.status(400);
        res.send('Query was not a number');
        return;
    }

    const imageData = await robotImageDisplay(teamNumber);

    //If the Image data DOES NOT exists:
    if (!imageData) {
        //  Return a 404 response
        res.status(404);
        res.sendFile(path.resolve('static/fallback.png'));
        return;
    }

    res.contentType('image/jpeg');
    //  Return the image data
    res.send(imageData);
});

app.get('/data/pit', async (req, res) => {
    const entries = await pitApp.find({}, { photo: 0 });

    const result: PitResult = {};

    entries.forEach(entry => (result[entry.teamNumber] = entry));

    res.send(result);
});

app.use(express.static('static'));

// Since this is the fallback is must go after all other routes
if (DEV) {
    app.use('/', createProxyMiddleware('http://localhost:5173', { ws: true }));
} else {
    app.use(express.static('../client/dist'));

    app.get('*', (_, res) => {
        res.sendFile(path.resolve('../client/dist/index.html'));
    });
}

export { app };
