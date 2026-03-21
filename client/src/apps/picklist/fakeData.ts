import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PitResult,
    TeamData,
} from 'requests';

export const fakeMatchAgg: MatchDataAggregations[] = [];
export const fakeMatchIndividual: MatchIndividualDataAggregations[] = [];
export const fakePitData: PitResult = {};
export const fakeTeamInfo: TeamData = {};

// Legacy exports kept so older imports still typecheck.
export const fakeSuperAgg: MatchDataAggregations[] = [];
export const fakeSuperIndividual: MatchIndividualDataAggregations[] = [];
