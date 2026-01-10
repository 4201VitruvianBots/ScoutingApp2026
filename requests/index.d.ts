export type ClimbPosition = 'shallow'| 'deep' | 'park' | 'none' | 'failed';
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
    | 'multiplePieces'
    | 'cageFoul'
    | 'other';
export type Break = 'mechanismDmg' | 'batteryFall' | 'commsFail' | 'bumperFall';
export type DefenseRank = 'fullDef' | 'someDef' | 'noDef';
export type CommentValues =
    | 'great_driving'
    | 'good_driving'
    | 'source_only'
    | 'knock_pieces'
    | 'clogging'
    | 'coral stuck'
    | 'algae stuck'
    | 'effective_defense'
    | 'okay_defense'
    | 'ineffective_defense'
    | 'sturdy_build'
    | 'weak_build'
    | 'avoids_under_stage';


export type Net = boolean;


interface capabilities {
    coral: boolean;
    algae: boolean;
    climbShallow: boolean;
    climbDeep: boolean;
}


interface preference {
    coralPrefer: boolean;
    algaePrefer: boolean;
    climbSPrefer: boolean;
    climbDPrefer: boolean;
}

export type SuperPosition = 'red_ss' | 'blue_ss';
// export type ScoringLocation = 'A' | 'B';

export type ScouterPosition = 'red_right' | 'blue_right';

export interface MatchDataAggregations {
    _id: { teamNumber: number};
    averageCoral: number;
    averageAlgae: number;
    averageRemove: number;
    avgClimbRate: number;
    totalL1: number;
    totalL2: number;
    totalL3: number;
    totalL4: number;
    totalCoral: number;
    totalProcessor: number;
    totalNet: number;
    totalRemoved: number;
    totalAlgae: number;
    coralDrop1: boolean;
    coralDrop2: boolean;
    coralDrop3: boolean;
    coralDrop4: boolean;
    coralDrop5: boolean;
    coralDrop6: boolean;
    groundPick1: boolean;
    groundPick2: boolean;
    groundPick3: boolean;
    sourcePick1: boolean;
    sourcePick2: boolean;
    start1: boolean;
    start2: boolean;
    start3: boolean;
}

export interface matchOutliersAggregation {
    _id: { teamNumber: number };
    autoL1: number;
    autoL2: number;
    autoL3: number;
    autoL4: number;
    leave: number;
    teleL1: number;
    teleL2: number;
    teleL3: number;
    teleL4: number;
    teleProcessor: number;
    teleNet: number;
    shallow: number;
    deep: number;
    park: number;
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
    totalMultiplePieces: number;
    totalCageFoul: number;
    totalOther: number;
}

export interface MatchIndividualDataAggregations {
    _id: { teamNumber: number, matchNumber: number, robotPosition: RobotPosition };
    totalL1: number;
    totalL2: number;
    totalL3: number;
    totalL4: number;
    totalProcessor: number;
    totalNet: number;
    totalRemoved: number;
    coralDrop1: boolean;
    coralDrop2: boolean;
    coralDrop3: boolean;
    coralDrop4: boolean;
    coralDrop5: boolean;
    coralDrop6: boolean;
    groundPick1: boolean;
    groundPick2: boolean;
    groundPick3: boolean;
    sourcePick1: boolean;
    sourcePick2: boolean;
    start1: boolean;
    start2: boolean;
    start3: boolean;
}

export interface MetaData {
    scouterName: string;
    matchNumber: number;
    robotTeam?: number;
    robotPosition: RobotPosition;
}

interface coral {
    L1: number;
    L2: number;
    L3: number;
    L4: number;
}

interface algae {
    netRobot: number;
    processor: number;
    remove: number;
}

export interface netHuman {
    Success: number;
    Failed: number;
}

interface StartingZone {
    start1: boolean;
    start2: boolean;
    start3: boolean;
}

interface pickup {
    source1: boolean;
    source2: boolean;
    ground1: boolean;
    ground2: boolean;
    ground3: boolean
}

interface placeLocation {
    deposit1: boolean;
    deposit2: boolean;
    deposit3: boolean;
    deposit4: boolean;
    deposit5: boolean;
    deposit6: boolean;
}
// - `POST` `/data/match`

export interface MatchData {
    metadata: MetaData;
    // No competition info
    leftStartingZone: boolean;
    startingZone: StartingZone;
    pickupLocation: pickup;
    placement: placeLocation;
    autoCoral: coral;
    autoAlgae: algae;
    teleCoral: coral;
    teleAlgae: algae;
    climb: ClimbPosition;
    // disabledSeconds: number;
}

// - `POST` `/data/super`

export interface SuperData {
    metadata: MetaData;
    fouls: Record<Foul, number>;
    break: Record<Break, number>;
    defense: DefenseRank;
    defended: boolean;
    humanShooter?: netHuman;
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
    hopperIntake: boolean;
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
