"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarClock,
  ChevronUp,
  Expand,
  X,
  Crown,
  Download,
  Lock,
  Medal,
  Trash2,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildStandings, rankThirdPlaced, scoreBonusPrediction, scorePrediction } from "@/lib/scoring";
import {
  deleteProfileFromDb,
  describeSupabaseError,
  isSupabaseEnabled,
  loadAllBonusFromDb,
  loadAllPredictionsFromDb,
  loadAppStateFromDb,
  loadProfilesFromDb,
  loadResultsFromDb,
  saveAppStateToDb,
  saveBonusToDb,
  savePredictionsToDb,
  saveProfilesToDb,
  saveResultsToDb,
} from "@/lib/supabase-storage";
import { fixtures, groups, sampleResults } from "@/lib/world-cup-data";
import type { BonusPrediction, Fixture, GroupLetter, MatchStage, PlayerProfile, Prediction, ScoreLine, UserScore } from "@/lib/types";

const tabs = ["Hem", "Tippa", "Grupper", "Slutspel", "Admin", "Statistik"] as const;
type Tab = (typeof tabs)[number];

const stageOrder: MatchStage[] = ["Sextondelsfinal", "Åttondelsfinal", "Kvartsfinal", "Semifinal", "Bronsmatch", "Final"];
const adminStageOrder: MatchStage[] = ["Gruppspel", ...stageOrder];
const groupLetters = Object.keys(groups) as GroupLetter[];
const predictionsVersion = "5";
const bonusVersion = "1";
const requireAdminPassword = false;
const starterProfiles: PlayerProfile[] = [
  { id: "admin", name: "Admin", initials: "AD", role: "admin", passwordHash: hashPassword("markus123") },
  { id: "markus", name: "Markus", initials: "MV", role: "player" },
  { id: "filip", name: "Filip", initials: "FI", role: "player" },
  { id: "johanna", name: "Johanna", initials: "JV", role: "player" },
];

const defaultPredictions = fixtures.map((match) => ({
  matchId: match.id,
  winner: match.stage === "Gruppspel" ? "Ej tippat" : "Ej valt",
}));

const defaultBonusAnswers: BonusPrediction = {};

const bonusFieldLabels: Array<{ key: keyof BonusPrediction; label: string; points: string; type?: "number" }> = [
  { key: "worldChampion", label: "Världsmästare", points: "20p" },
  { key: "finalistOne", label: "Finalist 1", points: "10p" },
  { key: "finalistTwo", label: "Finalist 2", points: "10p" },
  { key: "topScorer", label: "Skytteligavinnare", points: "15p" },
  { key: "mostGroupGoals", label: "Flest mål i gruppspelet", points: "10p" },
  { key: "surpriseTeam", label: "Skrällag", points: "10p" },
  { key: "totalTournamentGoals", label: "Totalt antal mål i turneringen", points: "10p", type: "number" },
];

function logStorageError(message: string, error: unknown) {
  console.error(message, describeSupabaseError(error), error);
}

const flagByTeam: Record<string, string> = {
  Algeriet: "🇩🇿",
  Argentina: "🇦🇷",
  Australien: "🇦🇺",
  Belgien: "🇧🇪",
  "Bosnien-Herzigovina": "🇧🇦",
  Brasilien: "🇧🇷",
  Colombia: "🇨🇴",
  Curaçao: "🇨🇼",
  Czechia: "🇨🇿",
  Ecuador: "🇪🇨",
  Egypten: "🇪🇬",
  Elfenbenskusten: "🇨🇮",
  England: "🏴",
  Frankrike: "🇫🇷",
  Ghana: "🇬🇭",
  Haiti: "🇭🇹",
  Irak: "🇮🇶",
  Iran: "🇮🇷",
  Japan: "🇯🇵",
  Jordanien: "🇯🇴",
  Kanada: "🇨🇦",
  "Kap Verde": "🇨🇻",
  Kongo: "🇨🇩",
  Kroatien: "🇭🇷",
  Marocko: "🇲🇦",
  Mexiko: "🇲🇽",
  Nederländerna: "🇳🇱",
  Norge: "🇳🇴",
  "Nya Zeeland": "🇳🇿",
  Panama: "🇵🇦",
  Paraguay: "🇵🇾",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  Saudiarabien: "🇸🇦",
  Schweiz: "🇨🇭",
  Senegal: "🇸🇳",
  Skottland: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  Spanien: "🇪🇸",
  Sverige: "🇸🇪",
  Sydafrika: "🇿🇦",
  Sydkorea: "🇰🇷",
  Tunisien: "🇹🇳",
  Turkiet: "🇹🇷",
  Tyskland: "🇩🇪",
  Uruguay: "🇺🇾",
  USA: "🇺🇸",
  Uzbekistan: "🇺🇿",
  Österrike: "🇦🇹",
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function teamLabel(team: string) {
  return flagByTeam[team] ? `${flagByTeam[team]} ${team}` : team;
}

function hashPassword(password: string) {
  let hash = 2166136261;
  for (let index = 0; index < password.length; index += 1) {
    hash ^= password.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(new Date(date));
}

function nextFixture() {
  const now = new Date();
  return fixtures.find((fixture) => new Date(`${fixture.date}T${fixture.kickoffTime}:00`) > now) ?? fixtures[0];
}

function getSwedishDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMatchDayPanel() {
  const today = getSwedishDateKey();
  const todayMatches = fixtures
    .filter((fixture) => fixture.date === today)
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime) || a.id - b.id);

  if (todayMatches.length > 0) {
    return { label: "Dagens matcher", date: today, matches: todayMatches };
  }

  const next = nextFixture();
  const nextMatches = fixtures
    .filter((fixture) => fixture.date === next.date)
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime) || a.id - b.id);

  return { label: "Nästa matchdag", date: next.date, matches: nextMatches };
}

function buildDailyScoreData(
  predictions: Prediction[],
  results: Record<number, ScoreLine>,
  lockedDates: string[],
  resultWinners: Record<number, string> = {},
) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  let total = 0;

  const rows = fixtures
    .filter((fixture) => lockedDates.includes(fixture.date) && results[fixture.id])
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .reduce<Array<{ date: string; points: number; dayPoints: number }>>((days, fixture) => {
      const prediction = predictionMap.get(fixture.id);
      const dayPoints = scorePrediction(
        prediction ?? { matchId: fixture.id },
        results[fixture.id],
        fixture.stage,
        resultWinners[fixture.id],
      );
      total += dayPoints;

      const label = formatDate(fixture.date);
      const existingDay = days.find((day) => day.date === label);
      if (existingDay) {
        existingDay.dayPoints += dayPoints;
        existingDay.points = total;
        return days;
      }

      days.push({ date: label, points: total, dayPoints });
      return days;
    }, []);

  return rows.length > 0 ? rows : [{ date: "Start", points: 0, dayPoints: 0 }];
}

function scorePredictions(
  predictions: Prediction[],
  results: Record<number, ScoreLine>,
  lockedDates: string[],
  resultWinners: Record<number, string> = {},
  bonusAnswers: BonusPrediction = defaultBonusAnswers,
  officialBonusAnswers: BonusPrediction = defaultBonusAnswers,
  closestTotalGoalDelta?: number,
) {
  let exact = 0;
  let groupPoints = 0;
  let knockoutPoints = 0;
  let latestChange = 0;
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const latestLockedDate = fixtures
    .filter((fixture) => lockedDates.includes(fixture.date) && results[fixture.id])
    .map((fixture) => fixture.date)
    .sort((a, b) => b.localeCompare(a))[0];

  for (const prediction of predictions) {
    const fixture = fixtureById.get(prediction.matchId);
    const result = results[prediction.matchId];
    if (!fixture || !result || !lockedDates.includes(fixture.date)) continue;

    const actualWinner =
      fixture.stage === "Gruppspel"
        ? undefined
        : resultWinners[prediction.matchId] ?? matchWinner(fixture.home, fixture.away, result);
    const matchPoints = scorePrediction(prediction, result, fixture.stage, actualWinner);
    if (prediction.score?.home === result.home && prediction.score.away === result.away) exact += 1;
    if (fixture.stage === "Gruppspel") groupPoints += matchPoints;
    else knockoutPoints += matchPoints;
    if (fixture.date === latestLockedDate) latestChange += matchPoints;
  }

  const bonusPoints = scoreBonusPrediction(bonusAnswers, officialBonusAnswers, closestTotalGoalDelta);
  const points = groupPoints + knockoutPoints + bonusPoints;

  return { points, exact, groupPoints, knockoutPoints, bonusPoints, latestChange };
}

function loadProfilePredictions(
  profileId: string,
  activeProfileId: string | undefined,
  activePredictions: Prediction[],
  storedPredictions: Record<string, Prediction[]>,
) {
  if (profileId === activeProfileId) return activePredictions;
  if (storedPredictions[profileId]) return storedPredictions[profileId];
  if (typeof window === "undefined") return defaultPredictions;

  const savedVersion = window.localStorage.getItem(`vm-tipset-predictions-version-${profileId}`);
  if (savedVersion !== predictionsVersion) return defaultPredictions;
  return readStoredJson(`vm-tipset-predictions-${profileId}`, defaultPredictions);
}

function buildLeaderboardRows(
  profiles: PlayerProfile[],
  activeProfileId: string | undefined,
  activePredictions: Prediction[],
  results: Record<number, ScoreLine>,
  lockedDates: string[],
  resultWinners: Record<number, string>,
  storedPredictions: Record<string, Prediction[]>,
  storedBonusAnswers: Record<string, BonusPrediction>,
  activeBonusAnswers: BonusPrediction,
  officialBonusAnswers: BonusPrediction,
): UserScore[] {
  const playerProfiles = profiles.filter((profile) => profile.role === "player");
  const bonusByProfile = new Map(
    playerProfiles.map((profile) => [
      profile.id,
      profile.id === activeProfileId ? activeBonusAnswers : storedBonusAnswers[profile.id] ?? loadProfileBonus(profile.id, activeProfileId, activeBonusAnswers),
    ]),
  );
  const closestTotalGoalDelta =
    typeof officialBonusAnswers.totalTournamentGoals === "number"
      ? Math.min(
          ...[...bonusByProfile.values()]
            .map((bonus) =>
              typeof bonus.totalTournamentGoals === "number"
                ? Math.abs(bonus.totalTournamentGoals - officialBonusAnswers.totalTournamentGoals!)
                : undefined,
            )
            .filter((value): value is number => value !== undefined),
        )
      : undefined;

  return profiles
    .filter((profile) => profile.role === "player")
    .map((profile) => {
      const profilePredictions = loadProfilePredictions(profile.id, activeProfileId, activePredictions, storedPredictions);
      const score = scorePredictions(
        profilePredictions,
        results,
        lockedDates,
        resultWinners,
        bonusByProfile.get(profile.id) ?? defaultBonusAnswers,
        officialBonusAnswers,
        Number.isFinite(closestTotalGoalDelta) ? closestTotalGoalDelta : undefined,
      );

      return {
        id: profile.id,
        name: profile.name,
        avatar: profile.initials,
        trend: score.latestChange,
        history: buildDailyScoreData(profilePredictions, results, lockedDates, resultWinners).map((day) => day.points),
        ...score,
      };
    })
    .sort((a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name, "sv"));
}

type ResolvedKnockoutFixture = Fixture & { resolvedHome: string; resolvedAway: string };

function matchWinner(home: string, away: string, score?: ScoreLine, winnerOverride?: string) {
  if (winnerOverride === home || winnerOverride === away) return winnerOverride;
  if (!score) return undefined;
  if (score.home > score.away) return home;
  if (score.home < score.away) return away;
  return undefined;
}

function matchLoser(home: string, away: string, score?: ScoreLine, winnerOverride?: string) {
  if (winnerOverride === home) return away;
  if (winnerOverride === away) return home;
  if (!score) return undefined;
  if (score.home > score.away) return away;
  if (score.home < score.away) return home;
  return undefined;
}

