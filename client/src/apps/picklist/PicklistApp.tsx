import { AnalysisEntry, WindowData } from './data';
import { MatchDataAggregations, PitResult, SuperDataAggregations, TeamData } from 'requests';
import Workspace from '../../components/workspace/Workspace';
import { useWorkspaceState } from '../../components/workspace/useWorkspaceState';
import StatTable from './components/StatTable';
import Dialog from '../../components/Dialog';
import StatDialog from './components/StatDialog';
import { useFetchJson } from '../../lib/useFetch';
import BarGraphDialog from './components/BarDialog';
import BarGraph from './components/BarGraph';
import ScatterPlotDialog from './components/ScatterPlotDialog';
import ScatterPlotGraph from './components/ScatterPlotGraph';
import { MaterialSymbol } from 'react-material-symbols';
import LinkButton from '../../components/LinkButton';
import StatSummaryDialog from './components/StatSummaryDialog';
import StatSummary from './components/StatSummary';
import TeamSummaryDialog from './components/TeamSummaryDialog';
import TeamSummary from './components/TeamSummary';
import { Dispatch, useState } from 'react';
import FinalPicklist from './components/FinalPicklist';

function generateWindow(
    data: AnalysisEntry[],
    table: WindowData,
    setTable: Dispatch<WindowData>,
    teamInfoJson: TeamData,
    pitData: PitResult,
    addToFocused: Dispatch<WindowData>,
    setFinalPicklist: Dispatch<number[]>
) {
    switch (table.type) {
        case 'StatTable':
            return (
                <StatTable
                    data={data}
                    setTable={setTable}
                    table={table}
                    teamInfoJson={teamInfoJson}
                    onSubmit={addToFocused}
                    onSetFinal={setFinalPicklist}
                />
            );
        case 'BarGraph':
            return (
                <BarGraph
                    data={data}
                    table={table}
                    teamInfoJson={teamInfoJson}
                />
            );
        case 'ScatterPlotGraph':
            return (
                <ScatterPlotGraph
                    data={data}
                    table={table}
                    teamInfoJson={teamInfoJson}
                />
            );
        case 'StatSummary':
            return (
                <StatSummary
                    data={data}
                    table={table}
                    teamInfoJson={teamInfoJson}
                />
            );
        case 'TeamSummary':
            return (
                <TeamSummary
                    data={data}
                    table={table}
                    pitData={pitData}
                    teamInfoJson={teamInfoJson}
                />
            );
        default:
            return undefined;
    }
}

