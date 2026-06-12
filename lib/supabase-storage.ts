import { createClient } from "@supabase/supabase-js";
import type { BonusPrediction, PlayerProfile, Prediction, ScoreLine } from "./types";

function normalizeSupabaseUrl(url?: string) {
  return url?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseEnabled ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

const toJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const retryablePostgresCodes = new Set(["40P01", "40001"]);
const writeQueues = new Map<string, Promise<unknown>>();
const supabasePageSize = 1000;

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined;
}

async function withRetryOnWriteConflict<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code = getErrorCode(error);
      if (!code || !retryablePostgresCodes.has(code) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function enqueueWrite<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key)?.catch(() => undefined) ?? Promise.resolve();
  const next = previous.then(operation);
  writeQueues.set(key, next);

  try {
    return await next;
  } finally {
    if (writeQueues.get(key) === next) writeQueues.delete(key);
  }
}

export function describeSupabaseError(error: unknown) {
  if (!error) return "Okänt fel";
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return JSON.stringify({
      message: record.message,
      details: record.details,
      hint: record.hint,
      code: record.code,
      status: record.status,
      statusText: record.statusText,
    });
  }
  return String(error);
}

type ProfileRow = {
  id: string;
  name: string;
  initials: string;
  role: "admin" | "player";
  password_hash: string | null;
};

type PredictionRow = {
  profile_id: string;
  match_id: number;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
};

type ResultRow = {
  match_id: number;
  home_score: number;
  away_score: number;
  winner: string | null;
};

const toProfile = (row: ProfileRow): PlayerProfile => ({
  id: row.id,
  name: row.name,
  initials: row.initials,
  role: row.role,
  passwordHash: row.password_hash ?? undefined,
});

const toProfileRow = (profile: PlayerProfile): ProfileRow => ({
  id: profile.id,
  name: profile.name,
  initials: profile.initials,
  role: profile.role,
  password_hash: profile.passwordHash ?? null,
});

export async function loadProfilesFromDb() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("vm_profiles").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ProfileRow[]).map(toProfile);
}

export async function saveProfilesToDb(profiles: PlayerProfile[]) {
  if (!supabase) return;
  await enqueueWrite(
    `profiles:${profiles.map((profile) => profile.id).sort().join(",")}`,
    () =>
      withRetryOnWriteConflict(async () => {
        const { error } = await supabase.from("vm_profiles").upsert(profiles.map(toProfileRow), { onConflict: "id" });
        if (error) throw error;
      }),
  );
}

export async function deleteProfileFromDb(profileId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("vm_profiles").delete().eq("id", profileId);
  if (error) throw error;
}

export async function loadPredictionsFromDb(profileId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("vm_predictions").select("*").eq("profile_id", profileId);
  if (error) throw error;
  return (data as PredictionRow[]).map((row) => ({
    matchId: row.match_id,
    score:
      row.home_score === null || row.away_score === null
        ? undefined
        : { home: row.home_score, away: row.away_score },
    winner: row.winner ?? undefined,
  }));
}

export async function loadAllPredictionsFromDb() {
  if (!supabase) return {};
  const rows: PredictionRow[] = [];

  for (let from = 0; ; from += supabasePageSize) {
    const { data, error } = await supabase
      .from("vm_predictions")
      .select("*")
      .order("profile_id", { ascending: true })
      .order("match_id", { ascending: true })
      .range(from, from + supabasePageSize - 1);
    if (error) throw error;

    const page = (data ?? []) as PredictionRow[];
    rows.push(...page);
    if (page.length < supabasePageSize) break;
  }

  return rows.reduce<Record<string, Prediction[]>>((map, row) => {
    map[row.profile_id] ??= [];
    map[row.profile_id].push({
      matchId: row.match_id,
      score:
        row.home_score === null || row.away_score === null
          ? undefined
          : { home: row.home_score, away: row.away_score },
      winner: row.winner ?? undefined,
    });
    return map;
  }, {});
}

export async function savePredictionsToDb(profileId: string, predictions: Prediction[]) {
  if (!supabase) return;
  const rows = predictions
    .filter((prediction) => prediction.score)
    .map((prediction) => ({
      profile_id: profileId,
      match_id: prediction.matchId,
      home_score: prediction.score!.home,
      away_score: prediction.score!.away,
      winner: prediction.winner ?? null,
    }));
  if (rows.length === 0) return;
  await enqueueWrite(`predictions:${profileId}`, () =>
    withRetryOnWriteConflict(async () => {
      const { error } = await supabase.from("vm_predictions").upsert(rows, { onConflict: "profile_id,match_id" });
      if (error) throw error;
    }),
  );
}

export async function loadAllBonusFromDb() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("vm_bonus_predictions").select("profile_id, answers");
  if (error) throw error;
  return (data as Array<{ profile_id: string; answers: BonusPrediction | null }>).reduce<Record<string, BonusPrediction>>(
    (map, row) => {
      map[row.profile_id] = row.answers ?? {};
      return map;
    },
    {},
  );
}

export async function saveBonusToDb(profileId: string, answers: BonusPrediction) {
  if (!supabase) return;
  await enqueueWrite(`bonus:${profileId}`, () =>
    withRetryOnWriteConflict(async () => {
      const { error } = await supabase
        .from("vm_bonus_predictions")
        .upsert({ profile_id: profileId, answers: toJson(answers) }, { onConflict: "profile_id" });
      if (error) throw error;
    }),
  );
}

export async function loadResultsFromDb() {
  if (!supabase) return { results: {}, resultWinners: {} };
  const { data, error } = await supabase.from("vm_match_results").select("*");
  if (error) throw error;
  return (data as ResultRow[]).reduce<{ results: Record<number, ScoreLine>; resultWinners: Record<number, string> }>(
    (map, row) => {
      map.results[row.match_id] = { home: row.home_score, away: row.away_score };
      if (row.winner) map.resultWinners[row.match_id] = row.winner;
      return map;
    },
    { results: {}, resultWinners: {} },
  );
}

export async function saveResultsToDb(
  results: Record<number, ScoreLine>,
  resultWinners: Record<number, string>,
  options: { allowDeleteAll?: boolean } = {},
) {
  if (!supabase) return;
  const rows = Object.entries(results).map(([matchId, score]) => ({
    match_id: Number(matchId),
    home_score: score.home,
    away_score: score.away,
    winner: resultWinners[Number(matchId)] ?? null,
  }));
  await enqueueWrite("match-results", () =>
    withRetryOnWriteConflict(async () => {
      if (rows.length === 0) {
        if (!options.allowDeleteAll) return;
        const { error } = await supabase.from("vm_match_results").delete().neq("match_id", -1);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("vm_match_results").upsert(rows, { onConflict: "match_id" });
      if (error) throw error;
    }),
  );
}

export async function loadAppStateFromDb<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  const { data, error } = await supabase.from("vm_app_state").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T | undefined) ?? fallback;
}

export async function saveAppStateToDb<T>(key: string, value: T) {
  if (!supabase) return;
  await enqueueWrite(`app-state:${key}`, () =>
    withRetryOnWriteConflict(async () => {
      const { error } = await supabase.from("vm_app_state").upsert({ key, value: toJson(value) }, { onConflict: "key" });
      if (error) throw error;
    }),
  );
}
