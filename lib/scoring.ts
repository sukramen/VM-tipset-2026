import { fixtures, groups } from "./world-cup-data";
import type { BonusPrediction, GroupLetter, MatchStage, Prediction, ScoreLine, Standing } from "./types";

const sign = (score: ScoreLine) => (score.home > score.away ? "1" : score.home < score.away ? "2" : "X");

const normalize = (value?: string) => value?.trim().toLocaleLowerCase("sv") ?? "";

const sameText = (prediction?: string, actual?: string) => {
  const predicted = normalize(prediction);
  const result = normalize(actual);
  return predicted.length > 0 && predicted === result;
};

export const stageMultipliers: Record<MatchStage, number> = {
  Gruppspel: 1,
  Sextondelsfinal: 1,
  Åttondelsfinal: 1.2,
  Kvartsfinal: 1.5,
  Semifinal: 2,
  Bronsmatch: 2,
  Final: 3,
};

export function scoreGroupPrediction(prediction: Prediction, actual?: ScoreLine) {
  if (!prediction.score || !actual) return 0;

  let points = 0;
  if (sign(prediction.score) === sign(actual)) points += 3;
  if (prediction.score.home === actual.home && prediction.score.away === actual.away) points += 2;
  if (prediction.score.home - prediction.score.away === actual.home - actual.away) points += 1;
  if (prediction.score.home === actual.home) points += 1;
  if (prediction.score.away === actual.away) points += 1;

  return Math.min(points, 7);
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
  if (prediction.score.home === actual.home && prediction.score.away === actual.away) points += 2;

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

  if (sameText(prediction.worldChampion, actual.worldChampion)) points += 20;
  const actualFinalists = [normalize(actual.finalistOne), normalize(actual.finalistTwo)].filter(Boolean);
  const predictedFinalists = [normalize(prediction.finalistOne), normalize(prediction.finalistTwo)].filter(Boolean);
  points += predictedFinalists.filter((team, index) => actualFinalists.includes(team) && predictedFinalists.indexOf(team) === index).length * 10;
  if (sameText(prediction.topScorer, actual.topScorer)) points += 15;
  if (sameText(prediction.mostGroupGoals, actual.mostGroupGoals)) points += 10;
  if (sameText(prediction.surpriseTeam, actual.surpriseTeam)) points += 10;
  if (
    typeof prediction.totalTournamentGoals === "number" &&
    typeof actual.totalTournamentGoals === "number" &&
    closestTotalGoalDelta !== undefined &&
    Math.abs(prediction.totalTournamentGoals - actual.totalTournamentGoals) === closestTotalGoalDelta
  ) {
    points += 10;
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
      a.team.localeCompare(b.team, "sv"),
  );
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
        a.group.localeCompare(b.group),
    );
}

export function comparePredictions(a: Prediction[], b: Prediction[]) {
  const other = new Map(b.map((prediction) => [prediction.matchId, prediction]));
  const shared = a.filter((prediction) => {
    const match = other.get(prediction.matchId);
    return match?.score?.home === prediction.score?.home && match?.score?.away === prediction.score?.away;
  });

  return Math.round((shared.length / Math.max(a.length, 1)) * 100);
}
