import { DragEventHandler, useContext, useState } from 'react';
import { DragContext } from './workspaceContexts';
import DropTarget from './DropTarget';
import { MaterialSymbol } from 'react-material-symbols';
import { TabBase } from './workspaceData';

function Tab<T extends TabBase>({
    value,
    onRemove,
    onInsertBefore,
    onClick,
    title,
    selected,
}: {
    value: T;
    onRemove: () => void;
    onInsertBefore: (value: T) => void;
    onClick: () => void;
    title: string;
    selected: boolean;
}) {
    const [[dragging], setDragging] = useContext(DragContext) as DragContext<T>;

    const [draggingSelf, setDraggingSelf] = useState(false);

    const handleDragStart: DragEventHandler = event => {
        event.dataTransfer.setData('text/custom', 'dummy data');
        event.dataTransfer.dropEffect = 'move';
        setDraggingSelf(true);
        setDragging([
            value,
            () => {
                onRemove();
                handleDragEnd();
            },
        ]);
    };

    const handleDragEnd = () => {
        setDraggingSelf(false);
        setDragging([undefined, undefined]);
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            // drop is triggered before dragEnd
            onClick={onClick}
            className={`relative -my-px -ml-px flex min-w-32 cursor-pointer select-none items-center justify-between gap-2 whitespace-nowrap border border-white/10 px-3 py-1 text-sm ${
                selected
                    ? 'bg-[#2b3346] text-white'
                    : 'bg-[#161d2a] text-gray-400 hover:bg-[#202837] hover:text-gray-200'
            }`}>
            {dragging && (
                <DropTarget
                    disabled={draggingSelf}
                    onDrop={onInsertBefore}
                    className='absolute inset-0'
                />
            )}
            {title}
            <button
                onClick={onRemove}
                className='grid aspect-square h-3/4 place-items-center rounded-full text-gray-300 hover:bg-white/10 hover:text-white'>
                <MaterialSymbol icon='close' />
            </button>
        </div>
    );
}

export default Tab;