function stageIsLocked(stage: MatchStage, lockedDates: string[]) {
  const stageFixtures = fixtures.filter((match) => match.stage === stage);
  return stageFixtures.length > 0 && stageFixtures.every((match) => lockedDates.includes(match.date));
}

function getOpenKnockoutStages(lockedDates: string[]): MatchStage[] {
  if (!stageIsLocked("Gruppspel", lockedDates)) return [];
  if (!stageIsLocked("Sextondelsfinal", lockedDates)) return ["Sextondelsfinal"];
  if (!stageIsLocked("Åttondelsfinal", lockedDates)) return ["Åttondelsfinal"];
  if (!stageIsLocked("Kvartsfinal", lockedDates)) return ["Kvartsfinal"];
  if (!stageIsLocked("Semifinal", lockedDates)) return ["Semifinal"];

  return (["Bronsmatch", "Final"] as MatchStage[]).filter((stage) => !stageIsLocked(stage, lockedDates));
}

function getPhaseStatus(lockedDates: string[]) {
  if (!stageIsLocked("Gruppspel", lockedDates)) {
    return {
      label: "Gruppspel öppet",
      description: "Tippa gruppspel och bonusfrågor. Slutspel låses upp efter gruppspelet.",
      openLabel: "Gruppspel",
    };
  }

  const openKnockoutStages = getOpenKnockoutStages(lockedDates);
  if (openKnockoutStages.length > 0) {
    return {
      label: `${openKnockoutStages.join(" & ")} öppet`,
      description: "Endast aktuell slutspelsrunda är redigerbar. Tidigare rundor visas låsta.",
      openLabel: openKnockoutStages.join(" & "),
    };
  }

  return {
    label: "Turneringen färdig",
    description: "Alla faser är låsta. Tipsen kan visas men inte ändras.",
    openLabel: "Stängd",
  };
}

function resolveKnockoutTeam(
  slot: string,
  standingsByGroup: Record<GroupLetter, ReturnType<typeof buildStandings>>,
  thirdRank: ReturnType<typeof rankThirdPlaced>,
  usedThirdGroups?: Set<GroupLetter>,
) {
  const groupWinner = slot.match(/^Vinnare grupp ([A-L])$/);
  if (groupWinner) return standingsByGroup[groupWinner[1] as GroupLetter]?.[0]?.team ?? slot;

  const groupRunnerUp = slot.match(/^Tvåa grupp ([A-L])$/);
  if (groupRunnerUp) return standingsByGroup[groupRunnerUp[1] as GroupLetter]?.[1]?.team ?? slot;

  const bestThird = slot.match(/^Bästa trea ([A-L]+)$/);
  if (bestThird) {
    const allowedGroups = bestThird[1].split("") as GroupLetter[];
    const third = thirdRank.find((item) => allowedGroups.includes(item.group) && !usedThirdGroups?.has(item.group));
    if (!third) return slot;
    usedThirdGroups?.add(third.group);
    return third.standing.team;
  }

  return slot;
}

function resolveFromMatchSlot(
  slot: string,
  resolvedById: Map<number, ResolvedKnockoutFixture>,
  scoreByMatchId: Map<number, ScoreLine | undefined>,
  winnerByMatchId: Map<number, string | undefined>,
) {
  const winner = slot.match(/^Vinnare match (\d+)$/);
  if (winner) {
    const source = resolvedById.get(Number(winner[1]));
    return source
      ? matchWinner(source.resolvedHome, source.resolvedAway, scoreByMatchId.get(source.id), winnerByMatchId.get(source.id)) ?? slot
      : slot;
  }

  const loser = slot.match(/^Förlorare match (\d+)$/);
  if (loser) {
    const source = resolvedById.get(Number(loser[1]));
    return source
      ? matchLoser(source.resolvedHome, source.resolvedAway, scoreByMatchId.get(source.id), winnerByMatchId.get(source.id)) ?? slot
      : slot;
  }

  return slot;
}

function buildResolvedKnockoutFixtures({
  sourceResults,
  predictions = [],
  lockedDates = [],
  resolveGroupTeams = false,
  forceResolveAll = false,
  useSourceResultsForAdvancement = false,
  advancementWinners = {},
}: {
  sourceResults: Record<number, ScoreLine>;
  predictions?: Prediction[];
  lockedDates?: string[];
  resolveGroupTeams?: boolean;
  forceResolveAll?: boolean;
  useSourceResultsForAdvancement?: boolean;
  advancementWinners?: Record<number, string>;
}) {
  if (!resolveGroupTeams) {
    return fixtures.slice(72).map((match) => ({
      ...match,
      resolvedHome: match.home,
      resolvedAway: match.away,
    }));
  }

  const standingsByGroup = groupLetters.reduce<Record<GroupLetter, ReturnType<typeof buildStandings>>>((map, group) => {
    map[group] = buildStandings(sourceResults, group);
    return map;
  }, {} as Record<GroupLetter, ReturnType<typeof buildStandings>>);
  const thirdRank = rankThirdPlaced(sourceResults);
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  const scoreByMatchId = new Map(
    fixtures.slice(72).map((match) => [
      match.id,
      useSourceResultsForAdvancement ? sourceResults[match.id] : predictionMap.get(match.id)?.score,
    ]),
  );
  const winnerByMatchId = new Map(
    fixtures.slice(72).map((match) => [match.id, advancementWinners[match.id] ?? predictionMap.get(match.id)?.winner]),
  );
  const resolvedById = new Map<number, ResolvedKnockoutFixture>();
  const usedThirdGroups = new Set<GroupLetter>();
  const previousStage: Partial<Record<MatchStage, MatchStage>> = {
    Åttondelsfinal: "Sextondelsfinal",
    Kvartsfinal: "Åttondelsfinal",
    Semifinal: "Kvartsfinal",
    Bronsmatch: "Semifinal",
    Final: "Semifinal",
  };

  return fixtures.slice(72).map((match) => {
    const requiredPreviousStage = previousStage[match.stage];
    const canResolveRound =
      forceResolveAll ||
      match.stage === "Sextondelsfinal" ||
      (requiredPreviousStage ? stageIsLocked(requiredPreviousStage, lockedDates) : false);

    const resolved = {
      ...match,
      resolvedHome: canResolveRound
        ? resolveFromMatchSlot(
            resolveKnockoutTeam(match.home, standingsByGroup, thirdRank, match.stage === "Sextondelsfinal" ? usedThirdGroups : undefined),
            resolvedById,
            scoreByMatchId,
            winnerByMatchId,
          )
        : match.home,
      resolvedAway: canResolveRound
        ? resolveFromMatchSlot(
            resolveKnockoutTeam(match.away, standingsByGroup, thirdRank, match.stage === "Sextondelsfinal" ? usedThirdGroups : undefined),
            resolvedById,
            scoreByMatchId,
            winnerByMatchId,
          )
        : match.away,
    };

    resolvedById.set(match.id, resolved);
    return resolved;
  });
}

function getWinnerLabel(match: Fixture & { resolvedHome?: string; resolvedAway?: string }, score?: ScoreLine, winner?: string) {
  if (!score) return "Ej valt";
  const home = match.resolvedHome ?? match.home;
  const away = match.resolvedAway ?? match.away;
  if (score.home === score.away && winner && [home, away].includes(winner)) return winner;
  return score.home > score.away ? home : score.home < score.away ? away : "Oavgjort";
}

function randomScore(): ScoreLine {
  return { home: Math.floor(Math.random() * 5), away: Math.floor(Math.random() * 5) };
}

function randomPredictionsForFixtures() {
  const predictionsByMatchId = new Map<number, Prediction>();
  const sourceResults: Record<number, ScoreLine> = {};
  const advancementWinners: Record<number, string> = {};
  const allLockedDates = Array.from(new Set(fixtures.map((match) => match.date)));

  fixtures
    .filter((match) => match.stage === "Gruppspel")
    .forEach((match) => {
      const score = randomScore();
      const winner = score.home > score.away ? match.home : score.home < score.away ? match.away : "Oavgjort";
      sourceResults[match.id] = score;
      predictionsByMatchId.set(match.id, { matchId: match.id, score, winner });
    });

  for (const stage of stageOrder) {
    const resolvedKnockout = buildResolvedKnockoutFixtures({
      sourceResults,
      lockedDates: allLockedDates,
      resolveGroupTeams: true,
      useSourceResultsForAdvancement: true,
      advancementWinners,
    });

    resolvedKnockout
      .filter((match) => match.stage === stage)
      .forEach((match) => {
        const score = randomScore();
        const home = match.resolvedHome ?? match.home;
        const away = match.resolvedAway ?? match.away;
        const winner =
          score.home > score.away
            ? home
            : score.home < score.away
              ? away
              : Math.random() > 0.5
                ? home
                : away;

        sourceResults[match.id] = score;
        advancementWinners[match.id] = winner;
        predictionsByMatchId.set(match.id, { matchId: match.id, score, winner });
      });
  }

  return fixtures.map((match) => {
    const generated = predictionsByMatchId.get(match.id);
    if (generated) return generated;

    const score = randomScore();
    const winner =
      score.home > score.away
        ? match.home
        : score.home < score.away
          ? match.away
          : match.stage === "Gruppspel"
            ? "Oavgjort"
            : Math.random() > 0.5
              ? match.home
              : match.away;

    return {
      matchId: match.id,
      score,
      winner,
    };
  });
}

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function loadProfileBonus(profileId: string, activeProfileId: string | undefined, activeBonusAnswers: BonusPrediction) {
  if (profileId === activeProfileId) return activeBonusAnswers;
  if (typeof window === "undefined") return defaultBonusAnswers;

  const savedVersion = window.localStorage.getItem(`vm-tipset-bonus-version-${profileId}`);
  if (savedVersion !== bonusVersion) return defaultBonusAnswers;
  return readStoredJson(`vm-tipset-bonus-${profileId}`, defaultBonusAnswers);
}

