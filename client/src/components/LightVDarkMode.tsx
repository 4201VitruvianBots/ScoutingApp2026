import { ReactNode, MouseEventHandler } from "react"

function ToggleButton({
className,
buttonClassName,
onClick,
children,


} : {
className?: string;
buttonClassName?: string;
onClick?: MouseEventHandler<HTMLElement>
children?: ReactNode;
}) {
    return (
        <>
        <label className={className}>
            <input type='button' onClick={onClick} className={buttonClassName}/>
            {children}
        </label>
        </>
    )
}
// Checkbox method: Checkbox input that automatically goes between true or false. And when changed will run a function
// Button method: When button is pressed, it checks the current state, and does the opposite. (requires more code)



export default ToggleButton;
