export type GroupLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type MatchStage =
  | "Gruppspel"
  | "Sextondelsfinal"
  | "Åttondelsfinal"
  | "Kvartsfinal"
  | "Semifinal"
  | "Bronsmatch"
  | "Final";

export type Fixture = {
  id: number;
  group?: GroupLetter;
  stage: MatchStage;
  date: string;
  kickoffTime: string;
  home: string;
  away: string;
};

export type ScoreLine = {
  home: number;
  away: number;
};

export type Prediction = {
  matchId: number;
  score?: ScoreLine;
  winner?: string;
};

export type PlayerProfile = {
  id: string;
  name: string;
  initials: string;
  role: "admin" | "player";
  passwordHash?: string;
};

export type BonusPrediction = {
  worldChampion?: string;
  topScorer?: string;
  mostGroupGoals?: string;
  mostCardsGroupStage?: string;
  totalTournamentGoals?: number;
  firstHostEliminated?: string;
  darkhorseQuarterfinalist?: string;
  biggestWinMargin?: number;
};

export type UserScore = {
  id: string;
  name: string;
  avatar: string;
  points: number;
  trend: number;
  exact: number;
  groupPoints: number;
  knockoutPoints: number;
  bonusPoints: number;
  latestChange: number;
  history: number[];
};

export type Standing = {
  teamId?: string;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fairPlayPoints?: number;
};

export type FairPlayPointsMode = "higher-is-better" | "lower-is-better";

export type ThirdPlacedTeamInput = {
  team_id: string;
  team_name: string;
  points: number;
  goal_difference: number;
  goals_for: number;
  fair_play_points: number;
};

export type ThirdPlacedGroupInput = {
  group: GroupLetter | string;
  teams: ThirdPlacedTeamInput[];
};

export type RankedThirdPlacedTeam = ThirdPlacedTeamInput & {
  group: GroupLetter | string;
  rank: number;
  qualified: boolean;
};

export type ThirdPlacedRanking = {
  ranking: RankedThirdPlacedTeam[];
  qualified: RankedThirdPlacedTeam[];
  eliminated: RankedThirdPlacedTeam[];
};
