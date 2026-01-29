import { ScouterData } from 'requests';
import { StatRow } from './components/StatRow';
import LinkButton from '../../components/LinkButton';
import { MaterialSymbol } from 'react-material-symbols';
import { useFetchJson } from '../../lib/useFetch';



function LeaderboardApp() {
    
    const [retrieveScouter, reloadRetrieveScouter] =
    useFetchJson<ScouterData[]>('/data/retrieve/scouter');

    const sortedScouters = (retrieveScouter ?? []).sort(
        (a, b) => b.accuracy - a.accuracy
    );

    return (
       <div className='min-h-screen bg-gradient-to-b from-[#171c26] via-[#161b22] to-[#12151d] text-white'> 
        <main className='mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 pb-12 pt-8'>
            <h1 className='text-center text-3xl font-bold text-[#48c55c]'>
                Scouting Leaderboard
            </h1>

            <div className='fixed left-4 top-4 z-20 flex flex-col gap-2 rounded-xl border border-white/10 bg-[#1f2432]/90 p-2 shadow-lg shadow-black/40 backdrop-blur'>
                <LinkButton link='/' className='snap-none'>
                    <MaterialSymbol
                        icon='home'
                        size={60}
                        fill
                        grade={200}
                        color='green'
                        className='snap-none'
                    />
                </LinkButton>
            </div>

            <button
                className='rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-600 active:scale-[0.98]'
                onClick={() => {
                    reloadRetrieveScouter();
                }}>
                Reload Data
            </button>

            <div className='w-full overflow-hidden rounded-xl border border-white/10 bg-[#2f3646] shadow-lg shadow-black/20'>
                <div className='max-h-[70vh] overflow-y-auto'>
                    <table className='w-full text-left text-sm'>
                        <thead className='sticky top-0 bg-[#1f2432] text-xs uppercase tracking-wide text-gray-300'>
                            <tr>
                                <th className='px-4 py-3'>Rank</th>
                                <th className='px-4 py-3'>Name</th>
                                <th className='px-4 py-3 text-right'>Accuracy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedScouters.map((scouter, index) => (
                                <StatRow
                                    key={scouter.scouterName}
                                    rank={index + 1}
                                    scouter={scouter}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
        </div> 
    );
}


export default LeaderboardApp;
