import { CommentValues } from 'requests';
import { TabBase } from '../../components/workspace/workspaceData';

export interface AnalysisEntry
    extends Record<
        string,
        string | number | boolean | Partial<Record<CommentValues, number>> | undefined
    > {
    teamNumber: number;
    Comments?: Partial<Record<CommentValues, number>>;
}

export interface StatTableData extends TabBase {
    type: 'StatTable';
    columns: string[];
    sortColumn?: string;
    ascending: boolean;
    weighted: boolean;
    weights: number[];
}

export interface BarGraphData extends TabBase {
    column: string;
    highlightedTeams: number[];
    bins: number;
    type: 'BarGraph';
}

export interface ScatterPlotGraphData extends TabBase {
    xColumn: string;
    yColumn: string;
    showLabels: boolean;
    type: 'ScatterPlotGraph';
}

export interface StatSummaryData extends TabBase {
    column: string;
    type: 'StatSummary';
}

export interface RadarGraphData extends TabBase {
    columns: string[];
    teamNumbers: number[];
    normalize: boolean;
    type: 'RadarGraph';
}

export interface TeamSummaryData extends TabBase {
    teamNumber: number;
    type: 'TeamSummary';
}

export type WindowData =
    | StatTableData
    | BarGraphData
    | ScatterPlotGraphData
    | RadarGraphData
    | StatSummaryData
    | TeamSummaryData; // | WeightedTableData | BlankTableData | ...
