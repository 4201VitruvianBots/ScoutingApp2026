import Dialog from '../../../components/Dialog';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { AnalysisEntry, TeamSummaryData } from '../data';
import { PitResult, TeamData } from 'requests';
import RobotPhotoDialog from './RobotPhotoDialog';
import { snakeToSpaced } from '../../../lib/snakeCaseConvert';

function commentToColor(comment: string) {
    switch (comment) {
        case 'great_driving':
        case 'fast_cycles':
        case 'accurate_shots':
        case 'smart_defense':
        case 'fast_climb':
            return 'bg-[#5ac750]';
        case 'good_driving':
            return 'bg-[#50a1c7]';
        case 'ok_driving':
        case 'slow_climb':
            return 'bg-[#c78450]';
        case 'drops_fuel':
        case 'inaccurate_shots':
        case 'defense_liability':
        case 'no_climb':
            return 'bg-[#c78450]';
        case 'aggressive_defense':
            return 'bg-[#c107f0]';
        case 'rough_driving':
            return 'bg-[#c75050]';
        default:
            return 'bg-gray-500';
    }
}

function TeamSummary({
    table,
    data,
    teamInfoJson,
    pitData,
}: {
    table: TeamSummaryData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
    pitData: PitResult;
}) {
    // Get the data for the team specified
    const teamData = data.find(e => e.teamNumber === table.teamNumber);

    const { info: teamInfo, avatar } = teamInfoJson[table.teamNumber] ?? {};
    const teamPitData = pitData[table.teamNumber];

    return (
        <div className='flex flex-row '>
            <div>
                <div className='flex space-x-4'>
                    {avatar && <img src={`data:image/png;base64,${avatar}`} />}
                    <h1 className='text-3xl'>
                        Team{' '}
                        {teamInfo
                            ? `${teamInfo.team_number} - ${teamInfo.nickname}`
                            : table.teamNumber}
                    </h1>
                </div>

                {teamInfo && (
                    <>
                        <p className='max-w-md text-gray-500'>
                            {teamInfo.name}
                        </p>
                        <br />

                        <div className='flex space-x-4'>
                            <p>
                                From {teamInfo.city}, {teamInfo.state_prov},{' '}
                                {teamInfo.country}
                            </p>
                            <p>Rookie Year: {teamInfo.rookie_year}</p>
                        </div>
                    </>
                )}

                <br />

                <Dialog
                    trigger={open => (
                        <button onClick={open}>
                            <img
                                src={`/image/${table.teamNumber}.jpeg`}
                                width='400'
                                alt=''
                            />
                        </button>
                    )}>
                    {close => (
                        <RobotPhotoDialog
                            teamNumber={table.teamNumber}
                            onClose={close}
                        />
                    )}
                </Dialog>
            </div>
            <div className='pl-5'>
                <h2 className='pb-2 text-2xl'>Comments</h2>

                {teamData &&
                    teamData.Comments &&
                    Object.entries(teamData.Comments)
                        .sort(([_, a], [__, b]) => b - a)
                        .map(
                            ([comment, count]) =>
                                count > 0 && (
                                    <p
                                        className={` text-md m-2 max-w-fit rounded-lg border py-1 pl-2 text-zinc-100 saturate-[75%]  ${commentToColor(comment)} `}>
                                        {snakeToSpaced(comment)}{' '}
                                        <span className='rounded-r-lg bg-black/15 p-2 py-1'>
                                            {count}
                                        </span>
                                    </p>
                                )
                        )}

                <h2 className='pb-2 pt-5 text-2xl'>Stats</h2>

                {teamData &&
                    Object.keys(teamData).map(e => {
                        if (
                            e !== 'teamNumber' &&
                            e !== 'scouterName' &&
                            e !== 'Comments' &&
                            e !== 'matchCount' &&
                            e !== 'superMatchCount'
                        ) {
                            return (
                                <p key={e}>
                                    {camelToSpaced(e)}: {teamData[e]}
                                </p>
                            );
                        }
                    })}
            </div>
            <div>
                <h2 className='pb-2 text-2xl'>Pit Scout Info</h2>
                <p className='indent-3'>Batteries: {teamPitData?.batteryCount}</p>
                <p className='indent-3'>Drivebase: {teamPitData?.drivebase}</p>
                <p className='indent-3'>
                    Max Fuel Storage: {teamPitData?.maxFuelStorageEstimate ?? 'N/A'}
                </p>
                <p className='indent-3'>
                    Intake Sources:{' '}
                    {teamPitData?.intakeSources
                        ? Object.entries(teamPitData.intakeSources)
                              .filter(([, value]) => value)
                              .map(([key]) => snakeToSpaced(key))
                              .join(', ') || 'None'
                        : 'N/A'}
                </p>
                <p className='indent-3'>
                    Scoring Method: {teamPitData?.scoringMethod}
                </p>
                <p className='indent-3'>
                    Preferred Spot: {teamPitData?.preferredScoringSpot}
                </p>
                <p className='indent-3'>
                    Tower Capability: {teamPitData?.towerCapabilityClaimed}
                </p>
                <p className='indent-3'>Notes: {teamPitData?.notes}</p>


                {/* <p className='text-lg font-semibold text-green-800 pt-2'>More Info</p> */}
            </div>
        </div>
    );
}

export default TeamSummary;
