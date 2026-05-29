import { NextResponse } from "next/server";
import { findFixtureByApiTeams, getStartedMatchIds, teamsMatch, type MatchSyncPayload } from "@/lib/match-sync";
import type { ScoreLine } from "@/lib/types";

type ApiFootballFixture = {
  fixture: {
    date: string;
    status: {
      short: string;
    };
  };
  teams: {
    home: { name: string; winner: boolean | null };
    away: { name: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

type ApiFootballResponse = {
  response?: ApiFootballFixture[];
  errors?: unknown;
};

type MatchSyncFixture = {
  id: number;
  date: string;
  home: string;
  away: string;
  stage: string;
};

const finalStatuses = new Set(["FT", "AET", "PEN"]);
const apiFootballUrl = "https://v3.football.api-sports.io/fixtures";
const cacheTtlMs = 60_000;

let cachedPayload: MatchSyncPayload | undefined;
let cachedAt = 0;

function mergeUniqueNumbers(...lists: number[][]) {
  return [...new Set(lists.flat())].sort((a, b) => a - b);
}

function findFixture(fixturesToMatch: MatchSyncFixture[] | undefined, date: string, homeTeam: string, awayTeam: string) {
  return (
    fixturesToMatch?.find(
      (fixture) =>
        fixture.date === date &&
        ((teamsMatch(fixture.home, homeTeam) && teamsMatch(fixture.away, awayTeam)) ||
          (teamsMatch(fixture.home, awayTeam) && teamsMatch(fixture.away, homeTeam))),
    ) ?? findFixtureByApiTeams(date, homeTeam, awayTeam)
  );
}

function toPayloadFromFixtures(apiFixtures: ApiFootballFixture[], fixturesToMatch?: MatchSyncFixture[]): MatchSyncPayload {
  const results: Record<number, ScoreLine> = {};
  const resultWinners: Record<number, string> = {};
  const finalMatchIds: number[] = [];

  for (const apiFixture of apiFixtures) {
    const date = apiFixture.fixture.date.slice(0, 10);
    const localFixture = findFixture(fixturesToMatch, date, apiFixture.teams.home.name, apiFixture.teams.away.name);
    if (!localFixture) continue;

    if (!finalStatuses.has(apiFixture.fixture.status.short)) continue;
    if (apiFixture.goals.home === null || apiFixture.goals.away === null) continue;

    const apiOrderMatchesLocal =
      teamsMatch(localFixture.home, apiFixture.teams.home.name) && teamsMatch(localFixture.away, apiFixture.teams.away.name);
    results[localFixture.id] = apiOrderMatchesLocal
      ? {
          home: apiFixture.goals.home,
          away: apiFixture.goals.away,
        }
      : {
          home: apiFixture.goals.away,
          away: apiFixture.goals.home,
        };
    finalMatchIds.push(localFixture.id);

    if (localFixture.stage !== "Gruppspel") {
      if (apiFixture.teams.home.winner === true) resultWinners[localFixture.id] = apiOrderMatchesLocal ? localFixture.home : localFixture.away;
      if (apiFixture.teams.away.winner === true) resultWinners[localFixture.id] = apiOrderMatchesLocal ? localFixture.away : localFixture.home;
    }
  }

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    lockedMatchIds: mergeUniqueNumbers(getStartedMatchIds(), finalMatchIds),
    results,
    resultWinners,
  };
}

async function syncFixtures(fixturesToMatch?: MatchSyncFixture[]) {
  const now = Date.now();
  if (!fixturesToMatch && cachedPayload && now - cachedAt < cacheTtlMs) {
    return NextResponse.json(cachedPayload);
  }

  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      syncedAt: new Date().toISOString(),
      lockedMatchIds: getStartedMatchIds(),
      results: {},
      resultWinners: {},
      message: "API_FOOTBALL_KEY saknas. Matchstart låses lokalt, men resultat hämtas inte.",
    } satisfies MatchSyncPayload);
  }

  const url = new URL(apiFootballUrl);
  url.searchParams.set("league", process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID?.trim() || "1");
  url.searchParams.set("season", process.env.API_FOOTBALL_WORLD_CUP_SEASON?.trim() || "2026");
  url.searchParams.set("from", "2026-06-11");
  url.searchParams.set("to", "2026-07-19");
  url.searchParams.set("timezone", "Europe/Stockholm");

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        syncedAt: new Date().toISOString(),
        lockedMatchIds: getStartedMatchIds(),
        results: {},
        resultWinners: {},
        message: `API-FOOTBALL svarade ${response.status}.`,
      } satisfies MatchSyncPayload,
      { status: 502 },
    );
  }

  const data = (await response.json()) as ApiFootballResponse;
  const payload = toPayloadFromFixtures(data.response ?? [], fixturesToMatch);
  if (!fixturesToMatch) {
    cachedPayload = payload;
    cachedAt = now;
  }

  return NextResponse.json(payload);
}

export async function GET() {
  return syncFixtures();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { fixtures?: MatchSyncFixture[] };
  return syncFixtures(body.fixtures);
}
