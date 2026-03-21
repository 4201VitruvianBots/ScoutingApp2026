import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PitResult,
    TeamData,
} from 'requests';
import LinkButton from '../../components/LinkButton';
import { useFetchJson } from '../../lib/useFetch';
import { useMemo, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import TeamDropdown from '../../components/TeamDropdown';
import FuelPerMatchChart from '../../components/charts/FuelPerMatchChart';
import SuperFoulsPerMatchChart from '../../components/charts/SuperFoulsPerMatchChart';
import SuperBreaksPerMatchChart from '../../components/charts/SuperBreaksPerMatchChart';
import { snakeToSpaced } from '../../lib/snakeCaseConvert';

function formatPercent(value: number, digits = 1) {
    if (!Number.isFinite(value)) return 'N/A';
    return `${(value * 100).toFixed(digits)}%`;
}

function ReconApp() {
    const [teamAgg, reloadTeamAgg] =
        useFetchJson<MatchDataAggregations[]>('/data/retrieve');
    const [matchRows, reloadMatchRows] = useFetchJson<
        MatchIndividualDataAggregations[]
    >('/data/retrieve/individualMatch');
    const [pitData, reloadPitData] = useFetchJson<PitResult>('/data/pit');
    const [teamInfo, reloadTeamInfo] = useFetchJson<TeamData>('/team_info.json');

    const [teamNumber, setTeamNumber] = useState<number>();
    const sectionClass =
        'rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20';

    const aggregate = teamAgg?.find(entry => entry._id.teamNumber === teamNumber);
    const teamPhotoSrc = teamNumber ? `/image/${teamNumber}.jpeg` : null;
    const pitEntry = teamNumber ? pitData?.[teamNumber] : undefined;
    const teamMeta = teamNumber ? teamInfo?.[teamNumber.toString()] : undefined;
    const teamInfoDetails = teamMeta?.info;

    const teamRows = useMemo(
        () =>
            (matchRows ?? [])
                .filter(row => row._id.teamNumber === teamNumber)
                .sort((a, b) => a._id.matchNumber - b._id.matchNumber),
        [matchRows, teamNumber]
    );

    const timelineCoverage = teamRows.length
        ? teamRows.filter(row => row.actionTimeline != null).length / teamRows.length
        : 0;

    return (
        <div className='min-h-screen bg-gradient-to-b from-[#171c26] via-[#161b22] to-[#12151d] px-6 pb-10 text-white'>
            <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 pt-8'>
                <div className='flex flex-wrap items-center justify-between gap-4'>
                    <h1 className='text-3xl font-bold text-[#48c55c]'>Recon Dashboard</h1>
                    <div className='flex items-center gap-2'>
                        <LinkButton link='/' className='snap-none'>
                            <MaterialSymbol
                                icon='home'
                                size={50}
                                fill
                                grade={200}
                                color='green'
                                className='snap-none'
                            />
                        </LinkButton>
                        <button
                            className='rounded-lg bg-gray-700 px-3 py-2 text-sm transition hover:bg-gray-600 active:scale-[0.98]'
                            onClick={() => {
                                reloadTeamAgg();
                                reloadMatchRows();
                                reloadPitData();
                                reloadTeamInfo();
                            }}>
                            Reload Data
                        </button>
                    </div>
                </div>

                <section className={sectionClass}>
                    <p className='text-sm uppercase text-gray-300'>Team</p>
                    <div className='mt-2'>
                        <TeamDropdown onChange={setTeamNumber} value={teamNumber} />
                    </div>
                </section>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>Team Snapshot</h2>
                        <div className='mt-3 space-y-1 text-sm text-gray-200'>
                            <p className='text-base font-semibold text-white'>
                                {teamNumber ? `Team ${teamNumber}` : 'Select a team'}
                            </p>
                            {teamInfoDetails && (
                                <>
                                    <p className='text-gray-300'>{teamInfoDetails.nickname}</p>
                                    <p>
                                        {teamInfoDetails.city}, {teamInfoDetails.state_prov},{' '}
                                        {teamInfoDetails.country}
                                    </p>
                                    <p>Rookie Year: {teamInfoDetails.rookie_year}</p>
                                </>
                            )}
                        </div>

                        <div className='mt-4 grid grid-cols-2 gap-2 text-sm'>
                            <div className='rounded-lg border border-white/10 bg-[#1f2432] p-2'>
                                <p className='text-xs uppercase text-gray-400'>Matches</p>
                                <p className='text-lg font-semibold'>{aggregate?.matchCount ?? 0}</p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1f2432] p-2'>
                                <p className='text-xs uppercase text-gray-400'>Timeline Coverage</p>
                                <p className='text-lg font-semibold'>{formatPercent(timelineCoverage)}</p>
                            </div>
                        </div>

                        <h3 className='mt-5 text-sm font-semibold text-gray-200'>Pit Snapshot</h3>
                        <div className='mt-2 space-y-1 text-sm text-gray-200'>
                            <p>Drivebase: {pitEntry?.drivebase ?? 'N/A'}</p>
                            <p>Batteries: {pitEntry?.batteryCount ?? 'N/A'}</p>
                            <p>Storage: {pitEntry?.maxFuelStorageEstimate ?? 'N/A'}</p>
                            <p>
                                Intake:{' '}
                                {pitEntry?.intakeSources
                                    ? Object.entries(pitEntry.intakeSources)
                                          .filter(([, value]) => value)
                                          .map(([key]) => snakeToSpaced(key))
                                          .join(', ') || 'None'
                                    : 'N/A'}
                            </p>
                            <p>
                                Notes: <span className='text-gray-300'>{pitEntry?.notes || 'N/A'}</span>
                            </p>
                        </div>
                    </section>

                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>Team Photo</h2>
                        <div className='mt-4 flex items-center justify-center'>
                            {teamPhotoSrc ? (
                                <img
                                    src={teamPhotoSrc}
                                    alt={`Team ${teamNumber} robot`}
                                    className='h-[240px] w-full max-w-[420px] rounded-lg border border-gray-700 object-contain bg-[#1f2432]'
                                />
                            ) : (
                                <div className='flex h-[240px] w-full max-w-[420px] items-center justify-center rounded-lg border border-dashed border-gray-600 text-sm text-gray-400'>
                                    Select a team to view a photo
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>Fuel Per Match (Segments)</h2>
                        <FuelPerMatchChart data={matchRows || []} teamNumber={teamNumber} mode='segments' />
                    </section>

                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>Fouls Per Match</h2>
                        <SuperFoulsPerMatchChart data={matchRows || []} teamNumber={teamNumber} />
                    </section>
                </div>

                <section className={sectionClass}>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>Breaks Per Match</h2>
                    <SuperBreaksPerMatchChart data={matchRows || []} teamNumber={teamNumber} />
                </section>

                <section className={sectionClass}>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>Aggregate Metrics</h2>
                    <div className='mt-3 grid gap-2 text-sm text-gray-200 md:grid-cols-2'>
                        <p>Avg Auto Fuel: <span className='font-semibold text-white'>{aggregate?.avgAutoFuel?.toFixed(2) ?? 'N/A'}</span></p>
                        <p>Avg Tele Fuel: <span className='font-semibold text-white'>{aggregate?.avgTeleFuelTotal?.toFixed(2) ?? 'N/A'}</span></p>
                        <p>Avg Fuel Total: <span className='font-semibold text-white'>{aggregate?.avgFuelTotal?.toFixed(2) ?? 'N/A'}</span></p>
                        <p>Avg Shoot Active: <span className='font-semibold text-white'>{aggregate?.avgShootActiveSec?.toFixed(2) ?? 'N/A'}s</span></p>
                        <p>Avg Pass Active: <span className='font-semibold text-white'>{aggregate?.avgPassActiveSec?.toFixed(2) ?? 'N/A'}s</span></p>
                        <p>Driver Quality: <span className='font-semibold text-white'>{formatPercent(aggregate?.driverQualityScoreAvg ?? 0)}</span></p>
                        <p>Breakdown Rate: <span className='font-semibold text-white'>{formatPercent(aggregate?.breakdownRate ?? 0)}</span></p>
                        <p>Foul Rate (Total): <span className='font-semibold text-white'>{aggregate?.avgFoulsTotal?.toFixed(2) ?? 'N/A'}</span></p>
                        <p>Defense Heavy: <span className='font-semibold text-white'>{formatPercent(aggregate?.defenseHeavyRate ?? 0)}</span></p>
                        <p>Defense Received: <span className='font-semibold text-white'>{formatPercent(aggregate?.defenseReceivedRate ?? 0)}</span></p>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default ReconApp;
