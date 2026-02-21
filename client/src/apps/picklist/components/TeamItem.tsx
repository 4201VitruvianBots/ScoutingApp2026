import { Dispatch } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import { TeamData } from 'requests';
import { WindowData } from '../data';
import blankImage from '../../../images/blank.png';

function TeamItem({
    teamNumber,
    teamInfoJson,
    onSubmit,
}: {
    teamNumber: number;
    teamInfoJson: TeamData;
    onSubmit: Dispatch<WindowData>;
}) {
    function handleTeamSummaryClick(nextTeamNumber: number) {
        onSubmit({
            title: `Team ${nextTeamNumber} Summary`,
            type: 'TeamSummary',
            teamNumber: nextTeamNumber,
        });
    }

    const avatar = teamInfoJson[teamNumber]?.avatar;
    const teamNickname = teamInfoJson[teamNumber]?.info?.nickname;

    return (
        <>
            <td className='px-2 py-2'>
                <img
                    src={avatar ? `data:image/png;base64,${avatar}` : blankImage}
                    alt=''
                    className='h-8 w-8 rounded border border-white/20 bg-black/30 object-cover'
                />
            </td>
            <td className='px-2 py-2'>
                <div className='flex items-center gap-2'>
                    <div>
                        <p className='font-semibold text-white'>#{teamNumber}</p>
                        {teamNickname && (
                            <p className='text-xs text-gray-400'>{teamNickname}</p>
                        )}
                    </div>
                    <button
                        onClick={() => handleTeamSummaryClick(teamNumber)}
                        className='rounded bg-white/10 p-1 text-gray-200 transition hover:bg-white/20 hover:text-white'
                        title={`Open Team ${teamNumber} Summary`}>
                        <MaterialSymbol icon='info' size={20} />
                    </button>
                </div>
            </td>
        </>
    );
}

export default TeamItem;