function updateBonusValue(current: BonusPrediction, key: keyof BonusPrediction, value: string): BonusPrediction {
  if (key === "totalTournamentGoals") {
    return { ...current, [key]: value === "" ? undefined : Number(value) };
  }

  return { ...current, [key]: value };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Hem");
  const [predictions, setPredictions] = useState<Prediction[]>(defaultPredictions);
  const [results, setResults] = useState<Record<number, ScoreLine>>(sampleResults);
  const [resultWinners, setResultWinners] = useState<Record<number, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<GroupLetter>("A");
  const [profiles, setProfiles] = useState<PlayerProfile[]>(starterProfiles);
  const [currentProfile, setCurrentProfile] = useState<PlayerProfile | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPassword, setNewPlayerPassword] = useState("");
  const [authProfile, setAuthProfile] = useState<PlayerProfile | null>(null);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [lockedDates, setLockedDates] = useState<string[]>([]);
  const [bonusAnswers, setBonusAnswers] = useState<BonusPrediction>(defaultBonusAnswers);
  const [officialBonusAnswers, setOfficialBonusAnswers] = useState<BonusPrediction>(defaultBonusAnswers);
  const [allPredictionsByProfile, setAllPredictionsByProfile] = useState<Record<string, Prediction[]>>({});
  const [allBonusByProfile, setAllBonusByProfile] = useState<Record<string, BonusPrediction>>({});
  const [isDatabaseLoaded, setIsDatabaseLoaded] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local">(isSupabaseEnabled ? "supabase" : "local");
  const allPredictionsRef = useRef<Record<string, Prediction[]>>({});
  const allBonusRef = useRef<Record<string, BonusPrediction>>({});

  useEffect(() => {
    allPredictionsRef.current = allPredictionsByProfile;
  }, [allPredictionsByProfile]);

  useEffect(() => {
    allBonusRef.current = allBonusByProfile;
  }, [allBonusByProfile]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      if (isSupabaseEnabled) {
        try {
          const [dbProfiles, dbPredictions, dbBonus, dbResults, dbLockedDates, dbOfficialBonus] = await Promise.all([
            loadProfilesFromDb(),
            loadAllPredictionsFromDb(),
            loadAllBonusFromDb(),
            loadResultsFromDb(),
            loadAppStateFromDb<string[]>("locked_dates", []),
            loadAppStateFromDb<BonusPrediction>("official_bonus", defaultBonusAnswers),
          ]);

          if (cancelled) return;

          const nextProfiles = dbProfiles.length > 0 ? dbProfiles : starterProfiles;
          if (dbProfiles.length === 0) await saveProfilesToDb(starterProfiles);

          setProfiles(nextProfiles);
          setAllPredictionsByProfile(dbPredictions);
          setAllBonusByProfile(dbBonus);
          setResults(dbResults.results);
          setResultWinners(dbResults.resultWinners);
          setLockedDates(dbLockedDates);
          setOfficialBonusAnswers(dbOfficialBonus);
          setStorageMode("supabase");
          setIsDatabaseLoaded(true);
          return;
        } catch (error) {
          logStorageError("Supabase kunde inte laddas, använder localStorage som fallback.", error);
          setStorageMode("local");
        }
      }

      const savedProfiles = readStoredJson<PlayerProfile[] | null>("vm-tipset-profiles", null);
      setLockedDates(readStoredJson("vm-tipset-locked-dates", []));
      setOfficialBonusAnswers(readStoredJson("vm-tipset-official-bonus", defaultBonusAnswers));
      setResultWinners(readStoredJson("vm-tipset-result-winners", {}));
      setResults(readStoredJson("vm-tipset-results", sampleResults));
      setProfiles(savedProfiles ?? starterProfiles);
      setIsDatabaseLoaded(true);
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      saveProfilesToDb(profiles).catch((error) => logStorageError("Kunde inte spara profiler.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-profiles", JSON.stringify(profiles));
  }, [isDatabaseLoaded, profiles, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      saveAppStateToDb("locked_dates", lockedDates).catch((error) => logStorageError("Kunde inte spara låsta dagar.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-locked-dates", JSON.stringify(lockedDates));
  }, [isDatabaseLoaded, lockedDates, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      saveResultsToDb(results, resultWinners).catch((error) => logStorageError("Kunde inte spara resultat.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-results", JSON.stringify(results));
    window.localStorage.setItem("vm-tipset-result-winners", JSON.stringify(resultWinners));
  }, [isDatabaseLoaded, resultWinners, results, storageMode]);

  useEffect(() => {
    if (!currentProfile) return;

    window.localStorage.setItem("vm-tipset-active-profile", currentProfile.id);
    const saved =
      allPredictionsRef.current[currentProfile.id] ??
      (window.localStorage.getItem(`vm-tipset-predictions-version-${currentProfile.id}`) === predictionsVersion
        ? readStoredJson(`vm-tipset-predictions-${currentProfile.id}`, defaultPredictions)
        : defaultPredictions);
    setPredictions(saved);
    const savedBonus =
      allBonusRef.current[currentProfile.id] ??
      (window.localStorage.getItem(`vm-tipset-bonus-version-${currentProfile.id}`) === bonusVersion
        ? readStoredJson(`vm-tipset-bonus-${currentProfile.id}`, defaultBonusAnswers)
        : defaultBonusAnswers);
    setBonusAnswers(savedBonus);
    setActiveTab(currentProfile.role === "admin" ? "Admin" : "Hem");
  }, [currentProfile]);

  useEffect(() => {
    if (!currentProfile || !isDatabaseLoaded) return;
    setAllPredictionsByProfile((current) => ({ ...current, [currentProfile.id]: predictions }));
    if (storageMode === "supabase") {
      saveProfilesToDb([currentProfile])
        .then(() => savePredictionsToDb(currentProfile.id, predictions))
        .catch((error) => logStorageError("Kunde inte spara tips.", error));
      return;
    }
    window.localStorage.setItem(`vm-tipset-predictions-${currentProfile.id}`, JSON.stringify(predictions));
    window.localStorage.setItem(`vm-tipset-predictions-version-${currentProfile.id}`, predictionsVersion);
  }, [currentProfile, isDatabaseLoaded, predictions, storageMode]);

  useEffect(() => {
    if (!currentProfile || !isDatabaseLoaded) return;
    setAllBonusByProfile((current) => ({ ...current, [currentProfile.id]: bonusAnswers }));
    if (storageMode === "supabase") {
      saveProfilesToDb([currentProfile])
        .then(() => saveBonusToDb(currentProfile.id, bonusAnswers))
        .catch((error) => logStorageError("Kunde inte spara bonus.", error));
      return;
    }
    window.localStorage.setItem(`vm-tipset-bonus-${currentProfile.id}`, JSON.stringify(bonusAnswers));
    window.localStorage.setItem(`vm-tipset-bonus-version-${currentProfile.id}`, bonusVersion);
  }, [bonusAnswers, currentProfile, isDatabaseLoaded, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      saveAppStateToDb("official_bonus", officialBonusAnswers).catch((error) => logStorageError("Kunde inte spara bonusfacit.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-official-bonus", JSON.stringify(officialBonusAnswers));
  }, [isDatabaseLoaded, officialBonusAnswers, storageMode]);

  const predictionScore = useMemo(
    () => {
      const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

      return predictions.reduce((sum, prediction) => {
        const fixture = fixtureById.get(prediction.matchId);
        if (!fixture || !lockedDates.includes(fixture.date)) return sum;
        const actualWinner =
          fixture.stage === "Gruppspel"
            ? undefined
            : resultWinners[prediction.matchId] ?? matchWinner(fixture.home, fixture.away, results[prediction.matchId]);
        return sum + scorePrediction(prediction, results[prediction.matchId], fixture.stage, actualWinner);
      }, 0);
    },
    [lockedDates, predictions, resultWinners, results],
  );

  const next = nextFixture();
  const matchDayPanel = useMemo(() => getMatchDayPanel(), []);
  const thirdPlaced = rankThirdPlaced(results).slice(0, 8);
  const visibleTabs = currentProfile?.role === "admin" ? tabs : tabs.filter((tab) => tab !== "Admin");
  const phaseStatus = useMemo(() => getPhaseStatus(lockedDates), [lockedDates]);
  const openKnockoutStages = useMemo(() => getOpenKnockoutStages(lockedDates), [lockedDates]);
  const dailyScoreData = useMemo(
    () => buildDailyScoreData(predictions, results, lockedDates, resultWinners),
    [lockedDates, predictions, resultWinners, results],
  );
  const liveLeaderboard = useMemo(
    () =>
      buildLeaderboardRows(
        profiles,
        currentProfile?.id,
        predictions,
        results,
        lockedDates,
        resultWinners,
        allPredictionsByProfile,
        allBonusByProfile,
        bonusAnswers,
        officialBonusAnswers,
      ),
    [
      allBonusByProfile,
      allPredictionsByProfile,
      bonusAnswers,
      currentProfile?.id,
      lockedDates,
      officialBonusAnswers,
      predictions,
      profiles,
      resultWinners,
      results,
    ],
  );
  const topThree = liveLeaderboard.slice(0, 3);
  const currentProfileScore = liveLeaderboard.find((user) => user.id === currentProfile?.id)?.points ?? predictionScore;

  function updatePrediction(match: Fixture, side: "home" | "away", value: number) {
    if (lockedDates.includes(match.date)) return;

    setPredictions((current) =>
      current.map((prediction) => {
        if (prediction.matchId !== match.id) return prediction;
        const score = prediction.score ?? { home: 0, away: 0 };
        const nextScore = { ...score, [side]: Number.isNaN(value) ? 0 : value };
        const winner =
          nextScore.home > nextScore.away
            ? match.home
            : nextScore.home < nextScore.away
              ? match.away
              : match.stage === "Gruppspel"
                ? "Oavgjort"
                : prediction.winner && [match.home, match.away].includes(prediction.winner)
                  ? prediction.winner
                  : "Ej valt";
        return {
          ...prediction,
          score: nextScore,
          winner,
        };
      }),
    );
  }

  function updatePredictionWinner(match: Fixture, winner: string) {
    if (lockedDates.includes(match.date)) return;

    setPredictions((current) =>
      current.map((prediction) => (prediction.matchId === match.id ? { ...prediction, winner } : prediction)),
    );
  }

  function updateBonusAnswer(key: keyof BonusPrediction, value: string) {
    setBonusAnswers((current) => updateBonusValue(current, key, value));
  }

  function updateOfficialBonusAnswer(key: keyof BonusPrediction, value: string) {
    setOfficialBonusAnswers((current) => updateBonusValue(current, key, value));
  }

  function resetCurrentPredictions() {
    const confirmed = window.confirm("Vill du nollställa alla olåsta matcher i ditt tips till 0-0?");
    if (!confirmed) return;

    setPredictions((current) =>
      current.map((prediction) => {
        const fixture = fixtures.find((match) => match.id === prediction.matchId);
        if (fixture && lockedDates.includes(fixture.date)) return prediction;
        return { matchId: prediction.matchId, winner: fixture?.stage === "Gruppspel" ? "Ej tippat" : "Ej valt" };
      }),
    );
  }

  function randomizeDevData() {
    const confirmed = window.confirm("Slumpa tips för alla spelare, slumpa adminresultat och lås alla matchdagar?");
    if (!confirmed) return;

    const randomResults = fixtures.reduce<Record<number, ScoreLine>>((resultMap, fixture) => {
      resultMap[fixture.id] = randomScore();
      return resultMap;
    }, {});

    const allLockedDates = [...new Set(fixtures.map((fixture) => fixture.date))];
    const randomResultWinners: Record<number, string> = {};
    for (const stage of stageOrder) {
      const resolvedKnockout = buildResolvedKnockoutFixtures({
        sourceResults: randomResults,
        lockedDates: allLockedDates,
        resolveGroupTeams: true,
        useSourceResultsForAdvancement: true,
        advancementWinners: randomResultWinners,
      });

      for (const match of resolvedKnockout.filter((fixture) => fixture.stage === stage)) {
        const score = randomResults[match.id];
        randomResultWinners[match.id] =
          score.home > score.away
            ? match.resolvedHome
            : score.home < score.away
              ? match.resolvedAway
              : Math.random() > 0.5
                ? match.resolvedHome
                : match.resolvedAway;
      }
    }

    const playerProfiles = profiles.filter((profile) => profile.role === "player");
    const randomPredictionsByProfile = Object.fromEntries(
      playerProfiles.map((profile) => [profile.id, randomPredictionsForFixtures()]),
    );

    playerProfiles.forEach((profile) => {
      const profilePredictions = randomPredictionsByProfile[profile.id];
      if (storageMode === "supabase") {
        saveProfilesToDb([profile])
          .then(() => savePredictionsToDb(profile.id, profilePredictions))
          .catch((error) => logStorageError("Kunde inte spara slumpade tips.", error));
        saveProfilesToDb([profile])
          .then(() => saveBonusToDb(profile.id, defaultBonusAnswers))
          .catch((error) => logStorageError("Kunde inte spara slumpad bonus.", error));
      } else {
        window.localStorage.setItem(`vm-tipset-predictions-${profile.id}`, JSON.stringify(profilePredictions));
        window.localStorage.setItem(`vm-tipset-predictions-version-${profile.id}`, predictionsVersion);
        window.localStorage.setItem(`vm-tipset-bonus-${profile.id}`, JSON.stringify(defaultBonusAnswers));
        window.localStorage.setItem(`vm-tipset-bonus-version-${profile.id}`, bonusVersion);
      }
    });

    setAllPredictionsByProfile((current) => ({
      ...current,
      ...randomPredictionsByProfile,
    }));
    setAllBonusByProfile((current) => ({
      ...current,
      ...Object.fromEntries(playerProfiles.map((profile) => [profile.id, defaultBonusAnswers])),
    }));
    if (currentProfile?.role === "player") setPredictions(randomPredictionsByProfile[currentProfile.id]);
    setResults(randomResults);
    setResultWinners(randomResultWinners);
    setLockedDates(allLockedDates);
  }

  function resetDevData() {
    const confirmed = window.confirm("Nollställ devdata: alla tips till 0-0, töm adminresultat och lås upp alla dagar?");
    if (!confirmed) return;

    profiles
      .filter((profile) => profile.role === "player")
      .forEach((profile) => {
        if (storageMode === "supabase") {
          saveProfilesToDb([profile])
            .then(() => savePredictionsToDb(profile.id, defaultPredictions))
            .catch((error) => logStorageError("Kunde inte nollställa tips.", error));
          saveProfilesToDb([profile])
            .then(() => saveBonusToDb(profile.id, defaultBonusAnswers))
            .catch((error) => logStorageError("Kunde inte nollställa bonus.", error));
        } else {
          window.localStorage.setItem(`vm-tipset-predictions-${profile.id}`, JSON.stringify(defaultPredictions));
          window.localStorage.setItem(`vm-tipset-predictions-version-${profile.id}`, predictionsVersion);
          window.localStorage.setItem(`vm-tipset-bonus-${profile.id}`, JSON.stringify(defaultBonusAnswers));
          window.localStorage.setItem(`vm-tipset-bonus-version-${profile.id}`, bonusVersion);
        }
      });

    const playerIds = profiles.filter((profile) => profile.role === "player").map((profile) => profile.id);
    setAllPredictionsByProfile((current) => ({
      ...current,
      ...Object.fromEntries(playerIds.map((profileId) => [profileId, defaultPredictions])),
    }));
    setAllBonusByProfile((current) => ({
      ...current,
      ...Object.fromEntries(playerIds.map((profileId) => [profileId, defaultBonusAnswers])),
    }));
    if (currentProfile?.role === "player") setPredictions(defaultPredictions);
    setBonusAnswers(defaultBonusAnswers);
    setOfficialBonusAnswers(defaultBonusAnswers);
    setResults({});
    setResultWinners({});
    setLockedDates([]);
  }

  function updateResult(matchId: number, side: "home" | "away", value: number) {
    setResults((current) => ({
      ...current,
      [matchId]: { ...(current[matchId] ?? { home: 0, away: 0 }), [side]: Number.isNaN(value) ? 0 : value },
    }));
  }

  function updateResultWinner(matchId: number, winner: string) {
    setResultWinners((current) => {
      const next = { ...current };
      if (winner) next[matchId] = winner;
      else delete next[matchId];
      return next;
    });
  }

  function toggleLockedDate(date: string) {
    setLockedDates((current) => (current.includes(date) ? current.filter((item) => item !== date) : [...current, date]));
  }

  function createPlayer() {
    const name = newPlayerName.trim();
    const password = newPlayerPassword.trim();
    if (!name || password.length < 3) {
      window.alert("Ange namn och ett lösenord med minst 3 tecken.");
      return;
    }

    const id = name.toLowerCase().replace(/[^a-z0-9åäö]+/gi, "-").replace(/^-|-$/g, "");
    const initials = name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const profile = { id: `${id}-${Date.now()}`, name, initials, role: "player" as const, passwordHash: hashPassword(password) };

    setProfiles((current) => [...current, profile]);
    setAllPredictionsByProfile((current) => ({ ...current, [profile.id]: defaultPredictions }));
    setAllBonusByProfile((current) => ({ ...current, [profile.id]: defaultBonusAnswers }));
    if (storageMode === "supabase") {
      saveProfilesToDb([...profiles, profile]).catch((error) => logStorageError("Kunde inte skapa spelare.", error));
      saveProfilesToDb([profile])
        .then(() => savePredictionsToDb(profile.id, defaultPredictions))
        .catch((error) => logStorageError("Kunde inte skapa standardtips.", error));
      saveProfilesToDb([profile])
        .then(() => saveBonusToDb(profile.id, defaultBonusAnswers))
        .catch((error) => logStorageError("Kunde inte skapa bonusrad.", error));
    }
    setCurrentProfile(profile);
    setNewPlayerName("");
    setNewPlayerPassword("");
  }

  function requestProfileAccess(profile: PlayerProfile) {
    setAuthError("");
    setAuthPassword("");

    if (profile.role === "admin" && !requireAdminPassword) {
      setCurrentProfile(profile);
      return;
    }

    setAuthProfile(profile);
  }

  function unlockProfile() {
    if (!authProfile) return;

    const password = authPassword.trim();
    if (password.length < 3) {
      setAuthError("Lösenordet måste vara minst 3 tecken.");
      return;
    }

    if (!authProfile.passwordHash) {
      const updatedProfile = { ...authProfile, passwordHash: hashPassword(password) };
      setProfiles((current) => current.map((profile) => (profile.id === updatedProfile.id ? updatedProfile : profile)));
      setCurrentProfile(updatedProfile);
      setAuthProfile(null);
      setAuthPassword("");
      return;
    }

    if (authProfile.passwordHash !== hashPassword(password)) {
      setAuthError("Fel lösenord.");
      return;
    }

    setCurrentProfile(authProfile);
    setAuthProfile(null);
    setAuthPassword("");
  }

  function openProfileAsAdmin(profile: PlayerProfile) {
    setCurrentProfile(profile);
  }

  function resetProfilePassword(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile || profile.role !== "player") return;

    const confirmed = window.confirm(
      `Vill du nollställa lösenordet för ${profile.name}? Spelaren får sätta ett nytt lösenord nästa gång profilen öppnas.`,
    );
    if (!confirmed) return;

    setProfiles((current) => current.map((item) => (item.id === profile.id ? { ...item, passwordHash: undefined } : item)));
  }

  function deleteProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;

    const confirmed = window.confirm(
      `Vill du verkligen ta bort profilen ${profile.name}? Profilens sparade tips och bonusfrågor tas också bort.`,
    );
    if (!confirmed) return;

    window.localStorage.removeItem(`vm-tipset-predictions-${profile.id}`);
    window.localStorage.removeItem(`vm-tipset-predictions-version-${profile.id}`);
    window.localStorage.removeItem(`vm-tipset-bonus-${profile.id}`);
    window.localStorage.removeItem(`vm-tipset-bonus-version-${profile.id}`);
    if (storageMode === "supabase") {
      deleteProfileFromDb(profile.id).catch((error) => logStorageError("Kunde inte ta bort profil.", error));
    }
    setAllPredictionsByProfile((current) => {
      const next = { ...current };
      delete next[profile.id];
      return next;
    });
    setAllBonusByProfile((current) => {
      const next = { ...current };
      delete next[profile.id];
      return next;
    });
    setProfiles((current) => current.filter((item) => item.id !== profile.id));

    if (currentProfile?.id === profile.id) {
      window.localStorage.removeItem("vm-tipset-active-profile");
      setCurrentProfile(null);
    }
  }

  if (!currentProfile) {
    return (
      <ProfileGate
        profiles={profiles}
        newPlayerName={newPlayerName}
        setNewPlayerName={setNewPlayerName}
        newPlayerPassword={newPlayerPassword}
        setNewPlayerPassword={setNewPlayerPassword}
        authProfile={authProfile}
        authPassword={authPassword}
        authError={authError}
        setAuthPassword={setAuthPassword}
        closeAuth={() => setAuthProfile(null)}
        selectProfile={requestProfileAccess}
        unlockProfile={unlockProfile}
        createPlayer={createPlayer}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-3 pb-20 pt-3 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-grid bg-[length:44px_44px] opacity-30" />
      <div className="absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-volt/20 blur-3xl" />

      <header className="mx-auto flex max-w-7xl flex-col gap-4 py-3 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-display text-[10px] uppercase tracking-[0.35em] text-volt sm:text-xs sm:tracking-[0.45em]">VM-Tipset 2026</p>
          <h1 className="mt-2 max-w-4xl font-display text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
            Privat tipsspel med livekänsla.
          </h1>
        </motion.div>
        <div className="glass flex w-full flex-wrap items-center gap-2 rounded-3xl p-2 sm:w-auto sm:gap-3">
          <div className="rounded-2xl bg-volt/15 p-2.5 text-volt sm:p-3">
            <ShieldCheck size={22} />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="text-sm text-white/60">{currentProfile.name}</p>
            <p className="font-display text-xl font-bold sm:text-2xl">{currentProfileScore} p</p>
            {currentProfile.role === "admin" ? (
              <p className="text-xs font-bold text-white/40">
                {storageMode === "supabase" ? "Databas aktiv" : "Lokal fallback"}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => {
              window.localStorage.removeItem("vm-tipset-active-profile");
              setCurrentProfile(null);
            }}
            className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            Byt
          </button>
          {currentProfile.role === "player" && (
            <button
              onClick={() => deleteProfile(currentProfile.id)}
              className="rounded-2xl bg-coral/15 px-3 py-2 text-sm font-bold text-coral transition hover:bg-coral/25"
            >
              Ta bort
            </button>
          )}
        </div>
      </header>

      <nav className="sticky top-2 z-20 mx-auto mb-5 flex max-w-7xl gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-pitch/85 p-2 backdrop-blur-2xl sm:top-3 sm:rounded-full">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={classNames(
              "whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition sm:py-2",
              activeTab === tab ? "bg-volt text-pitch shadow-glow" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.28 }}
          className="mx-auto max-w-7xl"
        >
          {activeTab === "Hem" && (
            <Dashboard
              next={next}
              topThree={topThree}
              dailyScoreData={dailyScoreData}
              matchDayPanel={matchDayPanel}
              phaseStatus={phaseStatus}
            />
          )}
          {activeTab === "Tippa" && (
            <PredictionsPanel
              predictions={predictions}
              lockedDates={lockedDates}
              openKnockoutStages={openKnockoutStages}
              phaseStatus={phaseStatus}
              bonusAnswers={bonusAnswers}
              onChange={updatePrediction}
              onWinnerChange={updatePredictionWinner}
              onBonusChange={updateBonusAnswer}
              onResetPredictions={resetCurrentPredictions}
            />
          )}
          {activeTab === "Grupper" && (
            <GroupsPanel
              selectedGroup={selectedGroup}
              setSelectedGroup={setSelectedGroup}
              results={results}
              thirdPlaced={thirdPlaced}
            />
          )}
          {activeTab === "Slutspel" && <KnockoutPanel sourceResults={results} lockedDates={lockedDates} resultWinners={resultWinners} />}
          {activeTab === "Admin" && (
            <AdminPanel
              results={results}
              resultWinners={resultWinners}
              updateResult={updateResult}
              updateResultWinner={updateResultWinner}
              profiles={profiles}
              newPlayerName={newPlayerName}
              setNewPlayerName={setNewPlayerName}
              createPlayer={createPlayer}
              deleteProfile={deleteProfile}
              newPlayerPassword={newPlayerPassword}
              setNewPlayerPassword={setNewPlayerPassword}
              openProfileAsAdmin={openProfileAsAdmin}
              resetProfilePassword={resetProfilePassword}
              randomizeDevData={randomizeDevData}
              resetDevData={resetDevData}
              lockedDates={lockedDates}
              toggleLockedDate={toggleLockedDate}
              officialBonusAnswers={officialBonusAnswers}
              updateOfficialBonusAnswer={updateOfficialBonusAnswer}
            />
          )}
          {activeTab === "Statistik" && <StatsPanel leaderboardRows={liveLeaderboard} />}
        </motion.section>
      </AnimatePresence>
    </main>
  );
}

function ProfileGate({
  profiles,
  newPlayerName,
  setNewPlayerName,
  newPlayerPassword,
  setNewPlayerPassword,
  authProfile,
  authPassword,
  authError,
  setAuthPassword,
  closeAuth,
  selectProfile,
  unlockProfile,
  createPlayer,
}: {
  profiles: PlayerProfile[];
  newPlayerName: string;
  setNewPlayerName: (value: string) => void;
  newPlayerPassword: string;
  setNewPlayerPassword: (value: string) => void;
  authProfile: PlayerProfile | null;
  authPassword: string;
  authError: string;
  setAuthPassword: (value: string) => void;
  closeAuth: () => void;
  selectProfile: (profile: PlayerProfile) => void;
  unlockProfile: () => void;
  createPlayer: () => void;
}) {
  const sortedProfiles = [...profiles].sort(
    (a, b) =>
      Number(b.role === "admin") - Number(a.role === "admin") ||
      a.name.localeCompare(b.name, "sv"),
  );

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 text-white">
      <div className="absolute inset-0 -z-10 bg-grid bg-[length:44px_44px] opacity-25" />
      <div className="absolute left-1/2 top-8 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan/20 blur-3xl" />
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="neon-border w-full max-w-4xl rounded-[2rem]"
      >
        <div className="glass rounded-[2rem] p-6 sm:p-8">
          <p className="font-display text-xs uppercase tracking-[0.45em] text-volt">VM-Tipset 2026</p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">Vem tippar?</h1>
          <p className="mt-3 max-w-2xl text-white/65">
            Ingen inloggning behövs. Välj ditt namn, eller skapa en ny spelare. Admin är bara ett lokalt läge för att mata in resultat.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sortedProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => selectProfile(profile)}
                className={classNames(
                  "rounded-3xl border p-5 text-left transition hover:-translate-y-1",
                  profile.role === "admin"
                    ? "border-coral/40 bg-coral/10 hover:border-coral"
                    : "border-white/10 bg-white/5 hover:border-volt/60 hover:bg-volt/10",
                )}
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 font-display text-lg font-black">
                  {profile.initials}
                </div>
                <p className="mt-5 font-display text-xl font-black">{profile.name}</p>
                <p className="mt-1 text-sm text-white/50">
                  {profile.role === "admin" ? "Resultat & export" : profile.passwordHash ? "Lösenord krävs" : "Sätt lösenord"}
                </p>
              </button>
            ))}
          </div>

          {authProfile && (
            <div className="mt-6 rounded-3xl border border-cyan/30 bg-cyan/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan">
                    {authProfile.passwordHash ? "Ange lösenord" : "Skapa lösenord"}
                  </p>
                  <h2 className="font-display text-2xl font-black">{authProfile.name}</h2>
                  <p className="mt-1 text-sm text-white/60">
                    {authProfile.passwordHash
                      ? "Skriv profilens lösenord för att öppna tipset."
                      : "Admin har nollställt lösenordet eller profilen saknar lösenord. Sätt ett nytt nu."}
                  </p>
                </div>
                <button onClick={closeAuth} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white/70">
                  Avbryt
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") unlockProfile();
                  }}
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-cyan"
                  placeholder="Lösenord"
                />
                <button
                  onClick={unlockProfile}
                  className="rounded-2xl bg-cyan px-5 py-3 font-display font-black text-pitch transition hover:brightness-110"
                >
                  Öppna profil
                </button>
              </div>
              {authError && <p className="mt-2 text-sm font-bold text-coral">{authError}</p>}
            </div>
          )}

          <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createPlayer();
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-volt"
              placeholder="Skapa ny spelare, t.ex. Emma"
            />
            <input
              type="password"
              value={newPlayerPassword}
              onChange={(event) => setNewPlayerPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createPlayer();
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-volt"
              placeholder="Lösenord"
            />
            <button
              onClick={createPlayer}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-volt px-5 py-3 font-display font-black text-pitch transition hover:brightness-110"
            >
              <UserPlus size={18} />
              Skapa spelare
            </button>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

function Dashboard({
  next,
  topThree,
  dailyScoreData,
  matchDayPanel,
  phaseStatus,
}: {
  next: Fixture;
  topThree: UserScore[];
  dailyScoreData: Array<{ date: string; points: number; dayPoints: number }>;
  matchDayPanel: { label: string; date: string; matches: Fixture[] };
  phaseStatus: ReturnType<typeof getPhaseStatus>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_.75fr] lg:gap-5">
        <section className="neon-border overflow-hidden rounded-[1.5rem] sm:rounded-[2rem]">
          <div className="glass relative p-5 sm:p-7">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan sm:text-sm sm:tracking-[0.35em]">Live leaderboard</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {topThree.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={classNames(
                    "rounded-[1.35rem] border p-4 sm:rounded-3xl sm:p-5",
                    index === 0 ? "border-volt/50 bg-volt/10 shadow-glow" : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 font-display font-black">
                      {user.avatar}
                    </div>
                    {index === 0 ? <Crown className="text-flare" /> : <Medal className="text-cyan" />}
                  </div>
                  <p className="mt-4 text-white/60">#{index + 1}</p>
                  <h2 className="font-display text-xl font-black sm:text-2xl">{user.name}</h2>
                  <p className="mt-2 text-3xl font-black text-volt sm:text-4xl">{user.points}</p>
                  <p className="flex items-center gap-1 text-sm text-white/60">
                    <ChevronUp size={16} className="text-volt" />
                    {user.exact} exakta resultat
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-volt">Poäng per dag</p>
                <p className="text-sm text-white/50">Poäng räknas först när admin har låst matchdagen.</p>
              </div>
              <p className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/65">
                {dailyScoreData[dailyScoreData.length - 1]?.points ?? 0} p totalt
              </p>
            </div>
            <div className="mt-4 h-44 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyScoreData}>
                  <defs>
                    <linearGradient id="score" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#7CFF6B" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#7CFF6B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,.55)" />
                  <YAxis stroke="rgba(255,255,255,.55)" />
                  <Tooltip contentStyle={{ background: "#06130f", border: "1px solid rgba(255,255,255,.12)" }} />
                  <Area name="Totalpoäng" type="monotone" dataKey="points" stroke="#7CFF6B" fill="url(#score)" strokeWidth={3} />
                  <Area name="Dagspoäng" type="monotone" dataKey="dayPoints" stroke="#55D6FF" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>


        <aside className="grid content-start gap-5">
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">Aktuell fas</p>
          <h2 className="mt-2 font-display text-xl font-black sm:text-2xl">{phaseStatus.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{phaseStatus.description}</p>
          <p className="mt-4 rounded-full bg-volt/10 px-4 py-2 text-sm font-bold text-volt">Öppet: {phaseStatus.openLabel}</p>
        </div>
        <Metric icon={<CalendarClock />} label="Nästa match" value={`${formatDate(next.date)} ${next.kickoffTime} · ${teamLabel(next.home)} - ${teamLabel(next.away)}`} />
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">{matchDayPanel.label}</p>
              <p className="mt-1 text-sm text-white/45">{formatDate(matchDayPanel.date)} · svensk tid</p>
            </div>
            <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">{matchDayPanel.matches.length}</p>
          </div>
          <div className="mt-4 space-y-3">
            {matchDayPanel.matches.map((match) => (
              <div key={match.id} className="grid grid-cols-[48px_1fr] gap-2 rounded-2xl bg-white/5 p-3 text-sm sm:grid-cols-[52px_1fr_auto_1fr] sm:items-center">
                <span className="font-display font-black text-volt">{match.kickoffTime}</span>
                <span className="font-bold">{teamLabel(match.home)}</span>
                <span className="hidden text-white/40 sm:block">vs</span>
                <span className="col-start-2 font-bold sm:col-auto sm:text-right">{teamLabel(match.away)}</span>
              </div>
            ))}
          </div>
        </div>
        </aside>
      </div>

      <RulesPanel />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass flex items-center gap-3 rounded-[1.5rem] p-4 sm:gap-4 sm:rounded-[2rem] sm:p-5">
      <div className="shrink-0 rounded-2xl bg-cyan/15 p-3 text-cyan">{icon}</div>
      <div>
        <p className="text-sm text-white/50">{label}</p>
        <p className="break-words font-display text-base font-bold sm:text-lg">{value}</p>
      </div>
    </div>
  );
}

function RulesPanel() {
  const matchRules: Array<[string, string | string[]]> = [
    ["Rätt tecken (1X2)", "3 poäng"],
    ["Exakt resultat", "+2 poäng"],
    ["Rätt målskillnad", "+1 poäng"],
    ["Rätt antal mål per lag", "+1 poäng per lag"],
    ["Max per gruppspelsmatch", "7 poäng"],
  ];
  const knockoutRules: Array<[string, string | string[]]> = [
    ["Rätt lag vidare", "5 poäng"],
    ["Rätt fulltidstecken", "3 poäng"],
    ["Exakt fulltidresultat", "+2 poäng"],
    ["Multiplikatorer", ["16-del x1", "8-del x1.2", "kvart x1.5", "semi x2", "final x3"]],
  ];
  const bonusRules: Array<[string, string | string[]]> = [
    ["Världsmästare", "20 poäng"],
    ["Finalist", "10 poäng per lag"],
    ["Skytteligavinnare", "15 poäng"],
    ["Flest mål i gruppspelet", "10 poäng"],
    ["Skrällag", "10 poäng"],
    ["Närmast totalt antal mål", "10 poäng"],
  ];
  const distribution = [
    ["Gruppspel", "Matchpoäng", "3 + 2 + 1 + 1 + 1", "Max 7"],
    ["Slutspel", "Matchpoäng", "5 + 3 + 2", "Multipliceras per runda"],
    ["Bonus", "Facitpoäng", "Sex bonuskategorier", "Räknas när admin fyllt facit"],
  ];

  const ruleSection = (title: string, rows: Array<[string, string | string[]]>) => (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <h3 className="font-display text-xl font-black text-volt">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-2xl bg-white/[0.04] px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:items-start sm:gap-4">
            <span className="text-white/75">{label}</span>
            {Array.isArray(value) ? (
              <span className="grid grid-cols-2 gap-2 sm:ml-auto sm:max-w-[260px]">
                {value.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-volt/15 bg-volt/10 px-3 py-1.5 text-center text-xs font-black text-volt"
                  >
                    {item}
                  </span>
                ))}
              </span>
            ) : (
              value && <span className="font-bold leading-relaxed text-white sm:text-right">{value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-flare sm:text-sm sm:tracking-[0.3em]">Regler</p>
          <h2 className="font-display text-2xl font-black sm:text-3xl">Så räknas poängen</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {ruleSection("Samtliga matcher", matchRules)}
        {ruleSection("Slutspel", knockoutRules)}
        {ruleSection("Bonus", bonusRules)}
      </div>
      <div className="mt-5 overflow-x-auto rounded-3xl border border-white/10 bg-black/20">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-white/10 text-white/55">
            <tr>
              {["Kategori", "Typ", "Regel", "Kommentar"].map((head) => (
                <th key={head} className="px-4 py-3">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distribution.map(([label, total, matches, bonus]) => (
              <tr key={label} className={classNames("border-t border-white/10", label === "Totalt" && "bg-volt/10 text-volt")}>
                <td className="px-4 py-3 font-bold">{label}</td>
                <td className="px-4 py-3 font-black">{total}</td>
                <td className="px-4 py-3">{matches}</td>
                <td className="px-4 py-3">{bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-white/60">Inga poäng delas ut förrän admin har matat in resultat och låst matchdagen.</p>
    </section>
  );
}

function PredictionsPanel({
  predictions,
  lockedDates,
  openKnockoutStages,
  phaseStatus,
  bonusAnswers,
  onChange,
  onWinnerChange,
  onBonusChange,
  onResetPredictions,
}: {
  predictions: Prediction[];
  lockedDates: string[];
  openKnockoutStages: MatchStage[];
  phaseStatus: ReturnType<typeof getPhaseStatus>;
  bonusAnswers: BonusPrediction;
  onChange: (match: Fixture, side: "home" | "away", value: number) => void;
  onWinnerChange: (match: Fixture, winner: string) => void;
  onBonusChange: (key: keyof BonusPrediction, value: string) => void;
  onResetPredictions: () => void;
}) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  const [tipMode, setTipMode] = useState<"menu" | "group" | "knockout">("menu");
  const predictedResults = useMemo(
    () =>
      predictions.reduce<Record<number, ScoreLine>>((resultMap, prediction) => {
        if (prediction.score) resultMap[prediction.matchId] = prediction.score;
        return resultMap;
      }, {}),
    [predictions],
  );
  const allGroupDatesLocked = fixtures
    .filter((match) => match.stage === "Gruppspel")
    .every((match) => lockedDates.includes(match.date));

  if (tipMode === "menu") {
    return (
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-volt sm:text-sm sm:tracking-[0.35em]">Mitt tips</p>
        <h2 className="mt-2 font-display text-3xl font-black sm:text-4xl">Vad vill du tippa?</h2>
        <p className="mt-3 max-w-2xl text-white/60">
          Börja med gruppspelet eller gå vidare till slutspelsträdet. Du kan växla tillbaka hit när som helst via Tippa.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-4">
          <button
            onClick={() => setTipMode("group")}
            className="neon-border rounded-[1.5rem] text-left transition hover:-translate-y-1 sm:rounded-[2rem]"
          >
            <div className="glass rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-6">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-volt/15 text-volt">
                <Users />
              </div>
              <p className="mt-6 text-sm uppercase tracking-[0.28em] text-volt">72 matcher</p>
              <h3 className="mt-2 font-display text-3xl font-black">Gruppspel</h3>
              <p className="mt-3 text-white/60">
                {stageIsLocked("Gruppspel", lockedDates)
                  ? "Gruppspelet är låst. Du kan fortfarande se dina tips."
                  : "Tippa alla grupper A-L och se tabellerna uppdateras direkt."}
              </p>
            </div>
          </button>

          <button
            onClick={() => setTipMode("knockout")}
            disabled={!stageIsLocked("Gruppspel", lockedDates)}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-left transition hover:-translate-y-1 hover:border-flare/50 hover:bg-flare/10 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:rounded-[2rem] sm:p-6"
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-flare/15 text-flare">
              <Trophy />
            </div>
            <p className="mt-6 text-sm uppercase tracking-[0.28em] text-flare">Slutspel</p>
            <h3 className="mt-2 font-display text-3xl font-black">Slutspelsträd</h3>
            <p className="mt-3 text-white/60">
              {stageIsLocked("Gruppspel", lockedDates)
                ? `Öppen fas: ${phaseStatus.openLabel}.`
                : "Låses upp när gruppspelet är färdigspelat och låst."}
            </p>
          </button>
        </div>
      </section>
    );
  }

  if (tipMode === "knockout") {
    return (
      <div className="space-y-5">
        <KnockoutPredictionPanel
          predictions={predictions}
          lockedDates={lockedDates}
          sourceResults={predictedResults}
          resolveTeams={allGroupDatesLocked}
          openKnockoutStages={openKnockoutStages}
          onBack={() => setTipMode("menu")}
          onChange={onChange}
          onWinnerChange={onWinnerChange}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="glass rounded-[1.5rem] p-3 sm:rounded-[2rem] sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-volt sm:text-sm sm:tracking-[0.35em]">Mitt tips</p>
            <h2 className="font-display text-2xl font-black sm:text-3xl">Gruppspel</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTipMode("menu")}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              Byt tipsdel
            </button>
          </div>
        </div>

        <div className="grid gap-5">
          {groupLetters.map((group) => {
            const groupMatches = fixtures.filter((match) => match.stage === "Gruppspel" && match.group === group);
            return (
              <section
                id={`tips-grupp-${group}`}
                key={group}
                className="scroll-mt-24 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 sm:scroll-mt-28 sm:rounded-[1.75rem]"
              >
                <div className="border-b border-white/10 bg-white/[0.06] p-3 sm:p-4">
                  <div>
                    <h3 className="font-display text-xl font-black sm:text-2xl">Grupp {group}</h3>
                  </div>
                </div>
                <div className="grid gap-2 p-2 sm:p-3">
                  {groupMatches.map((match) => {
                    const prediction = predictionMap.get(match.id);
                    const isLocked = lockedDates.includes(match.date);
                    return (
                      <div
                        key={match.id}
                        className={classNames(
                          "grid grid-cols-[34px_1fr] gap-2 rounded-2xl border border-white/10 bg-pitch/55 p-3 sm:grid-cols-[46px_1fr_auto_1fr] sm:gap-3 sm:rounded-3xl",
                          isLocked && "border-flare/25 bg-flare/5",
                        )}
                      >
                        <span className="pt-1 text-sm font-bold text-white/40">#{match.id}</span>
                        <div>
                          <p className="font-bold">{teamLabel(match.home)}</p>
                          <p className="text-xs text-white/40">
                            {formatDate(match.date)}
                            {isLocked ? " · Låst" : ""}
                          </p>
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-2 py-1 sm:col-span-1 sm:py-0">
                          <input
                            aria-label={`${match.home} mål`}
                            type="number"
                            min={0}
                            value={prediction?.score?.home ?? ""}
                            disabled={isLocked}
                            onChange={(event) => onChange(match, "home", Number(event.target.value))}
                            className="h-12 w-20 rounded-2xl border border-white/10 bg-white/10 text-center font-display text-lg font-black outline-none focus:border-volt disabled:cursor-not-allowed disabled:opacity-45 sm:w-16"
                          />
                          <span className="text-white/40">-</span>
                          <input
                            aria-label={`${match.away} mål`}
                            type="number"
                            min={0}
                            value={prediction?.score?.away ?? ""}
                            disabled={isLocked}
                            onChange={(event) => onChange(match, "away", Number(event.target.value))}
                            className="h-12 w-20 rounded-2xl border border-white/10 bg-white/10 text-center font-display text-lg font-black outline-none focus:border-volt disabled:cursor-not-allowed disabled:opacity-45 sm:w-16"
                          />
                        </div>
                        <div className="col-span-2 text-left sm:col-span-1 sm:text-right">
                          <p className="font-bold">{teamLabel(match.away)}</p>
                          <p className="text-xs text-white/40">Tecken: {prediction?.winner ?? "Ej tippat"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <LivePredictionTable group={group} results={predictedResults} />
              </section>
            );
          })}
        </div>
      </section>
      <aside className="space-y-5">
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6 xl:p-7">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan">Bonusfrågor</p>
          <div className="mt-5 space-y-4">
            {bonusFieldLabels.map((question) => (
              <label key={question.key} className="block">
                <span className="text-sm font-bold leading-relaxed text-white/60">
                  {question.label} · {question.points}
                </span>
                <input
                  type={question.type ?? "text"}
                  min={question.type === "number" ? 0 : undefined}
                  value={bonusAnswers[question.key] ?? ""}
                  onChange={(event) => onBonusChange(question.key, event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none focus:border-cyan"
                  placeholder="Ditt svar"
                />
              </label>
            ))}
          </div>
          <div className="mt-6 rounded-3xl border border-coral/20 bg-coral/10 p-4">
            <h3 className="font-display text-lg font-black text-white">Nollställ tips</h3>
            <p className="mt-1 text-sm text-white/60">Återställer alla olåsta matcher för din profil till 0-0.</p>
            <button
              onClick={onResetPredictions}
              className="mt-4 w-full rounded-2xl bg-coral px-4 py-3 font-display font-black text-white transition hover:brightness-110"
            >
              Nollställ mitt tips
            </button>
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Lock className="text-flare" />
          <h3 className="mt-3 font-display text-xl font-black">Låsning</h3>
          <p className="mt-2 text-sm text-white/60">I produktion låses varje tips automatiskt vid matchstart via Supabase policy eller cron-jobb.</p>
        </div>
      </aside>
    </div>
  );
}

function LivePredictionTable({ group, results }: { group: GroupLetter; results: Record<number, ScoreLine> }) {
  const standings = buildStandings(results, group);

  return (
    <div className="border-t border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-volt">Tabell</p>
        <p className="text-xs text-white/45">Uppdateras direkt från dina tips</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[500px] text-left text-xs sm:min-w-[560px] sm:text-sm">
          <thead className="bg-black/25 text-white/45">
            <tr>
              {["#", "Lag", "M", "V", "O", "F", "GM", "IM", "+/-", "P"].map((head) => (
                <th key={head} className="px-3 py-2">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((team, index) => (
              <tr key={team.team} className="border-t border-white/10">
                <td className="px-3 py-2 text-white/45">{index + 1}</td>
                <td className="px-3 py-2 font-bold">{teamLabel(team.team)}</td>
                <td className="px-3 py-2">{team.played}</td>
                <td className="px-3 py-2">{team.won}</td>
                <td className="px-3 py-2">{team.drawn}</td>
                <td className="px-3 py-2">{team.lost}</td>
                <td className="px-3 py-2">{team.goalsFor}</td>
                <td className="px-3 py-2">{team.goalsAgainst}</td>
                <td className={classNames("px-3 py-2", team.goalDifference > 0 && "text-volt", team.goalDifference < 0 && "text-coral")}>
                  {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                </td>
                <td className="px-3 py-2 font-black text-volt">{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupsPanel({
  selectedGroup,
  setSelectedGroup,
  results,
  thirdPlaced,
}: {
  selectedGroup: GroupLetter;
  setSelectedGroup: (group: GroupLetter) => void;
  results: Record<number, ScoreLine>;
  thirdPlaced: ReturnType<typeof rankThirdPlaced>;
}) {
  const standings = buildStandings(results, selectedGroup);

  return (
    <div className="grid gap-4 lg:grid-cols-[.65fr_.35fr] lg:gap-5">
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {(Object.keys(groups) as GroupLetter[]).map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={classNames(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold",
                selectedGroup === group ? "bg-cyan text-pitch" : "bg-white/10 text-white/65 hover:text-white",
              )}
            >
              Grupp {group}
            </button>
          ))}
        </div>
        <div className="mt-5 overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-xs sm:min-w-[620px] sm:text-sm">
            <thead className="bg-white/10 text-white/55">
              <tr>
                {["Lag", "M", "V", "O", "F", "GM", "IM", "+/-", "P"].map((head) => (
                  <th key={head} className="px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => (
                <tr key={team.team} className="border-t border-white/10">
                  <td className="px-4 py-4 font-bold">{index + 1}. {teamLabel(team.team)}</td>
                  <td className="px-4 py-4">{team.played}</td>
                  <td className="px-4 py-4">{team.won}</td>
                  <td className="px-4 py-4">{team.drawn}</td>
                  <td className="px-4 py-4">{team.lost}</td>
                  <td className="px-4 py-4">{team.goalsFor}</td>
                  <td className="px-4 py-4">{team.goalsAgainst}</td>
                  <td className="px-4 py-4">{team.goalDifference}</td>
                  <td className="px-4 py-4 font-black text-volt">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <p className="text-sm uppercase tracking-[0.3em] text-volt">Bästa treor</p>
        <div className="mt-4 space-y-3">
          {thirdPlaced.map(({ group, standing }, index) => (
            <div key={group} className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
              <span>{index + 1}. Grupp {group} · {teamLabel(standing.team)}</span>
              <span className="font-black text-volt">{standing.points}p</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function KnockoutPredictionPanel({
  predictions,
  lockedDates,
  sourceResults,
  resolveTeams,
  openKnockoutStages,
  onBack,
  onChange,
  onWinnerChange,
}: {
  predictions: Prediction[];
  lockedDates: string[];
  sourceResults: Record<number, ScoreLine>;
  resolveTeams: boolean;
  openKnockoutStages: MatchStage[];
  onBack: () => void;
  onChange: (match: Fixture, side: "home" | "away", value: number) => void;
  onWinnerChange: (match: Fixture, winner: string) => void;
}) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  const knockout = buildResolvedKnockoutFixtures({
    sourceResults,
    predictions,
    lockedDates,
    resolveGroupTeams: resolveTeams,
  });
  const completedCount = knockout.filter((match) => predictionMap.get(match.id)?.score).length;

  return (
    <section className="glass rounded-[1.5rem] p-3 sm:rounded-[2rem] sm:p-6">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-flare sm:text-sm sm:tracking-[0.35em]">Mitt tips</p>
          <h2 className="font-display text-2xl font-black sm:text-3xl">Slutspel</h2>
          <p className="mt-1 text-sm text-white/55">
            {resolveTeams
              ? `Öppen fas: ${openKnockoutStages.length > 0 ? openKnockoutStages.join(" & ") : "ingen"}`
              : "Sextondelsfinalerna låses upp när alla gruppspelsmatcher är låsta."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            Byt tipsdel
          </button>
          <p className="rounded-full bg-flare/10 px-4 py-2 text-sm text-flare">{completedCount}/32 matcher</p>
        </div>
      </div>

      <div className="grid gap-5">
        {stageOrder.map((stage) => {
          const stageMatches = knockout.filter((match) => match.stage === stage);

          return (
            <section key={stage} className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 sm:rounded-[1.75rem]">
              <div className="border-b border-white/10 bg-white/[0.06] p-3 sm:p-4">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-flare sm:text-sm sm:tracking-[0.3em]">{stage}</p>
              </div>
              <div className="grid gap-2 p-2 sm:p-3">
                {stageMatches.map((match) => {
                  const prediction = predictionMap.get(match.id);
                  const isLocked = lockedDates.includes(match.date);
                  const isOpenStage = openKnockoutStages.includes(match.stage);
                  const isEditable = resolveTeams && isOpenStage && !isLocked;
                  const isDraw = prediction?.score?.home === prediction?.score?.away;
                  const winner = getWinnerLabel(match, prediction?.score, prediction?.winner);
                  const statusLabel = isLocked ? "Låst" : isEditable ? "Öppen" : "Öppnar senare";

                  return (
                    <div
                      key={match.id}
                      className={classNames(
                        "grid grid-cols-[34px_1fr] gap-2 rounded-2xl border border-white/10 bg-pitch/55 p-3 sm:grid-cols-[46px_1fr_auto_1fr] sm:gap-3 sm:rounded-3xl",
                        isLocked && "border-flare/25 bg-flare/5",
                      )}
                    >
                      <span className="pt-1 text-sm font-bold text-white/40">#{match.id}</span>
                      <div>
                        <p className="font-bold">{teamLabel(match.resolvedHome)}</p>
                        <p className="text-xs text-white/40">
                          {formatDate(match.date)} {match.kickoffTime} · {statusLabel}
                        </p>
                        {match.resolvedHome !== match.home && <p className="text-xs text-white/30">{teamLabel(match.home)}</p>}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2 py-1 sm:col-span-1 sm:py-0">
                        <input
                          aria-label={`${match.resolvedHome} mål`}
                          type="number"
                          min={0}
                          value={prediction?.score?.home ?? ""}
                          disabled={!isEditable}
                          onChange={(event) => onChange(match, "home", Number(event.target.value))}
                          className="h-12 w-20 rounded-2xl border border-white/10 bg-white/10 text-center font-display text-lg font-black outline-none focus:border-flare disabled:cursor-not-allowed disabled:opacity-45 sm:w-16"
                        />
                        <span className="text-white/40">-</span>
                        <input
                          aria-label={`${match.resolvedAway} mål`}
                          type="number"
                          min={0}
                          value={prediction?.score?.away ?? ""}
                          disabled={!isEditable}
                          onChange={(event) => onChange(match, "away", Number(event.target.value))}
                          className="h-12 w-20 rounded-2xl border border-white/10 bg-white/10 text-center font-display text-lg font-black outline-none focus:border-flare disabled:cursor-not-allowed disabled:opacity-45 sm:w-16"
                        />
                      </div>
                      <div className="col-span-2 text-left sm:col-span-1 sm:text-right">
                        <p className="font-bold">{teamLabel(match.resolvedAway)}</p>
                        {match.resolvedAway !== match.away && <p className="text-xs text-white/30">{teamLabel(match.away)}</p>}
                        <p className="text-xs text-white/40">Vidare: {winner}</p>
                        {isDraw ? (
                          <select
                            value={
                              prediction?.winner && [match.resolvedHome, match.resolvedAway].includes(prediction.winner)
                                ? prediction.winner
                                : ""
                            }
                            disabled={!isEditable}
                            onChange={(event) => onWinnerChange(match, event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold outline-none focus:border-flare disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                          >
                            <option value="">Välj lag vidare</option>
                            <option value={match.resolvedHome}>{teamLabel(match.resolvedHome)}</option>
                            <option value={match.resolvedAway}>{teamLabel(match.resolvedAway)}</option>
                          </select>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function KnockoutPanel({
  sourceResults = {},
  lockedDates = [],
  resultWinners = {},
  title = "Officiellt slutspel",
  description,
}: {
  sourceResults?: Record<number, ScoreLine>;
  lockedDates?: string[];
  resultWinners?: Record<number, string>;
  title?: string;
  description?: string;
}) {
  const groupStageLocked = stageIsLocked("Gruppspel", lockedDates);
  const knockout = buildResolvedKnockoutFixtures({
    sourceResults,
    lockedDates,
    resolveGroupTeams: groupStageLocked,
    useSourceResultsForAdvancement: true,
    advancementWinners: resultWinners,
  });

  return (
    <section className="glass overflow-hidden rounded-[2rem] p-5">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Trophy className="mt-1 text-flare" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-flare">Slutspelsträd</p>
            <h2 className="font-display text-3xl font-black">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              {description ??
                (groupStageLocked
                  ? "Lagen visas utifrån adminresultat. Nästa runda fylls först när föregående runda är låst."
                  : "Slutspelsträdet låses upp när alla gruppspelsmatcher är låsta. Tills dess visas platshållare från schemat.")}
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-flare/20 bg-flare/10 px-4 py-3 text-sm font-bold text-flare">
          {groupStageLocked ? "Gruppspelet låst" : "Väntar på gruppspel"}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stageOrder.map((stage) => {
          const stageLocked = stageIsLocked(stage, lockedDates);
          const previousStage: Partial<Record<MatchStage, MatchStage>> = {
            Åttondelsfinal: "Sextondelsfinal",
            Kvartsfinal: "Åttondelsfinal",
            Semifinal: "Kvartsfinal",
            Bronsmatch: "Semifinal",
            Final: "Semifinal",
          };
          const previousLocked = stage === "Sextondelsfinal" ? groupStageLocked : stageIsLocked(previousStage[stage]!, lockedDates);
          const stageStatus = stageLocked ? "Klar" : previousLocked ? "Aktiv/kommande" : "Låst";

          return (
            <div key={stage} className="min-w-[280px] flex-1">
              <div className="sticky left-0 mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-black">{stage}</h3>
                <span
                  className={classNames(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    stageLocked
                      ? "bg-volt/15 text-volt"
                      : previousLocked
                        ? "bg-flare/15 text-flare"
                        : "bg-white/10 text-white/45",
                  )}
                >
                  {stageStatus}
                </span>
              </div>
              <div className="space-y-3">
                {knockout
                  .filter((match) => match.stage === stage)
                  .map((match) => {
                    const result = sourceResults[match.id];
                    const isLocked = lockedDates.includes(match.date);
                    const winner = result ? matchWinner(match.resolvedHome, match.resolvedAway, result, resultWinners[match.id]) : undefined;

                    return (
                      <article
                        key={match.id}
                        className={classNames(
                          "rounded-3xl border bg-black/25 p-4 text-left transition",
                          isLocked ? "border-volt/25 bg-volt/5" : "border-white/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-white/40">Match {match.id} · {formatDate(match.date)}</p>
                          <span className={classNames("rounded-full px-2 py-1 text-[11px] font-bold", isLocked ? "bg-volt/15 text-volt" : "bg-white/10 text-white/45")}>
                            {isLocked ? "Låst" : "Ej låst"}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <div className={classNames("rounded-2xl px-3 py-2", winner === match.resolvedHome ? "bg-volt/15 text-volt" : "bg-white/[0.04]")}>
                            <p className="font-bold">{teamLabel(match.resolvedHome)}</p>
                            {match.resolvedHome !== match.home && <p className="text-xs text-white/35">{teamLabel(match.home)}</p>}
                          </div>
                          <div className={classNames("rounded-2xl px-3 py-2", winner === match.resolvedAway ? "bg-volt/15 text-volt" : "bg-white/[0.04]")}>
                            <p className="font-bold">{teamLabel(match.resolvedAway)}</p>
                            {match.resolvedAway !== match.away && <p className="text-xs text-white/35">{teamLabel(match.away)}</p>}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2 text-sm">
                          <span className="text-white/45">Resultat</span>
                          <span className="font-display text-lg font-black text-white">
                            {result ? `${result.home} - ${result.away}` : "Ej spelad"}
                          </span>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
function AdminPanel({
  results,
  resultWinners,
  updateResult,
  updateResultWinner,
  profiles,
  newPlayerName,
  setNewPlayerName,
  newPlayerPassword,
  setNewPlayerPassword,
  createPlayer,
  deleteProfile,
  openProfileAsAdmin,
  resetProfilePassword,
  randomizeDevData,
  resetDevData,
  lockedDates,
  toggleLockedDate,
  officialBonusAnswers,
  updateOfficialBonusAnswer,
}: {
  results: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  updateResult: (matchId: number, side: "home" | "away", value: number) => void;
  updateResultWinner: (matchId: number, winner: string) => void;
  profiles: PlayerProfile[];
  newPlayerName: string;
  setNewPlayerName: (value: string) => void;
  newPlayerPassword: string;
  setNewPlayerPassword: (value: string) => void;
  createPlayer: () => void;
  deleteProfile: (profileId: string) => void;
  openProfileAsAdmin: (profile: PlayerProfile) => void;
  resetProfilePassword: (profileId: string) => void;
  randomizeDevData: () => void;
  resetDevData: () => void;
  lockedDates: string[];
  toggleLockedDate: (date: string) => void;
  officialBonusAnswers: BonusPrediction;
  updateOfficialBonusAnswer: (key: keyof BonusPrediction, value: string) => void;
}) {
  const [adminStage, setAdminStage] = useState<Fixture["stage"]>("Gruppspel");
  const resolvedAdminKnockout = buildResolvedKnockoutFixtures({
    sourceResults: results,
    lockedDates,
    resolveGroupTeams: stageIsLocked("Gruppspel", lockedDates),
    useSourceResultsForAdvancement: true,
    advancementWinners: resultWinners,
  });
  const adminFixtures =
    adminStage === "Gruppspel"
      ? fixtures.filter((match) => match.stage === adminStage)
      : resolvedAdminKnockout.filter((match) => match.stage === adminStage);
  const adminFixturesByDate = adminFixtures.reduce<Array<{ date: string; matches: Fixture[] }>>((days, match) => {
    const existingDay = days.find((day) => day.date === match.date);
    if (existingDay) {
      existingDay.matches.push(match);
      return days;
    }

    days.push({ date: match.date, matches: [match] });
    return days;
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-5">
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-coral sm:text-sm sm:tracking-[0.3em]">Adminpanel</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-2xl font-black sm:text-3xl">Mata in riktiga resultat</h2>
          <p className="mt-1 text-sm text-white/55">Resultat ger poäng först när matchdagen är låst.</p>
          <p className="rounded-full bg-coral/10 px-4 py-2 text-sm font-bold text-coral">
            {Object.keys(results).length}/104 resultat
          </p>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {adminStageOrder.map((stage) => (
            <button
              key={stage}
              onClick={() => setAdminStage(stage)}
              className={classNames(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition",
                adminStage === stage ? "bg-coral text-white" : "bg-white/10 text-white/60 hover:text-white",
              )}
            >
              {stage}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-5">
          {adminFixturesByDate.map((day) => (
            <section key={day.date} className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 sm:rounded-[1.75rem]">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-coral">Matchdag</p>
                  <h3 className="font-display text-xl font-black">{formatDate(day.date)}</h3>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">{day.matches.length} matcher</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-white/70">
                    <span>{lockedDates.includes(day.date) ? "Låst" : "Lås dag"}</span>
                    <input
                      type="checkbox"
                      checked={lockedDates.includes(day.date)}
                      onChange={() => toggleLockedDate(day.date)}
                      className="peer sr-only"
                    />
                    <span
                      className={classNames(
                        "relative h-6 w-11 rounded-full transition",
                        lockedDates.includes(day.date) ? "bg-coral" : "bg-white/20",
                      )}
                    >
                      <span
                        className={classNames(
                          "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition",
                          lockedDates.includes(day.date) && "translate-x-5",
                        )}
                      />
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid gap-2 p-3">
                {day.matches.map((match) => {
                  const resolvedMatch = match as Fixture & Partial<ResolvedKnockoutFixture>;
                  const home = resolvedMatch.resolvedHome ?? match.home;
                  const away = resolvedMatch.resolvedAway ?? match.away;
                  const result = results[match.id];
                  const selectedWinner =
                    resultWinners[match.id] && [home, away].includes(resultWinners[match.id])
                      ? resultWinners[match.id]
                      : matchWinner(home, away, result) ?? "";

                  return (
                  <div key={match.id} className="grid gap-3 rounded-2xl bg-white/5 p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:rounded-3xl">
                    <div>
                      <p className="font-bold">{teamLabel(home)} - {teamLabel(away)}</p>
                      <p className="text-sm text-white/45">
                        Match {match.id}
                        {match.group ? ` · Grupp ${match.group}` : ` · ${match.stage}`}
                      </p>
                      {match.stage !== "Gruppspel" && (home !== match.home || away !== match.away) ? (
                        <p className="text-xs text-white/35">
                          {teamLabel(match.home)} - {teamLabel(match.away)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <input type="number" min={0} value={results[match.id]?.home ?? 0} onChange={(event) => updateResult(match.id, "home", Number(event.target.value))} className="h-11 w-14 rounded-2xl bg-black/30 text-center font-black outline-none focus:ring-2 focus:ring-coral" />
                      <span>-</span>
                      <input type="number" min={0} value={results[match.id]?.away ?? 0} onChange={(event) => updateResult(match.id, "away", Number(event.target.value))} className="h-11 w-14 rounded-2xl bg-black/30 text-center font-black outline-none focus:ring-2 focus:ring-coral" />
                      {match.stage !== "Gruppspel" ? (
                        <select
                          value={selectedWinner}
                          onChange={(event) => updateResultWinner(match.id, event.target.value)}
                          className="h-11 min-w-0 flex-1 rounded-2xl bg-black/30 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-coral sm:max-w-[180px] sm:flex-none"
                          aria-label={`Vinnare match ${match.id}`}
                        >
                          <option value="">Välj vinnare</option>
                          <option value={home}>{teamLabel(home)}</option>
                          <option value={away}>{teamLabel(away)}</option>
                        </select>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
      <aside className="space-y-5">
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Trophy className="text-flare" />
          <h3 className="mt-3 font-display text-xl font-black">Bonusfacit</h3>
          <p className="mt-2 text-sm text-white/60">Fylls i när facit finns. Leaderboard räknar om direkt.</p>
          <div className="mt-5 space-y-3">
            {bonusFieldLabels.map((question) => (
              <label key={question.key} className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                  {question.label} · {question.points}
                </span>
                <input
                  type={question.type ?? "text"}
                  min={question.type === "number" ? 0 : undefined}
                  value={officialBonusAnswers[question.key] ?? ""}
                  onChange={(event) => updateOfficialBonusAnswer(question.key, event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-flare"
                  placeholder="Facit"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Users className="text-volt" />
          <h3 className="mt-3 font-display text-xl font-black">Hantera spelare</h3>
          <p className="mt-2 text-sm text-white/60">Lägg till spelare, öppna profiler eller nollställ lösenord.</p>

          <div className="mt-5 grid gap-2 rounded-3xl border border-white/10 bg-black/20 p-2">
            <input
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createPlayer();
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-volt"
              placeholder="Ny spelare"
            />
            <input
              type="password"
              value={newPlayerPassword}
              onChange={(event) => setNewPlayerPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createPlayer();
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-volt"
              placeholder="Lösenord"
            />
            <button
              onClick={createPlayer}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-volt px-4 py-3 font-display font-black text-pitch transition hover:brightness-110"
            >
              <UserPlus size={18} />
              Lägg till spelare
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 font-display text-sm font-black">
                    {profile.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{profile.name}</p>
                    <p className="text-xs text-white/45">{profile.role === "admin" ? "Admin" : "Spelare"}</p>
                  </div>
                </div>
                {profile.role === "player" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openProfileAsAdmin(profile)}
                      className="rounded-xl bg-cyan/15 px-3 py-2 text-xs font-bold text-cyan transition hover:bg-cyan/25"
                    >
                      Öppna
                    </button>
                    <button
                      onClick={() => resetProfilePassword(profile.id)}
                      className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/15"
                    >
                      Nollställ
                    </button>
                    <button
                      onClick={() => deleteProfile(profile.id)}
                      className="rounded-xl bg-coral/15 p-2 text-coral transition hover:bg-coral/25"
                      aria-label={`Ta bort ${profile.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/45">Skyddad</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Download className="text-cyan" />
          <h3 className="mt-3 font-display text-xl font-black">Export</h3>
          <p className="mt-2 text-sm text-white/60">Exportera predictions, resultat och poäng som CSV från Supabase i nästa backend-steg.</p>
        </div>
        <div className="glass rounded-[1.5rem] border-coral/20 p-4 sm:rounded-[2rem] sm:p-6">
          <Sparkles className="text-coral" />
          <h3 className="mt-3 font-display text-xl font-black">Utvecklarverktyg</h3>
          <p className="mt-2 text-sm text-white/60">Endast för test: fyller tips/resultat och låsningar eller nollställer allt.</p>
          <div className="mt-4 grid gap-2">
            <button
              onClick={randomizeDevData}
              className="rounded-2xl bg-coral px-4 py-3 font-display font-black text-white transition hover:brightness-110"
            >
              Slumpa allt och lås
            </button>
            <button
              onClick={resetDevData}
              className="rounded-2xl bg-white/10 px-4 py-3 font-display font-black text-white/70 transition hover:bg-white/15"
            >
              Nolla devdata
            </button>
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Sparkles className="text-volt" />
          <h3 className="mt-3 font-display text-xl font-black">Automatik</h3>
          <p className="mt-2 text-sm text-white/60">Adminändringar räknar om leaderboard direkt via scoringfunktionen.</p>
        </div>
      </aside>
    </div>
  );
}

function StatsPanel({ leaderboardRows }: { leaderboardRows: UserScore[] }) {
  const [expandedChart, setExpandedChart] = useState(false);
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<string[]>(() => leaderboardRows.map((user) => user.id));
  const boards: Array<{ title: string; key: keyof Pick<UserScore, "points" | "groupPoints" | "knockoutPoints" | "bonusPoints" | "latestChange">; suffix?: string }> = [
    { title: "Totalpoäng", key: "points" },
    { title: "Gruppspel", key: "groupPoints" },
    { title: "Slutspel", key: "knockoutPoints" },
    { title: "Bonus", key: "bonusPoints" },
    { title: "Senaste poängförändring", key: "latestChange", suffix: " senast" },
  ];
  const lineColors = ["#7CFF6B", "#55D6FF", "#FF5C8A", "#FFB84D", "#B58CFF", "#36F1CD", "#F7F052"];
  const maxHistoryLength = Math.max(...leaderboardRows.map((user) => user.history.length), 1);
  const scoreHistoryData = Array.from({ length: maxHistoryLength }, (_, index) => {
    const row: Record<string, string | number> = { day: index === 0 ? "Start" : `Dag ${index}` };
    leaderboardRows.forEach((user) => {
      row[user.name] = user.history[index] ?? user.history[user.history.length - 1] ?? 0;
    });
    return row;
  });
  const visibleRows = leaderboardRows.filter((user) => visiblePlayerIds.includes(user.id));

  function toggleVisiblePlayer(playerId: string) {
    setVisiblePlayerIds((current) => {
      if (current.includes(playerId) && current.length === 1) return current;
      return current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];
    });
  }

  const scoreChart = (rows: UserScore[], heightClass: string) => (
    <div className={heightClass}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scoreHistoryData}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="day" stroke="rgba(255,255,255,.55)" />
          <YAxis stroke="rgba(255,255,255,.55)" />
          <Tooltip contentStyle={{ background: "#06130f", border: "1px solid rgba(255,255,255,.12)" }} />
          {rows.map((user) => {
            const colorIndex = leaderboardRows.findIndex((row) => row.id === user.id);
            return (
              <Line
                key={user.id}
                type="monotone"
                dataKey={user.name}
                stroke={lineColors[Math.max(colorIndex, 0) % lineColors.length]}
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5 lg:col-span-2">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
          <BarChart3 className="text-cyan" />
            <h2 className="font-display text-xl font-black sm:text-2xl">Poängutveckling per spelare</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-white/50">X-axel: dagar · Y-axel: totalpoäng</p>
            <button
              onClick={() => setExpandedChart(true)}
              className="inline-flex items-center gap-2 rounded-full bg-cyan/15 px-4 py-2 text-sm font-bold text-cyan transition hover:bg-cyan/25"
            >
              <Expand size={16} />
              Förstora
            </button>
          </div>
        </div>
        {scoreChart(leaderboardRows, "h-64 sm:h-80")}
      </section>
      <AnimatePresence>
        {expandedChart ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-md sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="glass max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-7"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan">Förstorad graf</p>
                  <h2 className="font-display text-2xl font-black sm:text-3xl">Poängutveckling per spelare</h2>
                </div>
                <button
                  onClick={() => setExpandedChart(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  <X size={16} />
                  Stäng
                </button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {leaderboardRows.map((user, index) => {
                  const isVisible = visiblePlayerIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleVisiblePlayer(user.id)}
                      className={classNames(
                        "rounded-full border px-4 py-2 text-sm font-bold transition",
                        isVisible ? "bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/35",
                      )}
                      style={isVisible ? { borderColor: lineColors[index % lineColors.length] } : undefined}
                    >
                      {user.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5">
                {scoreChart(visibleRows, "h-[55vh] min-h-[300px] sm:min-h-[360px]")}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {boards.map((board) => {
        const rows = [...leaderboardRows].sort(
          (a, b) => Number(b[board.key]) - Number(a[board.key]) || b.exact - a.exact || a.name.localeCompare(b.name, "sv"),
        );

        return (
          <section key={board.title} className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">{board.title}</p>
            <div className="mt-4 space-y-3">
              {rows.map((user, index) => {
                const value = Number(user[board.key]);
                const formattedValue = board.key === "latestChange" && value > 0 ? `+${value}` : `${value}`;

                return (
                  <div key={user.id} className="grid grid-cols-[40px_1fr] gap-3 rounded-2xl bg-white/5 p-3 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:rounded-3xl sm:p-4">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 font-bold">{index + 1}</div>
                    <div>
                      <p className="font-bold">{user.name}</p>
                      <p className="text-sm text-white/50">
                        {user.groupPoints} grupp · {user.knockoutPoints} slutspel · {user.bonusPoints} bonus
                      </p>
                    </div>
                    <p className="col-span-2 font-display text-2xl font-black text-volt sm:col-auto">
                      {formattedValue}
                      {board.suffix ? <span className="ml-1 text-xs text-white/40">{board.suffix}</span> : null}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
