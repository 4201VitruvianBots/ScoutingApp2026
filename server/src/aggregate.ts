import { MatchDataAggregations, SuperDataAggregations, ScouterData, SuperFoulAggregationsData, MatchIndividualDataAggregations, matchOutliersAggregation } from 'requests';
import { matchApp, superApp, pitApp, leaderboardApp } from './Schema.js';
//no scouterdata??


async function averageAndMax(): Promise<MatchDataAggregations[]> {
    await matchApp.aggregate([
        {
            $group: {
                _id: {
                    matchNumber: '$metadata.matchNumber',
                    alliance: {
                        $cond: [
                            {
                                $in: [
                                    '$metadata.robotPosition',
                                    ['red_1', 'red_2', 'red_3'],
                                ],
                            },
                            'red',
                            'blue',
                        ],
                    },
                },
                shallow: {
                    $sum: { $cond: [{ $eq: ['$climb', 'shallow'] }, 1, 0] },
                },
                deep: {
                    $sum: { $cond: [{ $eq: ['$climb', 'deep'] }, 1, 0] },
                },
                teams: {
                    $push: '$metadata.robotTeam',
                },
            },
        },
    ]);

    const result = await matchApp.aggregate([
        {
            $group: {
                _id: { teamNumber: '$metadata.robotTeam'}, 
                averageCoral: {
                    $avg: {
                        $add: [
                            '$teleCoral.L1',
                            '$teleCoral.L2',
                            '$teleCoral.L3',
                            '$teleCoral.L4',
                            '$autoCoral.L1',
                            '$autoCoral.L2',
                            '$autoCoral.L3',
                            '$autoCoral.L4'
                        ],
                    },
                },
                averageAlgae: { 
                    $avg: {
                        $add: [
                            '$autoAlgae.processor', 
                            '$teleAlgae.processor',
                            '$autoAlgae.netRobot',
                            '$teleAlgae.netRobot'
                        ],
                    },
                },
                averageRemove: { 
                    $avg: {
                        $add: [
                            '$autoAlgae.removed', 
                            '$teleAlgae.removed'
                        ]
                    }
                },
                avgClimbRate: {
                    $avg: {
                        $cond: [
                            { $in: ['$climb', ['shallow', 'deep']]},
                            1,
                            { $cond: [{ $eq: ['$climb', 'failed'] }, 0, null] },
                        ],
                    },
                },
                totalL1: {
                    $sum: {
                        $add: [
                            '$autoCoral.L1',
                            '$teleCoral.L1'
                        ]
                    }
                },
                totalL2: {
                    $sum: {
                        $add: [
                            '$autoCoral.L2',
                            '$teleCoral.L2'
                        ]
                    }
                },
                totalL3: {
                    $sum: {
                        $add: [
                            '$autoCoral.L3',
                            '$teleCoral.L3'
                        ]
                    }
                },
                totalL4: {
                    $sum: {
                        $add: [
                            '$autoCoral.L4',
                            '$teleCoral.L4'
                        ]
                    }
                },
                totalProcessor: {
                    $sum: {
                        $add: [
                            '$autoAlgae.processor',
                            '$teleAlgae.processor'
                        ]
                    }
                },
                totalNet: {
                    $sum: {
                        $add: [
                            '$autoAlgae.netRobot',
                            '$teleAlgae.netRobot'
                        ]
                    }
                },
                totalRemoved: {
                    $sum: {
                        $add: [
                            '$autoAlgae.removed',
                            '$teleAlgae.removed'
                        ]
                    }
                },
                coralDrop1: {
                    $push: {
                       $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                coralDrop2: {
                    $push: {
                       $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                coralDrop3: {
                    $push: {
                       $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                coralDrop4: {
                    $push: {
                       $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                coralDrop5: {
                    $push: {
                       $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                coralDrop6: {
                    $push: {
                       $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                groundPick1: {
                    $push: {
                        $toBool: [
                            '$pickupLocation.ground1'
                        ]
                    }
                },
                groundPick2: {
                    $push: {
                        $toBool: [
                            '$pickupLocation.ground2'
                        ]
                    }
                },
                groundPick3: {
                    $push: {
                        $toBool: [
                            '$pickupLocation.ground3'
                        ]
                    }
                },
                sourcePick1: {
                    $push: {
                        $toBool: [
                            '$pickupLocation.source1'
                        ]
                    }
                },
                sourcePick2: {
                    $push: {
                        $toBool: [
                            '$pickupLocation.source2'
                        ]
                    }
                },
                start1: {
                    $push: {
                        $toBool: [
                            '$startingZone.start1'
                        ]
                    }
                },
                start2: {
                    $push: {
                        $toBool: [
                            '$startingZone.start2'
                        ]
                    }
                },
                start3: {
                    $push: {
                        $toBool: [
                            '$startingZone.start3'
                        ]
                    }
                },
            }
        },
    ]);
    return result;
}



async function maxIndividual(): Promise<MatchIndividualDataAggregations[]> {
    const result = await matchApp.aggregate([
        {
            $group: {
                _id: { teamNumber: '$metadata.robotTeam', matchNumber: '$metadata.matchNumber', robotPosition: '$metadata.robotPosition'},
                totalL1: {
                    $sum: {
                        $add: [
                            '$autoCoral.L1',
                            '$teleCoral.L1'
                        ]
                    }
                },
                totalL2: {
                    $sum: {
                        $add: [
                            '$autoCoral.L2',
                            '$teleCoral.L2'
                        ]
                    }
                },
                totalL3: {
                    $sum: {
                        $add: [
                            '$autoCoral.L3',
                            '$teleCoral.L3'
                        ]
                    }
                },
                totalL4: {
                    $sum: {
                        $add: [
                            '$autoCoral.L4',
                            '$teleCoral.L4'
                        ]
                    }
                },
                totalProcessor: {
                    $sum: {
                        $add: [
                            '$autoAlgae.processor',
                            '$teleAlgae.processor'
                        ]
                    }
                },
                totalNet: {
                    $sum: {
                        $add: [
                            '$autoAlgae.netRobot',
                            '$teleAlgae.netRobot'
                        ]
                    }
                },
                totalRemoved: {
                    $sum: {
                        $add: [
                            '$autoAlgae.removed',
                            '$teleAlgae.removed'
                        ]
                    }
                },
                coralDrop1: {
                    $first: {    
                        $toBool: [
                        '$placement.deposit1'
                       ]
                    }
                },
                coralDrop2: {
                    $first: {
                       $toBool: [
                        '$placement.deposit2'
                       ]
                    }
                },
                coralDrop3: {
                    $first: {
                       $toBool: [
                        '$placement.deposit3'
                       ]
                    }
                },
                coralDrop4: {
                    $first: {
                       $toBool: [
                        '$placement.deposit4'
                       ]
                    }
                },
                coralDrop5: {
                    $first: {
                       $toBool: [
                        '$placement.deposit5'
                       ]
                    }
                },
                coralDrop6: {
                    $first: {
                       $toBool: [
                        '$placement.deposit6'
                       ]
                    }
                },
                groundPick1: {
                    $first: {
                        $toBool: [
                            '$pickupLocation.ground1'
                        ]
                    }
                },
                groundPick2: {
                    $first: {
                        $toBool: [
                            '$pickupLocation.ground2'
                        ]
                    }
                },
                groundPick3: {
                    $first: {
                        $toBool: [
                            '$pickupLocation.ground3'
                        ]
                    }
                },
                sourcePick1: {
                    $first: {
                        $toBool: [
                            '$pickupLocation.source1'
                        ]
                    }
                },
                sourcePick2: {
                    $first: {
                        $toBool: [
                            '$pickupLocation.source2'
                        ]
                    }
                },
                start1: {
                    $first: {
                        $toBool: [
                            '$startingZone.start1'
                        ]
                    }
                },
                start2: {
                    $first: {
                        $toBool: [
                            '$startingZone.start2'
                        ]
                    }
                },
                start3: {
                    $first: {
                        $toBool: [
                            '$startingZone.start3'
                        ]
                    }
                },
            }
        }
     
    ]);
    return result;
}

async function matchOutlier(): Promise<matchOutliersAggregation[]> {
    return await matchApp.aggregate([
       { 
        $group: {
            _id:  { teamNumber: '$metadata.alliance' },
            matchOutlier: {
                $sum: {
                    autoL1: {
                        $multiply: [
                            '$autoCoral.L1', 3
                        ]
                    },
                    autoL2:  {
                        $multiply: [
                            '$autoCoral.L2', 4
                        ]
                    },
                    autoL3: {
                        $multiply: [
                            '$autoCoral.L3', 6
                        ]
                    },
                    autoL4: {
                        $multiply: [
                            '$autoCoral.L4', 7
                        ]
                    },
                    leave: {
                       $multiply: [ { $cond: [{$eq: ['$leftStartingZone', true]}, 1, 0]}, 3], 
                    },
                    teleL1: {
                        $multiply: [
                            '$teleCoral.L1', 2
                        ]
                    },
                    teleL2: {
                        $multiply: [
                            '$teleCoral.L2', 3
                        ]
                    },
                    tele3: {
                        $multiply: [
                            '$teleCoral.L3', 4
                        ]
                    },
                    tele4:{
                        $multiply: [
                            '$teleCoral.L4', 5
                        ]
                    },
                    teleProcessor: {
                        $multiply: [
                            '$teleAlgae.processor', 6
                        ]
                    },
                    teleNet: {
                        $multiply: [
                            {$add: [
                                '$teleAlgae.netRobot', '$teleAlgae.netHuman'
                            ]}, 4
                        ]
                    },
                    park: {
                        $multiply: [
                            {$cond: [{ $eq: [ '$climb','park']}, 1, 0]}, 2
                        ]
                    },
                    shallow: {
                        $multiply: [
                            {$cond: [{ $eq: [ '$climb', 'shallow']}, 1, 0]}, 6
                        ]
                    },
                    deep: {
                        $multiply: [
                            {$cond: [{ $eq: [ '$climb', 'deep']}, 1, 0]}, 12
                        ]
                    }
                }
            }
        },
       }
    ]);
;}


async function superAverageAndMax(): Promise<SuperDataAggregations[]> {
    return await superApp.aggregate([
        {
            $group: {
                _id: { teamNumber: '$metadata.robotTeam' },
                avgFouls: {
                    $avg: {
                        $add: [
                            '$fouls.protectedZone',
                            '$fouls.multiplePieces',
                            '$fouls.insideRobot',
                            '$fouls.pinning',
                            '$fouls.cageFoul',
                            '$fouls.other',
                        ],
                    },
                },
                maxFouls: {
                    $max: {
                        $add: [
                            '$fouls.protectedZone',
                            '$fouls.multiplePieces',
                            '$fouls.insideRobot',
                            '$fouls.pinning',
                            '$fouls.cageFoul',
                            '$fouls.other',
                        ],
                    },
                }, 
                humanAccuracy: {
                    $avg: {
                     $cond: [
                        {$eq: [ {$add: [
                            "$humanShooter.Success",
                            "$humanShooter.Failed"
                            ]
                        }, 0]},
                        null,
                        {$divide: [
                            '$humanShooter.Success',
                            {$add: [
                                "$humanShooter.Success",
                                "$humanShooter.Failed"
                                ]
                            }    
                        ]}
                     ]
                    }
                }

            } satisfies { [K in keyof SuperDataAggregations]: unknown },
        },
    ]);
}

async function superMaxIndividual(): Promise<SuperFoulAggregationsData[]> {
    return await superApp.aggregate([
        {
            $group: {
                _id: { teamNumber: '$metadata.robotTeam', matchNumber: '$metadata.matchNumber' },
                totalInsideRobot: {
                    $push: {
                       $add: [ '$fouls.insideRobot']
                    }
                },
                totalProtectedZone: {
                    $push: {    
                        $add: ['$fouls.protectedZone']
                    } 
                },
                totalPinning: {
                    $push: {    
                        $add: ['$fouls.pinning']
                    } 
                },
                totalMultiplePieces: {
                    $push: {    
                        $add: ['$fouls.multiplePieces']
                    } 
                },
                totalCageFoul: {
                    $push: {    
                        $add: ['$fouls.cageFoul']
                    } 
                },
                totalOther: {
                    $push: {    
                        $add: ['$fouls.other']
                    } 
                },
                

            } satisfies { [K in keyof SuperFoulAggregationsData]: unknown },
        },
    ]);
}

// async function scouterRankings(): Promise<ScouterDataAggregations[]> {
//     return await leaderboardApp.aggregate([
//         {
//             $group: {
//                 _id: { scouterName: '$metadata.scouterName' },

//                 accuracy: {
                   
                    
//                 },
//             } satisfies { [K in keyof ScouterDataAggregations]: unknown },
//         },
//     ]);
// }

async function scouterRankings(): Promise<ScouterData[]> {
    const filter = {};
    const result =  await leaderboardApp.find(filter)
    return (
        result
    );
}



async function robotImageDisplay(
    teamNumber: number
): Promise<Buffer | undefined> {
    return (
        await pitApp.findOne({ teamNumber: teamNumber }, 'teamNumber photo')
    )?.photo;
}

export { averageAndMax, superAverageAndMax, robotImageDisplay, scouterRankings, superMaxIndividual, maxIndividual, matchOutlier };