function PicklistApp() {
    const [matchAgg, reloadMatchAgg] = useFetchJson<MatchDataAggregations[]>(
        '/data/retrieve'
    );
    const [superAgg, reloadSuperAgg] = useFetchJson<SuperDataAggregations[]>(
        '/data/retrieve/super'
    );
    const [pitData, reloadPitData] = useFetchJson<PitResult>('/data/pit');
    const [teamInfo] = useFetchJson<TeamData>('/team_info.json');

    const [views, setViews, addToFocused, controls] =
        useWorkspaceState<WindowData>();

    const [finalPicklist, setFinalPicklist] = useState<number[]>([]);
    const analyzedData: AnalysisEntry[] = [];

    const superByTeam = new Map(
        (superAgg || []).map(entry => [entry._id.teamNumber, entry])
    );
    const allTeams = new Set<number>();
    (matchAgg || []).forEach(entry => allTeams.add(entry._id.teamNumber));
    (superAgg || []).forEach(entry => allTeams.add(entry._id.teamNumber));

    allTeams.forEach(teamNumber => {
        const matchEntry = matchAgg?.find(
            entry => entry._id.teamNumber === teamNumber
        );
        const superEntry = superByTeam.get(teamNumber);
        const avgTeleFuelTotal =
            (matchEntry?.avgTeleFuelTransition ?? 0) +
            (matchEntry?.avgTeleFuelShift1 ?? 0) +
            (matchEntry?.avgTeleFuelShift2 ?? 0) +
            (matchEntry?.avgTeleFuelShift3 ?? 0) +
            (matchEntry?.avgTeleFuelShift4 ?? 0) +
            (matchEntry?.avgTeleFuelEndgame ?? 0);
        const avgAutoFuel = matchEntry?.avgAutoFuel ?? 0;
        const avgFuelTotal = avgAutoFuel + avgTeleFuelTotal;
        const avgTeleFuelActiveComputed = matchEntry?.avgTeleFuelActiveComputed ?? 0;
        const avgTeleFuelWastedComputed = matchEntry?.avgTeleFuelWastedComputed ?? 0;
        const teleFuelActiveRate = avgTeleFuelTotal
            ? avgTeleFuelActiveComputed / avgTeleFuelTotal
            : 0;
        const teleFuelEfficiency =
            avgTeleFuelActiveComputed + avgTeleFuelWastedComputed
                ? avgTeleFuelActiveComputed /
                  (avgTeleFuelActiveComputed + avgTeleFuelWastedComputed)
                : 0;
        const climbFailRate = matchEntry?.climbFailRate ?? 0;
        const climbRateLevel2 = matchEntry?.climbRateLevel2 ?? 0;
        const climbRateLevel3 = matchEntry?.climbRateLevel3 ?? 0;
        const breakdownRate = matchEntry?.breakdownRate ?? 0;
        const avgFoulsTotal = superEntry?.avgFoulsTotal ?? 0;
        const defenseHeavyRate = superEntry?.defenseHeavyRate ?? 0;
        const defenseSomeRate = superEntry?.defenseSomeRate ?? 0;

        analyzedData.push({
            teamNumber,
            avgAutoFuel,
            avgTeleFuelTransition: matchEntry?.avgTeleFuelTransition ?? 0,
            avgTeleFuelShift1: matchEntry?.avgTeleFuelShift1 ?? 0,
            avgTeleFuelShift2: matchEntry?.avgTeleFuelShift2 ?? 0,
            avgTeleFuelShift3: matchEntry?.avgTeleFuelShift3 ?? 0,
            avgTeleFuelShift4: matchEntry?.avgTeleFuelShift4 ?? 0,
            avgTeleFuelEndgame: matchEntry?.avgTeleFuelEndgame ?? 0,
            avgTeleFuelActiveComputed,
            avgTeleFuelWastedComputed,
            avgTeleFuelTotal,
            avgFuelTotal,
            teleFuelActiveRate,
            teleFuelEfficiency,
            climbRateLevel1: matchEntry?.climbRateLevel1 ?? 0,
            climbRateLevel2,
            climbRateLevel3,
            climbFailRate,
            climbSuccessRate: Math.max(0, 1 - climbFailRate),
            climbLevel2PlusRate: climbRateLevel2 + climbRateLevel3,
            breakdownRate,
            reliabilityScore: Math.max(0, 1 - breakdownRate),
            matchCount: matchEntry?.matchCount ?? 0,
            avgFoulsTotal,
            foulRatePinning: superEntry?.foulRatePinning ?? 0,
            foulRateTowerContactInEndgame:
                superEntry?.foulRateTowerContactInEndgame ?? 0,
            foulRateOutOfZoneShooting:
                superEntry?.foulRateOutOfZoneShooting ?? 0,
            foulRateEjectedFuel: superEntry?.foulRateEjectedFuel ?? 0,
            foulRateOther: superEntry?.foulRateOther ?? 0,
            avgHumanPlayerFuelScored: superEntry?.avgHumanPlayerFuelScored ?? 0,
            defenseHeavyRate,
            defenseSomeRate,
            defenseReceivedRate: superEntry?.defenseReceivedRate ?? 0,
            defenseAggressionScore: defenseHeavyRate * 2 + defenseSomeRate,
            disciplineScore: Math.max(0, 1 - avgFoulsTotal / 6),
            superMatchCount: superEntry?.matchCount ?? 0,
            Comments: superEntry?.commentCounts ?? {},
        });
    });

    return (
        <main className='relative grid h-screen grid-rows-[auto_1fr] overflow-hidden'>
            <div className='flex items-center border-b border-black bg-gray-100 py-3'>
                <LinkButton
                    link='/'
                    className='flex snap-none items-center justify-center px-2'>
                    <MaterialSymbol
                        icon='home'
                        size={50}
                        fill
                        grade={200}
                        color='black'
                        className='snap-none'
                    />
                </LinkButton>

                <button
                    className='flex snap-none items-center justify-center px-2'
                    onClick={() => {
                        reloadMatchAgg();
                        reloadSuperAgg();
                        reloadPitData();
                    }}
                    title='Refresh Data'>
                    <MaterialSymbol
                        icon='refresh'
                        size={50}
                        grade={200}
                        color='black'
                        className='snap-none'
                    />
                </button>

                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Stat Table'>
                            <div className='flex items-center justify-center border border-black bg-gray-300 p-1'>
                                <MaterialSymbol
                                    icon='table'
                                    size={50}
                                    grade={200}
                                    color='black'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <StatDialog onSubmit={addToFocused} onClose={close} />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Stat Summary'>
                            <div className='flex items-center justify-center border border-black bg-gray-300 p-1'>
                                <MaterialSymbol
                                    icon='graphic_eq'
                                    size={50}
                                    grade={200}
                                    color='black'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <StatSummaryDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Bar Graph'>
                            <div className='flex items-center justify-center border border-black bg-gray-300 p-1'>
                                <MaterialSymbol
                                    icon='bar_chart_4_bars'
                                    size={50}
                                    grade={200}
                                    color='black'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <BarGraphDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button className='flex snap-none items-center justify-center px-2' onClick={open} title="Add Scatter Plot">
                            <div className='flex items-center justify-center bg-gray-300 border border-black p-1'>
                                <MaterialSymbol icon="scatter_plot" size={50} grade={200} color='black' className='snap-none'/>
                            </div>
                        </button>
                    )}>
                    {close => (
                        <ScatterPlotDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Team Summary'>
                            <div className='flex items-center justify-center border border-black bg-gray-300 p-1'>
                                <MaterialSymbol
                                    icon='robot'
                                    size={50}
                                    grade={200}
                                    color='black'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <TeamSummaryDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <h1 className='left-1/2 flex-grow text-center text-3xl font-bold xl:absolute xl:-translate-x-1/2 xl:p-6'>
                    Statistical Analysis
                </h1>
            </div>
            <Workspace value={views} onChange={setViews} controls={controls}>
                {(value, onChange) => {
                    return (
                        analyzedData &&
                        generateWindow(
                            analyzedData,
                            value,
                            onChange,
                            teamInfo || {},
                            pitData || {},
                            addToFocused,
                            setFinalPicklist
                        )
                    );
                }}
            </Workspace>
            <FinalPicklist
                onSubmit={addToFocused}
                teamInfoJson={teamInfo || {}}
                data={analyzedData}
                picklist={finalPicklist}
                setPicklist={setFinalPicklist}
            />
        </main>
    );
}

export default PicklistApp;
