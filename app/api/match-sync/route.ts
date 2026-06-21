import { NextResponse } from "next/server";
import { findFixtureByApiTeams, getStartedMatchIds, teamsMatch, type MatchSyncPayload } from "@/lib/match-sync";
import { loadAppStateFromDb } from "@/lib/supabase-storage";
import type { ScoreLine } from "@/lib/types";

type FootballDataTeam = {
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
};

type FootballDataMatch = {
  utcDate: string;
  status: string;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime?: {
      home: number | null;
      away: number | null;
    };
  };
};

type FootballDataResponse = {
  matches?: FootballDataMatch[];
  message?: string;
  errorCode?: number;
};

type FootballDataFetchResult =
  | { matches: FootballDataMatch[] }
  | { error: string; status?: number };

type MatchSyncFixture = {
  id: number;
  date: string;
  home: string;
  away: string;
  stage: string;
};

const finalStatuses = new Set(["FINISHED"]);
const footballDataBaseUrl = "https://api.football-data.org/v4/competitions";
const cacheTtlMs = 60_000;

let cachedMatches: FootballDataMatch[] | undefined;
let cachedAt = 0;

const stockholmDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function emptyPayload(ok: boolean, message: string, status?: number) {
  return NextResponse.json(
    {
      ok,
      syncedAt: new Date().toISOString(),
      lockedMatchIds: getStartedMatchIds(),
      results: {},
      resultWinners: {},
      message,
    } satisfies MatchSyncPayload,
    status ? { status } : undefined,
  );
}

function isFootballDataError(result: FootballDataFetchResult): result is Extract<FootballDataFetchResult, { error: string }> {
  return "error" in result;
}

function mergeUniqueNumbers(...lists: number[][]) {
  return [...new Set(lists.flat())].sort((a, b) => a - b);
}

function getStockholmDate(utcDate: string) {
  const parsedDate = new Date(utcDate);
  if (Number.isNaN(parsedDate.getTime())) return utcDate.slice(0, 10);
  return stockholmDateFormatter.format(parsedDate);
}

function getTeamNames(team: FootballDataTeam) {
  return [team.name, team.shortName, team.tla].filter((value): value is string => Boolean(value?.trim()));
}

function fixtureMatchesApiTeams(fixture: MatchSyncFixture, homeTeamNames: string[], awayTeamNames: string[]) {
  return homeTeamNames.some((homeTeam) =>
    awayTeamNames.some(
      (awayTeam) =>
        (teamsMatch(fixture.home, homeTeam) && teamsMatch(fixture.away, awayTeam)) ||
        (teamsMatch(fixture.home, awayTeam) && teamsMatch(fixture.away, homeTeam)),
    ),
  );
}

function findFixture(
  fixturesToMatch: MatchSyncFixture[] | undefined,
  date: string,
  homeTeamNames: string[],
  awayTeamNames: string[],
) {
  if (homeTeamNames.length === 0 || awayTeamNames.length === 0) return undefined;
  return (
    fixturesToMatch?.find(
      (fixture) =>
        fixture.date === date &&
        fixtureMatchesApiTeams(fixture, homeTeamNames, awayTeamNames),
    ) ??
    homeTeamNames
      .flatMap((homeTeam) => awayTeamNames.map((awayTeam) => findFixtureByApiTeams(date, homeTeam, awayTeam)))
      .find(Boolean)
  );
}

