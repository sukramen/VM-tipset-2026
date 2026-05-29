import { fixtures } from "./world-cup-data";
import type { Fixture, ScoreLine } from "./types";

export type MatchSyncPayload = {
  ok: boolean;
  syncedAt: string;
  lockedMatchIds: number[];
  results: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  message?: string;
};

const swedishTeamAliases: Record<string, string[]> = {
  Algeriet: ["algeria"],
  Argentina: ["argentina"],
  Australien: ["australia"],
  Belgien: ["belgium"],
  "Bosnien-Herzigovina": ["bosnia and herzegovina", "bosnia-herzegovina"],
  Brasilien: ["brazil"],
  Colombia: ["colombia"],
  Curaçao: ["curacao", "curaçao"],
  Czechia: ["czech republic", "czechia"],
  Ecuador: ["ecuador"],
  Egypten: ["egypt"],
  Elfenbenskusten: ["ivory coast", "cote d'ivoire", "côte d'ivoire"],
  England: ["england"],
  Frankrike: ["france"],
  Ghana: ["ghana"],
  Haiti: ["haiti"],
  Irak: ["iraq"],
  Iran: ["iran"],
  Japan: ["japan"],
  Jordanien: ["jordan"],
  Kanada: ["canada"],
  "Kap Verde": ["cape verde"],
  Kongo: ["congo dr", "dr congo", "congo"],
  Kroatien: ["croatia"],
  Marocko: ["morocco"],
  Mexiko: ["mexico"],
  Nederländerna: ["netherlands"],
  Norge: ["norway"],
  "Nya Zeeland": ["new zealand"],
  Panama: ["panama"],
  Paraguay: ["paraguay"],
  Portugal: ["portugal"],
  Qatar: ["qatar"],
  Saudiarabien: ["saudi arabia"],
  Schweiz: ["switzerland"],
  Senegal: ["senegal"],
  Skottland: ["scotland"],
  Spanien: ["spain"],
  Sverige: ["sweden"],
  Sydafrika: ["south africa"],
  Sydkorea: ["south korea", "korea republic"],
  Tunisien: ["tunisia"],
  Turkiet: ["turkey", "turkiye", "türkiye"],
  Tyskland: ["germany"],
  Uruguay: ["uruguay"],
  USA: ["usa", "united states"],
  Uzbekistan: ["uzbekistan"],
  Österrike: ["austria"],
};

export function getFixtureKickoff(fixture: Fixture) {
  return new Date(`${fixture.date}T${fixture.kickoffTime}:00+02:00`);
}

export function getStartedMatchIds(now = new Date()) {
  return fixtures.filter((fixture) => getFixtureKickoff(fixture) <= now).map((fixture) => fixture.id);
}

function normalizeTeamName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function teamsMatch(localTeam: string, apiTeam: string) {
  const normalizedApiTeam = normalizeTeamName(apiTeam);
  const aliases = swedishTeamAliases[localTeam] ?? [localTeam];
  return aliases.some((alias) => normalizeTeamName(alias) === normalizedApiTeam);
}

export function findFixtureByApiTeams(date: string, homeTeam: string, awayTeam: string) {
  return fixtures.find(
    (fixture) =>
      fixture.date === date &&
      ((teamsMatch(fixture.home, homeTeam) && teamsMatch(fixture.away, awayTeam)) ||
        (teamsMatch(fixture.home, awayTeam) && teamsMatch(fixture.away, homeTeam))),
  );
}
