import { Dispatch } from 'react';
import { CommentValues } from 'requests';
import chroma from 'chroma-js';
import Select, { StylesConfig } from 'react-select';

export interface SelectOption<T> {
    value: T;
    label: string;
    color: string;
}

interface ColourOption {
    readonly value: string;
    readonly label: string;
    readonly color: string;
    readonly isFixed?: boolean;
    readonly isDisabled?: boolean;
}

const commentOptions: SelectOption<CommentValues>[] = [
    { label: 'great driving', value: 'great_driving', color: '#5ac750' },
    { label: 'good driving', value: 'good_driving', color: '#50a1c7' },
    { label: 'ok driving', value: 'ok_driving', color: '#c78450' },
    { label: 'rough driving', value: 'rough_driving', color: '#c75050' },
    { label: 'fast cycles', value: 'fast_cycles', color: '#5ac750' },
    { label: 'drops fuel', value: 'drops_fuel', color: '#c75050' },
    { label: 'accurate shots', value: 'accurate_shots', color: '#5ac750' },
    {
        label: 'inaccurate shots',
        value: 'inaccurate_shots',
        color: '#c75050',
    },
    {
        label: 'aggressive defense',
        value: 'aggressive_defense',
        color: '#c107f0',
    },
    { label: 'smart defense', value: 'smart_defense', color: '#50a1c7' },
    {
        label: 'defense liability',
        value: 'defense_liability',
        color: '#c75050',
    },
    { label: 'fast climb', value: 'fast_climb', color: '#5ac750' },
    { label: 'slow climb', value: 'slow_climb', color: '#c78450' },
    { label: 'no climb', value: 'no_climb', color: '#c75050' },
];

const colourStyles: StylesConfig<ColourOption, true> = {
    control: styles => ({ ...styles, backgroundColor: 'white' }),
    option: (styles, { data, isDisabled, isFocused, isSelected }) => {
        const color = chroma(data.color);
        return {
            ...styles,
            backgroundColor: isDisabled
                ? undefined
                : isSelected
                  ? data.color
                  : isFocused
                    ? color.alpha(0.1).css()
                    : undefined,
            color: isDisabled
                ? '#ccc'
                : isSelected
                  ? chroma.contrast(color, 'white') > 2
                      ? 'white'
                      : 'black'
                  : data.color,
            cursor: isDisabled ? 'not-allowed' : 'default',
            ':active': {
                ...styles[':active'],
                backgroundColor: !isDisabled
                    ? isSelected
                        ? data.color
                        : color.alpha(0.3).css()
                    : undefined,
            },
        };
    },
    multiValue: (styles, { data }) => {
        const color = chroma(data.color);
        return {
            ...styles,
            backgroundColor: color.alpha(0.1).css(),
        };
    },
    multiValueLabel: (styles, { data }) => ({
        ...styles,
        color: data.color,
    }),
    multiValueRemove: (styles, { data }) => ({
        ...styles,
        color: data.color,
        ':hover': {
            backgroundColor: data.color,
            color: 'white',
        },
    }),
};

function CannedComments({
    value,
    onChange,
}: {
    value?: SelectOption<CommentValues>[] | undefined;
    onChange?: Dispatch<SelectOption<CommentValues>[]>;
}) {
    return (
        <div className='w-full'>
            <Select
                closeMenuOnSelect={false}
                defaultValue={[]}
                isMulti
                value={value}
                options={commentOptions}
                onChange={nextValue =>
                    onChange?.(nextValue as SelectOption<CommentValues>[])
                }
                className='w-full text-sm text-black'
                styles={colourStyles}
                isSearchable={false}
            />
        </div>
    );
}

export default CannedComments;
