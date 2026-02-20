export type AllianceColor = 'red' | 'blue';

export type RobotPosition =
    | 'red_1'
    | 'red_2'
    | 'red_3'
    | 'red_4'
    | 'blue_1'
    | 'blue_2'
    | 'blue_3'
    | 'blue_4';

export type SuperPosition = 'red_ss' | 'blue_ss';
export type ScouterPosition = 'red_right' | 'blue_right';

export type MatchSegmentId =
    | 'auto'
    | 'transition'
    | 'shift1'
    | 'shift2'
    | 'shift3'
    | 'shift4'
    | 'endgame';

export type TeleSegmentId =
    | 'transition'
    | 'shift1'
    | 'shift2'
    | 'shift3'
    | 'shift4'
    | 'endgame';

export interface GameSegment {
    id: MatchSegmentId;
    label: string;
    startSec: number;
    endSec: number;
}

export interface GameConfig2026 {
    season: 2026;
    game: 'REBUILT';
    matchDurationSec: number;
    segments: GameSegment[];
    hubRule: {
        bothActiveSegments: MatchSegmentId[];
        shiftOrder: MatchSegmentId[];
        firstShiftDependsOnAutoWinner: boolean;
        alternateEachShift: boolean;
    };
    scoring: {
        fuelPointsActive: number;
        towerAuto: {
            level1: number;
            maxRobots: number;
        };
        towerTele: {
            level1: number;
            level2: number;
            level3: number;
        };
        rpThresholds: {
            energized: number;
            supercharged: number;
            traversal: number;
            allowOverride: boolean;
        };
    };
    allianceSizeRobots: {
        default: number;
        allowed: number[];
    };
}

export interface MetaData {
    scouterName: string;
    matchNumber: number;
    robotTeam?: number;
    robotPosition: RobotPosition;
}

export type AutoStartingPosition = 'left' | 'center' | 'right';
export type AutoTowerResult = 'none' | 'level1' | 'failed';
export type TeleTowerResult = 'none' | 'level1' | 'level2' | 'level3' | 'failed';
export type AutoFuelWinner = AllianceColor | 'tie' | 'unknown';

export interface TeleFuelBySegment {
    transition: number;
    shift1: number;
    shift2: number;
    shift3: number;
    shift4: number;
    endgame: number;
}

export type BreakdownType =
    | 'none'
    | 'stuck'
    | 'tipped'
    | 'comms'
    | 'mechanism'
    | 'other';

export type DriverQuality = 'great' | 'good' | 'ok' | 'rough';

export interface MatchData {
    metadata: MetaData;
    robotAbsent: boolean;
    autoStartingPosition: AutoStartingPosition | null;
    autoMoved: boolean;
    autoFuelScored: number;
    autoTower: AutoTowerResult;
    autoFuelWinner: AutoFuelWinner;
    shift1ActiveHubIfTie: AllianceColor | null;
    teleFuelBySegment: TeleFuelBySegment;
    teleTower: TeleTowerResult;
    climbTimeBucket: 'early' | 'mid' | 'late' | null;
    breakdown: BreakdownType;
    driverQuality: DriverQuality;
    freeText: string;
}

export type DefenseProvided = 'none' | 'some' | 'heavy';

export interface SuperFouls {
    pinning: number;
    towerContactInEndgame: number;
    outOfZoneShooting: number;
    ejectedFuel: number;
    other: number;
}

export interface SuperBreaks {
    mechanism: number;
    battery: number;
    comms: number;
    bumper: number;
}

export type CommentValues =
    | 'great_driving'
    | 'good_driving'
    | 'ok_driving'
    | 'rough_driving'
    | 'fast_cycles'
    | 'drops_fuel'
    | 'accurate_shots'
    | 'inaccurate_shots'
    | 'aggressive_defense'
    | 'smart_defense'
    | 'defense_liability'
    | 'fast_climb'
    | 'slow_climb'
    | 'no_climb';

export interface SuperData {
    metadata: MetaData;
    defenseProvided: DefenseProvided;
    defenseReceived: boolean;
    fouls: SuperFouls;
    breaks: SuperBreaks;
    comments: CommentValues[];
    humanPlayerFuelScored: number;
}

export type Drivebase = 'tank' | 'swerve' | 'other';
export type ScoringMethod = 'dump' | 'low-shot' | 'high-shot' | 'other';
export type PreferredScoringSpot = 'nearHub' | 'backOfZone' | 'varies';
export type TowerCapabilityClaimed =
    | 'level1'
    | 'level2'
    | 'level3'
    | 'unknown';

