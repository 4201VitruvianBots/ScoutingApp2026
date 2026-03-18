import { MaterialSymbol } from 'react-material-symbols';
import LinkButton from './components/LinkButton';

const images = [
    'bg-field-blue',
    'bg-field-red',
    'bg-field-red-endgame',
    'bg-field-blue-endgame',
    'bg-field-blue-super',
    'bg-field-red-super',
];

function RootMenu() {
    return (
        <main className='grid min-h-screen auto-rows-fr grid-cols-2 grid-rows-[auto] gap-6 bg-[#171c26] px-6 pb-8 text-center text-white sm:px-10'>
            <h1 className='col-span-2 rounded-2xl bg-[#2f3646] p-5 text-4xl font-bold text-[#48c55c]'>
                Vitruvian Scouting
            </h1>

            <LinkButton link='/match' className='rounded-3xl bg-[#2f3646] text-4xl'>
                Match
            </LinkButton>
            <LinkButton link='/pit' className='rounded-3xl bg-[#2f3646] text-4xl'>
                Pit
            </LinkButton>
            <LinkButton link='/recon' className='rounded-3xl bg-[#2f3646] text-4xl'>
                Recon
            </LinkButton>
            <LinkButton link='/picklist' className='rounded-3xl bg-[#2f3646] text-4xl'>
                Picklist
            </LinkButton>
            <LinkButton link='/admin' className='rounded-3xl bg-[#2f3646] text-4xl'>
                Admin
            </LinkButton>
            <LinkButton
                link='/scouting_leaderboard'
                className='rounded-3xl bg-[#2f3646] text-3xl'>
                Scouting Leaderboard
            </LinkButton>

            <div className='fixed bottom-2 left-1/2 -translate-x-1/2 text-sm text-gray-300'>
                Version {import.meta.env.VITE_SCOUT_VERSION}
            </div>

            <div className='absolute opacity-0'>
                {images.map(imageClass => (
                    <div key={imageClass} className={imageClass} />
                ))}
                <MaterialSymbol icon='search' />
            </div>
        </main>
    );
}

export default RootMenu;
