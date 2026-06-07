import { fixtures, groups } from "./world-cup-data";
import type {
  BonusPrediction,
  FairPlayPointsMode,
  GroupLetter,
  MatchStage,
  Prediction,
  RankedThirdPlacedTeam,
  ScoreLine,
  Standing,
  ThirdPlacedGroupInput,
  ThirdPlacedRanking,
  ThirdPlacedTeamInput,
} from "./types";

const sign = (score: ScoreLine) => (score.home > score.away ? "1" : score.home < score.away ? "2" : "X");

const normalize = (value?: string) => {
  const normalized = value?.trim().toLocaleLowerCase("sv") ?? "";
  const aliases: Record<string, string> = {
    canada: "kanada",
    maxiko: "mexiko",
    mexico: "mexiko",
  };

  return aliases[normalized] ?? normalized;
};

const getFairPlaySortValue = (points = 0, mode: FairPlayPointsMode = "higher-is-better") =>
  mode === "lower-is-better" ? -points : points;

const sameText = (prediction?: string, actual?: string) => {
  const predicted = normalize(prediction);
  const result = normalize(actual);
  return predicted.length > 0 && predicted === result;
};

const sameTextOption = (prediction?: string, actual?: string) => {
  const predicted = normalize(prediction);
  const accepted = actual?.split("/").map(normalize).filter(Boolean) ?? [];
  return predicted.length > 0 && accepted.includes(predicted);
};

export const stageMultipliers: Record<MatchStage, number> = {
  Gruppspel: 1,
  Sextondelsfinal: 1,
  Åttondelsfinal: 1.25,
  Kvartsfinal: 1.5,
  Semifinal: 2,
  Bronsmatch: 1.5,
  Final: 2.5,
};

export function scoreGroupPrediction(prediction: Prediction, actual?: ScoreLine) {
  if (!prediction.score || !actual) return 0;

  let points = 0;
  if (sign(prediction.score) === sign(actual)) points += 3;
  if (prediction.score.home === actual.home && prediction.score.away === actual.away) points += 3;
  if (prediction.score.home - prediction.score.away === actual.home - actual.away) points += 1;
  if (prediction.score.home === actual.home) points += 1;
  if (prediction.score.away === actual.away) points += 1;

  return Math.min(points, 8);
}

export function scoreKnockoutPrediction(
  prediction: Prediction,
  actual?: ScoreLine,
  stage: MatchStage = "Sextondelsfinal",
  actualWinner?: string,
) {
  if (!prediction.score || !actual) return 0;

  let points = 0;
  const predictedSign = sign(prediction.score);
  const actualSign = sign(actual);
  if (prediction.winner && actualWinner && prediction.winner === actualWinner) points += 5;
  if (predictedSign === actualSign) points += 3;
  if (prediction.score.home === actual.home && prediction.score.away === actual.away) points += 3;

  return Math.round(points * stageMultipliers[stage]);
}

export function scorePrediction(
  prediction: Prediction,
  actual?: ScoreLine,
  stage: MatchStage = "Gruppspel",
  actualWinner?: string,
) {
  if (stage === "Gruppspel") return scoreGroupPrediction(prediction, actual);
  return scoreKnockoutPrediction(prediction, actual, stage, actualWinner);
}

export function scoreBonusPrediction(
  prediction: BonusPrediction,
  actual: BonusPrediction,
  closestTotalGoalDelta?: number,
) {
  let points = 0;

  if (sameText(prediction.worldChampion, actual.worldChampion)) points += 15;
  if (sameText(prediction.topScorer, actual.topScorer)) points += 10;
  if (sameTextOption(prediction.mostGroupGoals, actual.mostGroupGoals)) points += 8;
  if (sameTextOption(prediction.firstHostEliminated, actual.firstHostEliminated)) points += 8;
  if (
    typeof prediction.totalTournamentGoals === "number" &&
    typeof actual.totalTournamentGoals === "number" &&
    closestTotalGoalDelta !== undefined &&
    Math.abs(prediction.totalTournamentGoals - actual.totalTournamentGoals) === closestTotalGoalDelta
  ) {
    points += 8;
  }
  if (
    typeof prediction.biggestWinMargin === "number" &&
    typeof actual.biggestWinMargin === "number" &&
    prediction.biggestWinMargin === actual.biggestWinMargin
  ) {
    points += 5;
  }

  return points;
}