export interface PitFile {
    scouterName: string;
    teamNumber: number;
    drivebase: Drivebase;
    maxFuelStorageEstimate: number | null;
    intakeSources: {
        depot: boolean;
        outpostCorral: boolean;
        floorNeutral: boolean;
    };
    scoringMethod: ScoringMethod;
    preferredScoringSpot: PreferredScoringSpot;
    towerCapabilityClaimed: TowerCapabilityClaimed;
    batteryCount: number;
    photo: string;
    notes: string;
}

export type PitResult = Partial<Record<number, Omit<PitFile, 'photo'>>>;

export interface ScouterData {
    scouterName: string;
    accuracy: number;
}

export interface MatchDataAggregations {
    _id: { teamNumber: number };
    avgAutoFuel: number;
    autoMovedRate: number;
    autoStartingPositionLeftRate: number;
    autoStartingPositionCenterRate: number;
    autoStartingPositionRightRate: number;
    autoStartingPositionUnknownRate: number;
    autoTowerAttemptRate: number;
    autoTowerLevel1Rate: number;
    autoTowerFailRate: number;
    avgTeleFuelTransition: number;
    avgTeleFuelShift1: number;
    avgTeleFuelShift2: number;
    avgTeleFuelShift3: number;
    avgTeleFuelShift4: number;
    avgTeleFuelEndgame: number;
    avgTeleFuelTotal: number;
    avgTeleFuelActiveComputed: number;
    avgTeleFuelWastedComputed: number;
    avgFuelTotal: number;
    climbRateLevel1: number;
    climbRateLevel2: number;
    climbRateLevel3: number;
    climbFailRate: number;
    climbNoAttemptRate: number;
    climbAttemptRate: number;
    climbTimeEarlyRate: number;
    climbTimeMidRate: number;
    climbTimeLateRate: number;
    climbTimeKnownRate: number;
    driverQualityGreatRate: number;
    driverQualityGoodRate: number;
    driverQualityOkRate: number;
    driverQualityRoughRate: number;
    driverQualityScoreAvg: number;
    breakdownRate: number;
    breakdownRateStuck: number;
    breakdownRateTipped: number;
    breakdownRateComms: number;
    breakdownRateMechanism: number;
    breakdownRateOther: number;
    matchCount: number;
}

export interface MatchIndividualDataAggregations {
    _id: { teamNumber: number; matchNumber: number; robotPosition: RobotPosition };
    scouterName: string;
    robotAbsent: boolean;
    autoStartingPosition: AutoStartingPosition | null;
    autoMoved: boolean;
    autoFuelScored: number;
    autoFuelWinner: AutoFuelWinner;
    shift1ActiveHubIfTie: AllianceColor | null;
    teleFuelBySegment: TeleFuelBySegment;
    teleFuelActiveComputed: number;
    teleFuelWastedComputed: number;
    autoTower: AutoTowerResult;
    teleTower: TeleTowerResult;
    climbTimeBucket: 'early' | 'mid' | 'late' | null;
    breakdown: BreakdownType;
    driverQuality: DriverQuality;
    freeText: string;
}

export interface SuperDataAggregations {
    _id: { teamNumber: number };
    avgFoulsTotal: number;
    foulRatePinning: number;
    foulRateTowerContactInEndgame: number;
    foulRateOutOfZoneShooting: number;
    foulRateEjectedFuel: number;
    foulRateOther: number;
    avgHumanPlayerFuelScored: number;
    avgBreaksTotal: number;
    avgBreaksMechanism: number;
    avgBreaksBattery: number;
    avgBreaksComms: number;
    avgBreaksBumper: number;
    breakRateAny: number;
    defenseHeavyRate: number;
    defenseSomeRate: number;
    defenseNoneRate: number;
    defenseReceivedRate: number;
    avgCommentTags: number;
    matchCount: number;
    commentCounts: Partial<Record<CommentValues, number>>;
}

export interface SuperIndividualDataAggregations {
    _id: { teamNumber: number; matchNumber: number; robotPosition: RobotPosition };
    scouterName: string;
    defenseProvided: DefenseProvided;
    defenseReceived: boolean;
    fouls: SuperFouls;
    breaks: SuperBreaks;
    comments: CommentValues[];
    humanPlayerFuelScored: number;
}

export interface matchOutliersAggregation {
    _id: { teamNumber: number };
}

export interface StatusReport {
    robotPosition: RobotPosition | SuperPosition | undefined;
    matchNumber: number | undefined;
    scouterName: string;
    battery: number | undefined;
}

export interface StatusRecieve {
    scouters: StatusReport[];
    matches: MatchStatus;
}

export type MatchStatus = Record<
    number,
    Record<RobotPosition, { schedule: number | undefined; real: number[] }> &
        Record<SuperPosition, boolean>
>;

export type MatchSchedule = Record<
    number,
    Partial<Record<RobotPosition, number>>
>;

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
