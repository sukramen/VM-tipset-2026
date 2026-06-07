import { NextResponse } from "next/server";
import { rankBestThirdPlacedTeams } from "@/lib/scoring";
import type { FairPlayPointsMode, ThirdPlacedGroupInput, ThirdPlacedTeamInput } from "@/lib/types";

type ThirdPlacedRankingRequest = {
  groups?: ThirdPlacedGroupInput[];
  qualifiedCount?: number;
  fairPlayPointsMode?: FairPlayPointsMode;
};

const fairPlayModes = new Set<FairPlayPointsMode>(["higher-is-better", "lower-is-better"]);

function isNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isTeam(value: unknown): value is ThirdPlacedTeamInput {
  if (!value || typeof value !== "object") return false;
  const team = value as ThirdPlacedTeamInput;

  return (
    typeof team.team_id === "string" &&
    typeof team.team_name === "string" &&
    isNumber(team.points) &&
    isNumber(team.goal_difference) &&
    isNumber(team.goals_for) &&
    isNumber(team.fair_play_points)
  );
}

function isGroup(value: unknown): value is ThirdPlacedGroupInput {
  if (!value || typeof value !== "object") return false;
  const group = value as ThirdPlacedGroupInput;

  return (typeof group.group === "string" || typeof group.group === "number") && Array.isArray(group.teams) && group.teams.every(isTeam);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as ThirdPlacedRankingRequest | undefined;

  if (!body || !Array.isArray(body.groups) || !body.groups.every(isGroup)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Skicka { groups: [{ group, teams: [{ team_id, team_name, points, goal_difference, goals_for, fair_play_points }] }] }.",
      },
      { status: 400 },
    );
  }

  if (body.fairPlayPointsMode && !fairPlayModes.has(body.fairPlayPointsMode)) {
    return NextResponse.json(
      {
        ok: false,
        message: "fairPlayPointsMode måste vara 'higher-is-better' eller 'lower-is-better'.",
      },
      { status: 400 },
    );
  }

  if (body.qualifiedCount !== undefined && (!Number.isInteger(body.qualifiedCount) || body.qualifiedCount < 0)) {
    return NextResponse.json(
      {
        ok: false,
        message: "qualifiedCount måste vara ett heltal större än eller lika med 0.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    fairPlayPointsMode: body.fairPlayPointsMode ?? "higher-is-better",
    ...rankBestThirdPlacedTeams(body.groups, {
      qualifiedCount: body.qualifiedCount,
      fairPlayPointsMode: body.fairPlayPointsMode,
    }),
  });
}