export function buildStandings(results: Record<number, ScoreLine>, group: GroupLetter): Standing[] {
  const table = new Map<string, Standing>();

  for (const team of groups[group]) {
    table.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      fairPlayPoints: 0,
    });
  }

  for (const fixture of fixtures.filter((match) => match.stage === "Gruppspel" && match.group === group)) {
    const result = results[fixture.id];
    if (!result) continue;

    const home = table.get(fixture.home);
    const away = table.get(fixture.away);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += result.home;
    home.goalsAgainst += result.away;
    away.goalsFor += result.away;
    away.goalsAgainst += result.home;

    if (result.home > result.away) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (result.home < result.away) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      getFairPlaySortValue(b.fairPlayPoints) - getFairPlaySortValue(a.fairPlayPoints) ||
      a.team.localeCompare(b.team, "sv"),
  );
}

function compareThirdPlacedTeams(
  a: ThirdPlacedTeamInput,
  b: ThirdPlacedTeamInput,
  fairPlayPointsMode: FairPlayPointsMode = "higher-is-better",
) {
  return (
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    getFairPlaySortValue(b.fair_play_points, fairPlayPointsMode) - getFairPlaySortValue(a.fair_play_points, fairPlayPointsMode) ||
    a.team_name.localeCompare(b.team_name, "sv") ||
    a.team_id.localeCompare(b.team_id, "sv")
  );
}

export function rankBestThirdPlacedTeams(
  inputGroups: ThirdPlacedGroupInput[],
  options: { qualifiedCount?: number; fairPlayPointsMode?: FairPlayPointsMode } = {},
): ThirdPlacedRanking {
  const qualifiedCount = options.qualifiedCount ?? 8;
  const fairPlayPointsMode = options.fairPlayPointsMode ?? "higher-is-better";

  const thirdPlacedTeams = inputGroups
    .map((group) => {
      const standing = [...group.teams].sort((a, b) => compareThirdPlacedTeams(a, b, fairPlayPointsMode))[2];
      return standing ? { group: group.group, standing } : undefined;
    })
    .filter((item): item is { group: GroupLetter | string; standing: ThirdPlacedTeamInput } => Boolean(item));

  const ranking = thirdPlacedTeams
    .sort((a, b) => compareThirdPlacedTeams(a.standing, b.standing, fairPlayPointsMode) || String(a.group).localeCompare(String(b.group), "sv"))
    .map<RankedThirdPlacedTeam>(({ group, standing }, index) => ({
      ...standing,
      group,
      rank: index + 1,
      qualified: index < qualifiedCount,
    }));

  return {
    ranking,
    qualified: ranking.filter((team) => team.qualified),
    eliminated: ranking.filter((team) => !team.qualified),
  };
}

export function rankThirdPlaced(results: Record<number, ScoreLine>) {
  return (Object.keys(groups) as GroupLetter[])
    .map((group) => ({ group, standing: buildStandings(results, group)[2] }))
    .filter((item) => item.standing)
    .sort(
      (a, b) =>
        b.standing.points - a.standing.points ||
        b.standing.goalDifference - a.standing.goalDifference ||
        b.standing.goalsFor - a.standing.goalsFor ||
        getFairPlaySortValue(b.standing.fairPlayPoints) - getFairPlaySortValue(a.standing.fairPlayPoints) ||
        a.group.localeCompare(b.group),
    )
    .map((item, index) => ({ ...item, qualified: index < 8 }));
}

export function comparePredictions(a: Prediction[], b: Prediction[]) {
  const other = new Map(b.map((prediction) => [prediction.matchId, prediction]));
  const shared = a.filter((prediction) => {
    const match = other.get(prediction.matchId);
    return match?.score?.home === prediction.score?.home && match?.score?.away === prediction.score?.away;
  });

  return Math.round((shared.length / Math.max(a.length, 1)) * 100);
}
