import { ReactNode } from "react";

function CheckBoxMatch ({
    checked,
    children,
    onChange,
    className,
}:
{
    checked: boolean;
    children?:ReactNode;
    onChange?: (value: boolean) => void;
    className?: string;
}) {
    return(
        <input
                type="checkbox"
                checked={checked}
                className={` ${className} absolute text-5xl `}
                onChange={event => onChange?.(event.target.checked)}
                id='one'
                >
                    {children}
        </input>
)}
export default CheckBoxMatch;


//for scouter position, add this within the button's className:
// ${scouterPosition === 'red_right' ? 'rotate-180' : ''}