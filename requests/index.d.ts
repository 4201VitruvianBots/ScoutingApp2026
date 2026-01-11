export type ClimbPosition = 'level-1'| 'level-2' | 'level-3' | 'none' | 'failed';
export type teamRoles = 'scoring' | 'defense' | 'support' | 'all-round';
export type drivebase = 'tank' | 'swerve' | 'MECANUM' | 'other';

export type RobotPosition =
    | 'red_1'
    | 'red_2'
    | 'red_3'
    | 'blue_1'
    | 'blue_2'
    | 'blue_3';
export type Foul =
    | 'insideRobot'
    | 'protectedZone'
    | 'pinning'
    | 'other';
export type Break = 'mechanismDmg' | 'batteryFall' | 'commsFail' | 'bumperFall';
export type DefenseRank = 'fullDef' | 'someDef' | 'noDef';
export type CommentValues =
    | 'great_driving'
    | 'good_driving'
    | 'outpost_only'
    | 'clogging'
    | 'effective_defense'
    | 'okay_defense'
    | 'ineffective_defense'
    | 'sturdy_build'
    | 'weak_build'
    | 'avoids_under_trench';


interface capabilities {
}


interface preference {
}

export type SuperPosition = 'red_ss' | 'blue_ss';
// export type ScoringLocation = 'A' | 'B';

export type ScouterPosition = 'red_right' | 'blue_right';

export interface MatchDataAggregations {
    _id: { teamNumber: number};
}

export interface matchOutliersAggregation {
    _id: { teamNumber: number };
}

export interface SuperDataAggregations {
    _id: { teamNumber: number };
    avgFouls: number;
    maxFouls: number;
    humanAccuracy: number;
}

export interface SuperFoulAggregationsData{
    _id: { teamNumber: number, matchNumber: number };
    totalInsideRobot: number;
    totalProtectedZone: number;
    totalPinning: number;
    totalOther: number;
}

export interface MatchIndividualDataAggregations {
    _id: { teamNumber: number, matchNumber: number, robotPosition: RobotPosition };
}

export interface MetaData {
    scouterName: string;
    matchNumber: number;
    robotTeam?: number;
    robotPosition: RobotPosition;
}

interface StartingZone {
    start1: boolean;
    start2: boolean;
    start3: boolean;
}


// - `POST` `/data/match`

export interface MatchData {
    metadata: MetaData;
    // No competition info
    startingZone: StartingZone;
}

// - `POST` `/data/super`

export interface SuperData {
    metadata: MetaData;
    fouls: Record<Foul, number>;
    break: Record<Break, number>;
    defense: DefenseRank;
    defended: boolean;
    comments: CommentValues[];
}

// - `POST` `/data/pits`
// `<form>` files?

export interface ScouterData {
    scouterName: string;
    accuracy: number;
    
}
// find me

export interface PitFile {
    scouterName: string;
    teamNumber: number;
    pitBatteryCount: number;
    comments: string;
    photo: string;
}

export type PitResult = Partial<Record<number, Omit<PitFile, 'photo'>>>;

// - `WebSocket` `/status/report`
// client -> server

export interface StatusReport {
    robotPosition: RobotPosition | SuperPosition | undefined;
    matchNumber: number | undefined;
    scouterName: string;
    battery: number | undefined;
}

// - `WebSocket` `/status/recieve`
// server -> client

export interface StatusRecieve {
    scouters: StatusReport[];
    matches: MatchStatus;
}

export type MatchStatus = Record<
    number,
    Record<RobotPosition, { schedule: number; real: number[] }> &
        Record<SuperPosition, boolean>
>;
// - `GET` `/data/schedule.json`

export type MatchSchedule = Record<number, Record<RobotPosition, number>>;

export interface TeamInfo {
    address: null;
    city: string | null;
    country: string | null;
    gmaps_place_id: null;
    gmaps_url: null;
    home_championship: Record<string, string> | null;
    key: string;
    lat: null;
    lng: null;
    location_name: null;
    motto: null;
    name: string;
    nickname: string;
    postal_code: string;
    rookie_year: number;
    school_name: string;
    state_prov: string;
    team_number: number;
    website: string | null;
}

export type TeamData = Partial<{
    [key: string]: {
        primaryHex: string;
        secondaryHex: string;
        verified: boolean;
        avatar?: string;
        info?: TeamInfo;
    };
}>;
