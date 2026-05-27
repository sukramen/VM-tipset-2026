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
  finalistOne?: string;
  finalistTwo?: string;
  topScorer?: string;
  mostGroupGoals?: string;
  surpriseTeam?: string;
  totalTournamentGoals?: number;
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
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
