import fs from 'fs';
import { CommentValues } from 'requests';

function randint(max: number, min = 0) {
    return Math.floor(randfloat(max, min));
}

function randfloat(max: number, min = 0) {
    return (max - min) * Math.random() + min;
}

const teams: number[] = `4
498
696
973
980
1148
1159
1165
1197
1572
2102
2429
2485
2543
2658
2710
2839
3128
3255
3328
3473
3512
3647
3759
3863
4201
4322
4414
4415
4481
4501
5124
5137
5199
5419
6036
6658
6764
7157
7777
8006
8020
8119
8891
9408
9452
9505
9520
9538
9635`
    .split('\n')
    .map(str => parseInt(str));

const commentValues: CommentValues[] = [
    'great_driving',
    'good_driving',
    'ok_driving',
    'rough_driving',
    'fast_cycles',
    'drops_fuel',
    'accurate_shots',
    'inaccurate_shots',
    'aggressive_defense',
    'smart_defense',
    'defense_liability',
    'fast_climb',
    'slow_climb',
    'no_climb',
];

const data = teams.map(team => {
    const matchCount = randint(12, 4);
    const superMatchCount = randint(12, 4);

    return {
        teamNumber: team,
        avgAutoFuel: randfloat(20),
        avgTeleFuelTransition: randfloat(10),
        avgTeleFuelShift1: randfloat(15),
        avgTeleFuelShift2: randfloat(15),
        avgTeleFuelShift3: randfloat(15),
        avgTeleFuelShift4: randfloat(15),
        avgTeleFuelEndgame: randfloat(20),
        avgTeleFuelActiveComputed: randfloat(40),
        avgTeleFuelWastedComputed: randfloat(10),
        climbRateLevel1: randfloat(1),
        climbRateLevel2: randfloat(1),
        climbRateLevel3: randfloat(1),
        climbFailRate: randfloat(1),
        breakdownRate: randfloat(0.4),
        matchCount,
        avgFoulsTotal: randfloat(4),
        foulRatePinning: randfloat(1),
        foulRateTowerContactInEndgame: randfloat(1),
        foulRateOutOfZoneShooting: randfloat(1),
        foulRateEjectedFuel: randfloat(1),
        foulRateOther: randfloat(1),
        avgHumanPlayerFuelScored: randfloat(5),
        defenseHeavyRate: randfloat(1),
        defenseSomeRate: randfloat(1),
        defenseReceivedRate: randfloat(1),
        superMatchCount,
        Comments: Object.fromEntries(
            commentValues.map(comment => [comment, randint(6)])
        ),
    };
});

fs.writeFileSync('static/output_analysis.json', JSON.stringify(data));