function toPayloadFromMatches(apiMatches: FootballDataMatch[], fixturesToMatch?: MatchSyncFixture[]): MatchSyncPayload {
  const results: Record<number, ScoreLine> = {};
  const resultWinners: Record<number, string> = {};
  const finalMatchIds: number[] = [];

  for (const apiMatch of apiMatches) {
    const date = getStockholmDate(apiMatch.utcDate);
    const homeTeamNames = getTeamNames(apiMatch.homeTeam);
    const awayTeamNames = getTeamNames(apiMatch.awayTeam);
    const localFixture = findFixture(fixturesToMatch, date, homeTeamNames, awayTeamNames);
    if (!localFixture) continue;

    if (!finalStatuses.has(apiMatch.status)) continue;

    const homeScore = apiMatch.score.fullTime?.home;
    const awayScore = apiMatch.score.fullTime?.away;
    if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) continue;

    const apiOrderMatchesLocal =
      homeTeamNames.some((homeTeam) => teamsMatch(localFixture.home, homeTeam)) &&
      awayTeamNames.some((awayTeam) => teamsMatch(localFixture.away, awayTeam));
    results[localFixture.id] = apiOrderMatchesLocal
      ? {
          home: homeScore,
          away: awayScore,
        }
      : {
          home: awayScore,
          away: homeScore,
        };
    finalMatchIds.push(localFixture.id);

    if (localFixture.stage !== "Gruppspel") {
      if (apiMatch.score.winner === "HOME_TEAM") resultWinners[localFixture.id] = apiOrderMatchesLocal ? localFixture.home : localFixture.away;
      if (apiMatch.score.winner === "AWAY_TEAM") resultWinners[localFixture.id] = apiOrderMatchesLocal ? localFixture.away : localFixture.home;
    }
  }

  const resultCount = Object.keys(results).length;

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    lockedMatchIds: mergeUniqueNumbers(getStartedMatchIds(), finalMatchIds),
    results,
    resultWinners,
    message: resultCount > 0 ? `Synkat ${resultCount} färdiga resultat.` : "Inga färdiga API-resultat att spara ännu.",
  };
}

function omitMatchIds<T>(record: Record<number, T>, matchIds: Set<number>) {
  return Object.fromEntries(Object.entries(record).filter(([matchId]) => !matchIds.has(Number(matchId)))) as Record<number, T>;
}

async function filterManualResultOverrides(payload: MatchSyncPayload): Promise<MatchSyncPayload> {
  const manualOverrideIds = await loadAppStateFromDb<number[]>("manual_result_override_match_ids", []);
  if (manualOverrideIds.length === 0) return payload;

  const protectedMatchIds = new Set(manualOverrideIds);
  const results = omitMatchIds(payload.results, protectedMatchIds);
  const resultWinners = omitMatchIds(payload.resultWinners, protectedMatchIds);
  const skippedCount = Object.keys(payload.results).length - Object.keys(results).length;
  if (skippedCount === 0) return payload;

  return {
    ...payload,
    results,
    resultWinners,
    message: `${payload.message ?? "Matchresultat synkade."} ${skippedCount} manuellt ändrade resultat hoppades över.`,
  };
}

async function getFootballDataMatches(): Promise<FootballDataFetchResult> {
  const now = Date.now();
  if (cachedMatches && now - cachedAt < cacheTtlMs) {
    return { matches: cachedMatches };
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!apiKey) {
    return { error: "FOOTBALL_DATA_API_KEY saknas. Matchstart låses lokalt, men resultat hämtas inte." };
  }

  const competition = process.env.FOOTBALL_DATA_COMPETITION?.trim() || "WC";
  const season = process.env.FOOTBALL_DATA_SEASON?.trim() || "2026";
  const url = new URL(`${footballDataBaseUrl}/${encodeURIComponent(competition)}/matches`);
  url.searchParams.set("season", season);

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
    next: { revalidate: 60 },
  });

  const data = (await response.json().catch(() => ({}))) as FootballDataResponse;
  if (!response.ok) {
    const message = data.message ? `football-data.org svarade ${response.status}: ${data.message}` : `football-data.org svarade ${response.status}.`;
    return { error: message, status: 502 };
  }

  if (data.message || data.errorCode) {
    return { error: data.message ?? `football-data.org returnerade felkod ${data.errorCode}.`, status: 502 };
  }

  if (!Array.isArray(data.matches)) {
    return { error: "football-data.org returnerade inget matchfält.", status: 502 };
  }

  if (data.matches.length === 0) {
    return { error: `football-data.org returnerade 0 matcher för ${competition} ${season}.`, status: 502 };
  }

  cachedMatches = data.matches;
  cachedAt = now;

  return { matches: data.matches };
}

async function syncFixtures(fixturesToMatch?: MatchSyncFixture[]) {
  const footballData = await getFootballDataMatches();
  if (isFootballDataError(footballData)) {
    return emptyPayload(false, footballData.error, footballData.status);
  }

  const payload = await filterManualResultOverrides(toPayloadFromMatches(footballData.matches, fixturesToMatch));
  return NextResponse.json(payload);
}

export async function GET() {
  return syncFixtures();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { fixtures?: MatchSyncFixture[] };
  return syncFixtures(body.fixtures);
}
