import { Dispatch, useMemo } from 'react';
import SelectSearch, { SelectSearchOption } from 'react-select-search';
import { useFetchJson } from '../lib/useFetch';

function TeamDropdown({
    value,
    onChange,
    disabledOptions,
    allowAbsent = false,
}: {
    value?: number | undefined;
    onChange?: Dispatch<number>;
    disabledOptions?: number[];
    allowAbsent?: boolean;
}) {
    const [teams] = useFetchJson<number[]>('/config/teams-list', []);

    const options = useMemo(() => {
        const teamOptions: SelectSearchOption[] = teams
            .map(team => Number(team))
            .filter(team => Number.isFinite(team) && team > 0)
            .sort((a, b) => a - b)
            .map(team => ({ name: `${team}`, value: `${team}` }));

        if (!allowAbsent) {
            return teamOptions;
        }

        return [{ value: '0', name: 'Absent' }, ...teamOptions];
    }, [allowAbsent, teams]);

    const optionsWithDisabled = useMemo(
        () =>
            disabledOptions
                ? options.map(option => {
                      const teamNumber = Number.parseInt(String(option.value), 10);
                      return {
                          ...option,
                          disabled: Number.isFinite(teamNumber)
                              ? disabledOptions.includes(teamNumber)
                              : false,
                      };
                  })
                : options,
        [disabledOptions, options]
    );

    return (
        <div className='team-search mx-auto contents'>
            <SelectSearch
                options={optionsWithDisabled}
                value={value?.toString()}
                onChange={nextValue => onChange?.(Number.parseInt(nextValue as string, 10))}
                search
                placeholder='Select Team Number...'
            />
        </div>
    );
}

export default TeamDropdown;
