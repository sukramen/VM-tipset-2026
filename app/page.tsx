"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarClock,
  ChevronUp,
  Expand,
  X,
  Crown,
  Lock,
  Medal,
  Trash2,
  ShieldCheck,
  Sparkles,
  Settings,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildStandings, rankThirdPlaced, scoreBonusPrediction, scorePrediction } from "@/lib/scoring";
import { getFixtureKickoff, getStartedMatchIds, type MatchSyncPayload } from "@/lib/match-sync";
import {
  deleteProfileFromDb,
  describeSupabaseError,
  isSupabaseEnabled,
  loadAllBonusFromDb,
  loadAllPredictionsFromDb,
  loadAppStateFromDb,
  loadPredictionsFromDb,
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

const tabs = ["Hem", "Tippa", "Grupper", "Slutspel", "Andras tips", "Admin", "Statistik"] as const;
type Tab = (typeof tabs)[number];

const stageOrder: MatchStage[] = ["Sextondelsfinal", "Åttondelsfinal", "Kvartsfinal", "Semifinal", "Bronsmatch", "Final"];
const adminStageOrder: MatchStage[] = ["Gruppspel", ...stageOrder];
const groupLetters = Object.keys(groups) as GroupLetter[];
const fixtureDates = Array.from(new Set(fixtures.map((fixture) => fixture.date))).sort();
const predictionsVersion = "5";
const bonusVersion = "4";
const requireAdminPassword = true;
const matchDaySyncIntervalMs = 15 * 60_000;
const liveMatchSyncIntervalMs = 3 * 60_000;
const liveMatchWindowMs = 3 * 60 * 60_000;
const starterProfiles: PlayerProfile[] = [
  { id: "admin", name: "Admin", initials: "AD", role: "admin", passwordHash: hashPassword("markus123") },
  { id: "markus", name: "Markus", initials: "MV", role: "player" },
  { id: "filip", name: "Filip", initials: "FI", role: "player" },
];

const defaultPredictions: Prediction[] = fixtures.map((match) => ({
  matchId: match.id,
  winner: match.stage === "Gruppspel" ? "Ej tippat" : "Ej valt",
}));

const defaultBonusAnswers: BonusPrediction = {};

type BonusFieldLabel = {
  key: keyof BonusPrediction;
  label: string;
  points: string;
  type?: "number";
  placeholder?: string;
  playerInput?: "select";
  options?: string[];
};

const darkhorseExcludedTeams = new Set([
  "England",
  "Frankrike",
  "Kroatien",
  "Norge",
  "Portugal",
  "Tyskland",
  "Nederländerna",
  "Spanien",
  "Belgien",
  "Turkiet",
  "Marocko",
  "Senegal",
  "Argentina",
  "Brasilien",
  "Schweiz",
]);

const darkhorseTeamOptions = Object.values(groups)
  .flat()
  .filter((team) => !darkhorseExcludedTeams.has(team))
  .sort((a, b) => a.localeCompare(b, "sv"));

const thirdPlaceSlotOrder = ["CEFHI", "EFGIJ", "BEFIJ", "ABCDF", "AEHIJ", "CDFGH", "DEIJL", "EHIJK"] as const;
const thirdPlaceAssignmentTable = new Map(
  "EFGHIJKL:EJIFHGLK,DFGHIJKL:HGIDJFLK,DEGHIJKL:EJIDHGLK,DEFHIJKL:EJIDHFLK,DEFGIJKL:EGIDJFLK,DEFGHJKL:EGJDHFLK,DEFGHIKL:EGIDHFLK,DEFGHIJL:EGJDHFLI,DEFGHIJK:EGJDHFIK,CFGHIJKL:HGICJFLK,CEGHIJKL:EJICHGLK,CEFHIJKL:EJICHFLK,CEFGIJKL:EGICJFLK,CEFGHJKL:EGJCHFLK,CEFGHIKL:EGICHFLK,CEFGHIJL:EGJCHFLI,CEFGHIJK:EGJCHFIK,CDGHIJKL:HGICJDLK,CDFHIJKL:CJIDHFLK,CDFGIJKL:CGIDJFLK,CDFGHJKL:CGJDHFLK,CDFGHIKL:CGIDHFLK,CDFGHIJL:CGJDHFLI,CDFGHIJK:CGJDHFIK,CDEHIJKL:EJICHDLK,CDEGIJKL:EGICJDLK,CDEGHJKL:EGJCHDLK,CDEGHIKL:EGICHDLK,CDEGHIJL:EGJCHDLI,CDEGHIJK:EGJCHDIK,CDEFIJKL:CJEDIFLK,CDEFHJKL:CJEDHFLK,CDEFHIKL:CEIDHFLK,CDEFHIJL:CJEDHFLI,CDEFHIJK:CJEDHFIK,CDEFGJKL:CGEDJFLK,CDEFGIKL:CGEDIFLK,CDEFGIJL:CGEDJFLI,CDEFGIJK:CGEDJFIK,CDEFGHKL:CGEDHFLK,CDEFGHJL:CGJDHFLE,CDEFGHJK:CGJDHFEK,CDEFGHIL:CGEDHFLI,CDEFGHIK:CGEDHFIK,CDEFGHIJ:CGJDHFEI,BFGHIJKL:HJBFIGLK,BEGHIJKL:EJIBHGLK,BEFHIJKL:EJBFIHLK,BEFGIJKL:EJBFIGLK,BEFGHJKL:EJBFHGLK,BEFGHIKL:EGBFIHLK,BEFGHIJL:EJBFHGLI,BEFGHIJK:EJBFHGIK,BDGHIJKL:HJBDIGLK,BDFHIJKL:HJBDIFLK,BDFGIJKL:IGBDJFLK,BDFGHJKL:HGBDJFLK,BDFGHIKL:HGBDIFLK,BDFGHIJL:HGBDJFLI,BDFGHIJK:HGBDJFIK,BDEHIJKL:EJBDIHLK,BDEGIJKL:EJBDIGLK,BDEGHJKL:EJBDHGLK,BDEGHIKL:EGBDIHLK,BDEGHIJL:EJBDHGLI,BDEGHIJK:EJBDHGIK,BDEFIJKL:EJBDIFLK,BDEFHJKL:EJBDHFLK,BDEFHIKL:EIBDHFLK,BDEFHIJL:EJBDHFLI,BDEFHIJK:EJBDHFIK,BDEFGJKL:EGBDJFLK,BDEFGIKL:EGBDIFLK,BDEFGIJL:EGBDJFLI,BDEFGIJK:EGBDJFIK,BDEFGHKL:EGBDHFLK,BDEFGHJL:HGBDJFLE,BDEFGHJK:HGBDJFEK,BDEFGHIL:EGBDHFLI,BDEFGHIK:EGBDHFIK,BDEFGHIJ:HGBDJFEI,BCGHIJKL:HJBCIGLK,BCFHIJKL:HJBCIFLK,BCFGIJKL:IGBCJFLK,BCFGHJKL:HGBCJFLK,BCFGHIKL:HGBCIFLK,BCFGHIJL:HGBCJFLI,BCFGHIJK:HGBCJFIK,BCEHIJKL:EJBCIHLK,BCEGIJKL:EJBCIGLK,BCEGHJKL:EJBCHGLK,BCEGHIKL:EGBCIHLK,BCEGHIJL:EJBCHGLI,BCEGHIJK:EJBCHGIK,BCEFIJKL:EJBCIFLK,BCEFHJKL:EJBCHFLK,BCEFHIKL:EIBCHFLK,BCEFHIJL:EJBCHFLI,BCEFHIJK:EJBCHFIK,BCEFGJKL:EGBCJFLK,BCEFGIKL:EGBCIFLK,BCEFGIJL:EGBCJFLI,BCEFGIJK:EGBCJFIK,BCEFGHKL:EGBCHFLK,BCEFGHJL:HGBCJFLE,BCEFGHJK:HGBCJFEK,BCEFGHIL:EGBCHFLI,BCEFGHIK:EGBCHFIK,BCEFGHIJ:HGBCJFEI,BCDHIJKL:HJBCIDLK,BCDGIJKL:IGBCJDLK,BCDGHJKL:HGBCJDLK,BCDGHIKL:HGBCIDLK,BCDGHIJL:HGBCJDLI,BCDGHIJK:HGBCJDIK,BCDFIJKL:CJBDIFLK,BCDFHJKL:CJBDHFLK,BCDFHIKL:CIBDHFLK,BCDFHIJL:CJBDHFLI,BCDFHIJK:CJBDHFIK,BCDFGJKL:CGBDJFLK,BCDFGIKL:CGBDIFLK,BCDFGIJL:CGBDJFLI,BCDFGIJK:CGBDJFIK,BCDFGHKL:CGBDHFLK,BCDFGHJL:CGBDHFLJ,BCDFGHJK:HGBCJFDK,BCDFGHIL:CGBDHFLI,BCDFGHIK:CGBDHFIK,BCDFGHIJ:HGBCJFDI,BCDEIJKL:EJBCIDLK,BCDEHJKL:EJBCHDLK,BCDEHIKL:EIBCHDLK,BCDEHIJL:EJBCHDLI,BCDEHIJK:EJBCHDIK,BCDEGJKL:EGBCJDLK,BCDEGIKL:EGBCIDLK,BCDEGIJL:EGBCJDLI,BCDEGIJK:EGBCJDIK,BCDEGHKL:EGBCHDLK,BCDEGHJL:HGBCJDLE,BCDEGHJK:HGBCJDEK,BCDEGHIL:EGBCHDLI,BCDEGHIK:EGBCHDIK,BCDEGHIJ:HGBCJDEI,BCDEFJKL:CJBDEFLK,BCDEFIKL:CEBDIFLK,BCDEFIJL:CJBDEFLI,BCDEFIJK:CJBDEFIK,BCDEFHKL:CEBDHFLK,BCDEFHJL:CJBDHFLE,BCDEFHJK:CJBDHFEK,BCDEFHIL:CEBDHFLI,BCDEFHIK:CEBDHFIK,BCDEFHIJ:CJBDHFEI,BCDEFGKL:CGBDEFLK,BCDEFGJL:CGBDJFLE,BCDEFGJK:CGBDJFEK,BCDEFGIL:CGBDEFLI,BCDEFGIK:CGBDEFIK,BCDEFGIJ:CGBDJFEI,BCDEFGHL:CGBDHFLE,BCDEFGHK:CGBDHFEK,BCDEFGHJ:HGBCJFDE,BCDEFGHI:CGBDHFEI,AFGHIJKL:HJIFAGLK,AEGHIJKL:EJIAHGLK,AEFHIJKL:EJIFAHLK,AEFGIJKL:EJIFAGLK,AEFGHJKL:EGJFAHLK,AEFGHIKL:EGIFAHLK,AEFGHIJL:EGJFAHLI,AEFGHIJK:EGJFAHIK,ADGHIJKL:HJIDAGLK,ADFHIJKL:HJIDAFLK,ADFGIJKL:IGJDAFLK,ADFGHJKL:HGJDAFLK,ADFGHIKL:HGIDAFLK,ADFGHIJL:HGJDAFLI,ADFGHIJK:HGJDAFIK,ADEHIJKL:EJIDAHLK,ADEGIJKL:EJIDAGLK,ADEGHJKL:EGJDAHLK,ADEGHIKL:EGIDAHLK,ADEGHIJL:EGJDAHLI,ADEGHIJK:EGJDAHIK,ADEFIJKL:EJIDAFLK,ADEFHJKL:HJEDAFLK,ADEFHIKL:HEIDAFLK,ADEFHIJL:HJEDAFLI,ADEFHIJK:HJEDAFIK,ADEFGJKL:EGJDAFLK,ADEFGIKL:EGIDAFLK,ADEFGIJL:EGJDAFLI,ADEFGIJK:EGJDAFIK,ADEFGHKL:HGEDAFLK,ADEFGHJL:HGJDAFLE,ADEFGHJK:HGJDAFEK,ADEFGHIL:HGEDAFLI,ADEFGHIK:HGEDAFIK,ADEFGHIJ:HGJDAFEI,ACGHIJKL:HJICAGLK,ACFHIJKL:HJICAFLK,ACFGIJKL:IGJCAFLK,ACFGHJKL:HGJCAFLK,ACFGHIKL:HGICAFLK,ACFGHIJL:HGJCAFLI,ACFGHIJK:HGJCAFIK,ACEHIJKL:EJICAHLK,ACEGIJKL:EJICAGLK,ACEGHJKL:EGJCAHLK,ACEGHIKL:EGICAHLK,ACEGHIJL:EGJCAHLI,ACEGHIJK:EGJCAHIK,ACEFIJKL:EJICAFLK,ACEFHJKL:HJECAFLK,ACEFHIKL:HEICAFLK,ACEFHIJL:HJECAFLI,ACEFHIJK:HJECAFIK,ACEFGJKL:EGJCAFLK,ACEFGIKL:EGICAFLK,ACEFGIJL:EGJCAFLI,ACEFGIJK:EGJCAFIK,ACEFGHKL:HGECAFLK,ACEFGHJL:HGJCAFLE,ACEFGHJK:HGJCAFEK,ACEFGHIL:HGECAFLI,ACEFGHIK:HGECAFIK,ACEFGHIJ:HGJCAFEI,ACDHIJKL:HJICADLK,ACDGIJKL:IGJCADLK,ACDGHJKL:HGJCADLK,ACDGHIKL:HGICADLK,ACDGHIJL:HGJCADLI,ACDGHIJK:HGJCADIK,ACDFIJKL:CJIDAFLK,ACDFHJKL:HJFCADLK,ACDFHIKL:HFICADLK,ACDFHIJL:HJFCADLI,ACDFHIJK:HJFCADIK,ACDFGJKL:CGJDAFLK,ACDFGIKL:CGIDAFLK,ACDFGIJL:CGJDAFLI,ACDFGIJK:CGJDAFIK,ACDFGHKL:HGFCADLK,ACDFGHJL:CGJDAFLH,ACDFGHJK:HGJCAFDK,ACDFGHIL:HGFCADLI,ACDFGHIK:HGFCADIK,ACDFGHIJ:HGJCAFDI,ACDEIJKL:EJICADLK,ACDEHJKL:HJECADLK,ACDEHIKL:HEICADLK,ACDEHIJL:HJECADLI,ACDEHIJK:HJECADIK,ACDEGJKL:EGJCADLK,ACDEGIKL:EGICADLK,ACDEGIJL:EGJCADLI,ACDEGIJK:EGJCADIK,ACDEGHKL:HGECADLK,ACDEGHJL:HGJCADLE,ACDEGHJK:HGJCADEK,ACDEGHIL:HGECADLI,ACDEGHIK:HGECADIK,ACDEGHIJ:HGJCADEI,ACDEFJKL:CJEDAFLK,ACDEFIKL:CEIDAFLK,ACDEFIJL:CJEDAFLI,ACDEFIJK:CJEDAFIK,ACDEFHKL:HEFCADLK,ACDEFHJL:HJFCADLE,ACDEFHJK:HJECAFDK,ACDEFHIL:HEFCADLI,ACDEFHIK:HEFCADIK,ACDEFHIJ:HJECAFDI,ACDEFGKL:CGEDAFLK,ACDEFGJL:CGJDAFLE,ACDEFGJK:CGJDAFEK,ACDEFGIL:CGEDAFLI,ACDEFGIK:CGEDAFIK,ACDEFGIJ:CGJDAFEI,ACDEFGHL:HGFCADLE,ACDEFGHK:HGECAFDK,ACDEFGHJ:HGJCAFDE,ACDEFGHI:HGECAFDI,ABGHIJKL:HJBAIGLK,ABFHIJKL:HJBAIFLK,ABFGIJKL:IJBFAGLK,ABFGHJKL:HJBFAGLK,ABFGHIKL:HGBAIFLK,ABFGHIJL:HJBFAGLI,ABFGHIJK:HJBFAGIK,ABEHIJKL:EJBAIHLK,ABEGIJKL:EJBAIGLK,ABEGHJKL:EJBAHGLK,ABEGHIKL:EGBAIHLK,ABEGHIJL:EJBAHGLI,ABEGHIJK:EJBAHGIK,ABEFIJKL:EJBAIFLK,ABEFHJKL:EJBFAHLK,ABEFHIKL:EIBFAHLK,ABEFHIJL:EJBFAHLI,ABEFHIJK:EJBFAHIK,ABEFGJKL:EJBFAGLK,ABEFGIKL:EGBAIFLK,ABEFGIJL:EJBFAGLI,ABEFGIJK:EJBFAGIK,ABEFGHKL:EGBFAHLK,ABEFGHJL:HJBFAGLE,ABEFGHJK:HJBFAGEK,ABEFGHIL:EGBFAHLI,ABEFGHIK:EGBFAHIK,ABEFGHIJ:HJBFAGEI,ABDHIJKL:IJBDAHLK,ABDGIJKL:IJBDAGLK,ABDGHJKL:HJBDAGLK,ABDGHIKL:IGBDAHLK,ABDGHIJL:HJBDAGLI,ABDGHIJK:HJBDAGIK,ABDFIJKL:IJBDAFLK,ABDFHJKL:HJBDAFLK,ABDFHIKL:HIBDAFLK,ABDFHIJL:HJBDAFLI,ABDFHIJK:HJBDAFIK,ABDFGJKL:FJBDAGLK,ABDFGIKL:IGBDAFLK,ABDFGIJL:FJBDAGLI,ABDFGIJK:FJBDAGIK,ABDFGHKL:HGBDAFLK,ABDFGHJL:HGBDAFLJ,ABDFGHJK:HGBDAFJK,ABDFGHIL:HGBDAFLI,ABDFGHIK:HGBDAFIK,ABDFGHIJ:HGBDAFIJ,ABDEIJKL:EJBAIDLK,ABDEHJKL:EJBDAHLK,ABDEHIKL:EIBDAHLK,ABDEHIJL:EJBDAHLI,ABDEHIJK:EJBDAHIK,ABDEGJKL:EJBDAGLK,ABDEGIKL:EGBAIDLK,ABDEGIJL:EJBDAGLI,ABDEGIJK:EJBDAGIK,ABDEGHKL:EGBDAHLK,ABDEGHJL:HJBDAGLE,ABDEGHJK:HJBDAGEK,ABDEGHIL:EGBDAHLI,ABDEGHIK:EGBDAHIK,ABDEGHIJ:HJBDAGEI,ABDEFJKL:EJBDAFLK,ABDEFIKL:EIBDAFLK,ABDEFIJL:EJBDAFLI,ABDEFIJK:EJBDAFIK,ABDEFHKL:HEBDAFLK,ABDEFHJL:HJBDAFLE,ABDEFHJK:HJBDAFEK,ABDEFHIL:HEBDAFLI,ABDEFHIK:HEBDAFIK,ABDEFHIJ:HJBDAFEI,ABDEFGKL:EGBDAFLK,ABDEFGJL:EGBDAFLJ,ABDEFGJK:EGBDAFJK,ABDEFGIL:EGBDAFLI,ABDEFGIK:EGBDAFIK,ABDEFGIJ:EGBDAFIJ,ABDEFGHL:HGBDAFLE,ABDEFGHK:HGBDAFEK,ABDEFGHJ:HGBDAFEJ,ABDEFGHI:HGBDAFEI,ABCHIJKL:IJBCAHLK,ABCGIJKL:IJBCAGLK,ABCGHJKL:HJBCAGLK,ABCGHIKL:IGBCAHLK,ABCGHIJL:HJBCAGLI,ABCGHIJK:HJBCAGIK,ABCFIJKL:IJBCAFLK,ABCFHJKL:HJBCAFLK,ABCFHIKL:HIBCAFLK,ABCFHIJL:HJBCAFLI,ABCFHIJK:HJBCAFIK,ABCFGJKL:CJBFAGLK,ABCFGIKL:IGBCAFLK,ABCFGIJL:CJBFAGLI,ABCFGIJK:CJBFAGIK,ABCFGHKL:HGBCAFLK,ABCFGHJL:HGBCAFLJ,ABCFGHJK:HGBCAFJK,ABCFGHIL:HGBCAFLI,ABCFGHIK:HGBCAFIK,ABCFGHIJ:HGBCAFIJ,ABCEIJKL:EJBAICLK,ABCEHJKL:EJBCAHLK,ABCEHIKL:EIBCAHLK,ABCEHIJL:EJBCAHLI,ABCEHIJK:EJBCAHIK,ABCEGJKL:EJBCAGLK,ABCEGIKL:EGBAICLK,ABCEGIJL:EJBCAGLI,ABCEGIJK:EJBCAGIK,ABCEGHKL:EGBCAHLK,ABCEGHJL:HJBCAGLE,ABCEGHJK:HJBCAGEK,ABCEGHIL:EGBCAHLI,ABCEGHIK:EGBCAHIK,ABCEGHIJ:HJBCAGEI,ABCEFJKL:EJBCAFLK,ABCEFIKL:EIBCAFLK,ABCEFIJL:EJBCAFLI,ABCEFIJK:EJBCAFIK,ABCEFHKL:HEBCAFLK,ABCEFHJL:HJBCAFLE,ABCEFHJK:HJBCAFEK,ABCEFHIL:HEBCAFLI,ABCEFHIK:HEBCAFIK,ABCEFHIJ:HJBCAFEI,ABCEFGKL:EGBCAFLK,ABCEFGJL:EGBCAFLJ,ABCEFGJK:EGBCAFJK,ABCEFGIL:EGBCAFLI,ABCEFGIK:EGBCAFIK,ABCEFGIJ:EGBCAFIJ,ABCEFGHL:HGBCAFLE,ABCEFGHK:HGBCAFEK,ABCEFGHJ:HGBCAFEJ,ABCEFGHI:HGBCAFEI,ABCDIJKL:IJBCADLK,ABCDHJKL:HJBCADLK,ABCDHIKL:HIBCADLK,ABCDHIJL:HJBCADLI,ABCDHIJK:HJBCADIK,ABCDGJKL:CJBDAGLK,ABCDGIKL:IGBCADLK,ABCDGIJL:CJBDAGLI,ABCDGIJK:CJBDAGIK,ABCDGHKL:HGBCADLK,ABCDGHJL:HGBCADLJ,ABCDGHJK:HGBCADJK,ABCDGHIL:HGBCADLI,ABCDGHIK:HGBCADIK,ABCDGHIJ:HGBCADIJ,ABCDFJKL:CJBDAFLK,ABCDFIKL:CIBDAFLK,ABCDFIJL:CJBDAFLI,ABCDFIJK:CJBDAFIK,ABCDFHKL:HFBCADLK,ABCDFHJL:CJBDAFLH,ABCDFHJK:HJBCAFDK,ABCDFHIL:HFBCADLI,ABCDFHIK:HFBCADIK,ABCDFHIJ:HJBCAFDI,ABCDFGKL:CGBDAFLK,ABCDFGJL:CGBDAFLJ,ABCDFGJK:CGBDAFJK,ABCDFGIL:CGBDAFLI,ABCDFGIK:CGBDAFIK,ABCDFGIJ:CGBDAFIJ,ABCDFGHL:CGBDAFLH,ABCDFGHK:HGBCAFDK,ABCDFGHJ:HGBCAFDJ,ABCDFGHI:HGBCAFDI,ABCDEJKL:EJBCADLK,ABCDEIKL:EIBCADLK,ABCDEIJL:EJBCADLI,ABCDEIJK:EJBCADIK,ABCDEHKL:HEBCADLK,ABCDEHJL:HJBCADLE,ABCDEHJK:HJBCADEK,ABCDEHIL:HEBCADLI,ABCDEHIK:HEBCADIK,ABCDEHIJ:HJBCADEI,ABCDEGKL:EGBCADLK,ABCDEGJL:EGBCADLJ,ABCDEGJK:EGBCADJK,ABCDEGIL:EGBCADLI,ABCDEGIK:EGBCADIK,ABCDEGIJ:EGBCADIJ,ABCDEGHL:HGBCADLE,ABCDEGHK:HGBCADEK,ABCDEGHJ:HGBCADEJ,ABCDEGHI:HGBCADEI,ABCDEFKL:CEBDAFLK,ABCDEFJL:CJBDAFLE,ABCDEFJK:CJBDAFEK,ABCDEFIL:CEBDAFLI,ABCDEFIK:CEBDAFIK,ABCDEFIJ:CJBDAFEI,ABCDEFHL:HFBCADLE,ABCDEFHK:HEBCAFDK,ABCDEFHJ:HJBCAFDE,ABCDEFHI:HEBCAFDI,ABCDEFGL:CGBDAFLE,ABCDEFGK:CGBDAFEK,ABCDEFGJ:CGBDAFEJ,ABCDEFGI:CGBDAFEI,ABCDEFGH:HGBCAFDE"
    .split(",")
    .map((row) => row.split(":") as [string, string]),
);

const bonusFieldLabels: BonusFieldLabel[] = [
  { key: "worldChampion", label: "Världsmästare", points: "15p" },
  { key: "topScorer", label: "Skytteligavinnare", points: "10p" },
  { key: "mostGroupGoals", label: "Flest mål i gruppspel (lag)", points: "8p", placeholder: "Ex. USA" },
  { key: "mostCardsGroupStage", label: "Flest kort i gruppspelet (lag)", points: "5p", placeholder: "Ditt svar" },
  { key: "totalTournamentGoals", label: "Närmast totalt antal mål i turneringen", points: "8p", type: "number" },
  { key: "firstHostEliminated", label: "Bästa poänggörare i turneringen", points: "8p", placeholder: "Ditt svar" },
  {
    key: "darkhorseQuarterfinalist",
    label: "Tar sig längst (darkhorse)",
    points: "8p",
    playerInput: "select",
    options: darkhorseTeamOptions,
    placeholder: "Välj lag",
  },
  { key: "biggestWinMargin", label: "Största segermarginalen i en match", points: "5p", type: "number" },
];

function logStorageError(message: string, error: unknown) {
  console.error(message, describeSupabaseError(error), error);
}

const flagCodeByTeam: Record<string, string> = {
  Algeriet: "dz",
  Argentina: "ar",
  Australien: "au",
  Belgien: "be",
  "Bosnien-Herzigovina": "ba",
  Brasilien: "br",
  Colombia: "co",
  Curaçao: "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypten: "eg",
  Elfenbenskusten: "ci",
  England: "gb-eng",
  Frankrike: "fr",
  Ghana: "gh",
  Haiti: "ht",
  Irak: "iq",
  Iran: "ir",
  Japan: "jp",
  Jordanien: "jo",
  Kanada: "ca",
  "Kap Verde": "cv",
  Kongo: "cd",
  Kroatien: "hr",
  Marocko: "ma",
  Mexiko: "mx",
  Nederländerna: "nl",
  Norge: "no",
  "Nya Zeeland": "nz",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  Saudiarabien: "sa",
  Schweiz: "ch",
  Senegal: "sn",
  Skottland: "gb-sct",
  Spanien: "es",
  Sverige: "se",
  Sydafrika: "za",
  Sydkorea: "kr",
  Tunisien: "tn",
  Turkiet: "tr",
  Tyskland: "de",
  Uruguay: "uy",
  USA: "us",
  Uzbekistan: "uz",
  Österrike: "at",
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function uniqueSortedNumbers(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function isFixtureLocked(fixture: Fixture, lockedDates: string[], lockedMatchIds: number[] = []) {
  return lockedDates.includes(fixture.date) || lockedMatchIds.includes(fixture.id);
}

function TeamLabel({ team }: { team: string }) {
  const flagCode = flagCodeByTeam[team];

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
      {flagCode ? (
        <Image
          src={`https://flagcdn.com/w40/${flagCode}.png`}
          alt=""
          aria-hidden="true"
          width={20}
          height={15}
          className="h-[1em] w-[1.35em] shrink-0 rounded-[2px] object-cover shadow-sm"
          loading="lazy"
          unoptimized
        />
      ) : null}
      <span className="min-w-0 truncate">{team}</span>
    </span>
  );
}

const scoreOptions = Array.from({ length: 16 }, (_, index) => index);

function ScoreField({
  label,
  value,
  disabled,
  onChange,
  tone = "volt",
}: {
  label: string;
  value?: number;
  disabled: boolean;
  onChange: (value: number) => void;
  tone?: "volt" | "flare";
}) {
  const focusClass = tone === "flare" ? "focus:border-flare" : "focus:border-volt";

  return (
    <>
      <select
        aria-label={label}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={classNames(
          "h-12 w-20 rounded-2xl border border-white/10 bg-white/10 text-center font-display text-lg font-black outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:hidden",
          focusClass,
        )}
      >
        <option value="" disabled>
          -
        </option>
        {scoreOptions.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
      <input
        aria-label={label}
        type="number"
        min={0}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={classNames(
          "hidden h-12 w-16 rounded-2xl border border-white/10 bg-white/10 text-center font-display text-lg font-black outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:block",
          focusClass,
        )}
      />
    </>
  );
}

function PodiumIcon({ index, size }: { index: number; size?: number }) {
  if (index === 0) return <Crown size={size} className="text-flare" />;
  if (index === 1) return <Medal size={size} className="text-white/75" />;
  return <Medal size={size} className="text-[#CD7F32]" />;
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

function formatScoreLine(score?: ScoreLine) {
  return score ? `${score.home}-${score.away}` : "-";
}

function nextFixture(now = new Date()) {
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

function getMatchSyncInterval(now = new Date()) {
  const today = getSwedishDateKey(now);
  const hasMatchToday = fixtures.some((fixture) => fixture.date === today);
  if (!hasMatchToday) return undefined;

  const hasLiveMatchWindow = fixtures.some((fixture) => {
    const kickoff = getFixtureKickoff(fixture).getTime();
    const elapsed = now.getTime() - kickoff;
    return elapsed >= 0 && elapsed <= liveMatchWindowMs;
  });

  return hasLiveMatchWindow ? liveMatchSyncIntervalMs : matchDaySyncIntervalMs;
}

function getTournamentCountdown(now = new Date()) {
  const firstFixture = fixtures[0];
  const kickoff = getFixtureKickoff(firstFixture);
  const totalSeconds = Math.max(0, Math.floor((kickoff.getTime() - now.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hasStarted: totalSeconds <= 0,
    kickoff,
    parts: [
      { label: "Dagar", value: days },
      { label: "Timmar", value: hours },
      { label: "Minuter", value: minutes },
      { label: "Sekunder", value: seconds },
    ],
  };
}

function hasTournamentStarted(now = new Date()) {
  return getFixtureKickoff(fixtures[0]) <= now;
}

function isBonusLocked(now: Date, lockedDates: string[], lockedMatchIds: number[] = []) {
  return hasTournamentStarted(now) || isFixtureLocked(fixtures[0], lockedDates, lockedMatchIds);
}

function getMatchesByDate(date: string) {
  return fixtures
    .filter((fixture) => fixture.date === date)
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime) || a.id - b.id);
}

function getDashboardNextFixture(previewDate?: string, now = new Date()) {
  if (previewDate) return getMatchesByDate(previewDate)[0] ?? nextFixture(now);
  return nextFixture(now);
}

function getMatchDayPanel(previewDate?: string, now = new Date()) {
  if (previewDate) {
    return { label: "Testad matchdag", date: previewDate, matches: getMatchesByDate(previewDate) };
  }

  const today = getSwedishDateKey(now);
  const todayMatches = getMatchesByDate(today);

  if (todayMatches.length > 0) {
    return { label: "Dagens matcher", date: today, matches: todayMatches };
  }

  const next = nextFixture(now);
  const nextMatches = getMatchesByDate(next.date);

  return { label: "Nästa matchdag", date: next.date, matches: nextMatches };
}

type DailyScoreMatch = {
  id: number;
  stage: MatchStage;
  kickoffTime: string;
  home: string;
  away: string;
  predictedScore?: ScoreLine;
  predictedWinner?: string;
  actualScore: ScoreLine;
  actualWinner?: string;
  points: number;
};

type DailyScoreDay = {
  dateKey: string;
  date: string;
  points: number;
  dayPoints: number;
  matches: DailyScoreMatch[];
};

function buildDailyScoreData(
  predictions: Prediction[],
  results: Record<number, ScoreLine>,
  lockedDates: string[],
  resultWinners: Record<number, string> = {},
  lockedMatchIds: number[] = [],
) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  const resolvedKnockoutById = new Map(
    buildResolvedKnockoutFixtures({
      sourceResults: results,
      lockedDates,
      lockedMatchIds,
      resolveGroupTeams: stageIsLocked("Gruppspel", lockedDates, lockedMatchIds),
      useSourceResultsForAdvancement: true,
      advancementWinners: resultWinners,
    }).map((match) => [match.id, match]),
  );
  let total = 0;

  const rows = fixtures
    .filter((fixture) => isFixtureLocked(fixture, lockedDates, lockedMatchIds) && results[fixture.id])
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .reduce<DailyScoreDay[]>((days, fixture) => {
      const prediction = predictionMap.get(fixture.id);
      const resolvedFixture = fixture.stage === "Gruppspel" ? undefined : resolvedKnockoutById.get(fixture.id);
      const displayHome = resolvedFixture?.resolvedHome ?? fixture.home;
      const displayAway = resolvedFixture?.resolvedAway ?? fixture.away;
      const actualWinner =
        fixture.stage === "Gruppspel"
          ? undefined
          : resolvedFixture
            ? matchWinner(resolvedFixture.resolvedHome, resolvedFixture.resolvedAway, results[fixture.id], resultWinners[fixture.id])
            : resultWinners[fixture.id] ?? matchWinner(fixture.home, fixture.away, results[fixture.id]);
      const predictionForScore =
        fixture.stage === "Gruppspel" || !resolvedFixture || !prediction?.score
          ? prediction
          : {
              ...prediction,
              winner: matchWinner(resolvedFixture.resolvedHome, resolvedFixture.resolvedAway, prediction.score, prediction.winner) ?? prediction.winner,
            };
      const dayPoints = scorePrediction(predictionForScore ?? { matchId: fixture.id }, results[fixture.id], fixture.stage, actualWinner);
      total += dayPoints;

      const dateKey = fixture.date;
      const label = formatDate(fixture.date);
      const existingDay = days.find((day) => day.dateKey === dateKey);
      const scoredMatch = {
        id: fixture.id,
        stage: fixture.stage,
        kickoffTime: fixture.kickoffTime,
        home: displayHome,
        away: displayAway,
        predictedScore: prediction?.score,
        predictedWinner: predictionForScore?.winner,
        actualScore: results[fixture.id],
        actualWinner,
        points: dayPoints,
      };
      if (existingDay) {
        existingDay.dayPoints += dayPoints;
        existingDay.points = total;
        existingDay.matches.push(scoredMatch);
        return days;
      }

      days.push({ dateKey, date: label, points: total, dayPoints, matches: [scoredMatch] });
      return days;
    }, []);

  return rows.length > 0 ? rows : [{ dateKey: "start", date: "Start", points: 0, dayPoints: 0, matches: [] }];
}

function scorePredictions(
  predictions: Prediction[],
  results: Record<number, ScoreLine>,
  lockedDates: string[],
  resultWinners: Record<number, string> = {},
  bonusAnswers: BonusPrediction = defaultBonusAnswers,
  officialBonusAnswers: BonusPrediction = defaultBonusAnswers,
  closestTotalGoalDelta?: number,
  lockedMatchIds: number[] = [],
) {
  let exact = 0;
  let groupPoints = 0;
  let knockoutPoints = 0;
  let latestChange = 0;
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const resolvedKnockoutById = new Map(
    buildResolvedKnockoutFixtures({
      sourceResults: results,
      lockedDates,
      lockedMatchIds,
      resolveGroupTeams: stageIsLocked("Gruppspel", lockedDates, lockedMatchIds),
      useSourceResultsForAdvancement: true,
      advancementWinners: resultWinners,
    }).map((match) => [match.id, match]),
  );
  const latestLockedDate = fixtures
    .filter((fixture) => isFixtureLocked(fixture, lockedDates, lockedMatchIds) && results[fixture.id])
    .map((fixture) => fixture.date)
    .sort((a, b) => b.localeCompare(a))[0];

  for (const prediction of predictions) {
    const fixture = fixtureById.get(prediction.matchId);
    const result = results[prediction.matchId];
    if (!fixture || !result || !isFixtureLocked(fixture, lockedDates, lockedMatchIds)) continue;

    const resolvedFixture = fixture.stage === "Gruppspel" ? undefined : resolvedKnockoutById.get(prediction.matchId);
    const actualWinner =
      fixture.stage === "Gruppspel"
        ? undefined
        : resolvedFixture
          ? matchWinner(resolvedFixture.resolvedHome, resolvedFixture.resolvedAway, result, resultWinners[prediction.matchId])
          : resultWinners[prediction.matchId] ?? matchWinner(fixture.home, fixture.away, result);
    const predictionForScore =
      fixture.stage === "Gruppspel" || !resolvedFixture || !prediction.score
        ? prediction
        : {
            ...prediction,
            winner: matchWinner(resolvedFixture.resolvedHome, resolvedFixture.resolvedAway, prediction.score, prediction.winner) ?? prediction.winner,
          };
    const matchPoints = scorePrediction(predictionForScore, result, fixture.stage, actualWinner);
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
  lockedMatchIds: number[] = [],
): UserScore[] {
  const playerProfiles = profiles.filter((profile) => profile.role === "player");
  const bonusByProfile = new Map(
    playerProfiles.map((profile) => [
      profile.id,
      profile.id === activeProfileId ? activeBonusAnswers : storedBonusAnswers[profile.id] ?? loadProfileBonus(profile.id, activeProfileId, activeBonusAnswers),
    ]),
  );
  const totalGoalDeltas =
    typeof officialBonusAnswers.totalTournamentGoals === "number"
      ? [...bonusByProfile.values()]
          .map((bonus) =>
            typeof bonus.totalTournamentGoals === "number"
              ? Math.abs(bonus.totalTournamentGoals - officialBonusAnswers.totalTournamentGoals!)
              : undefined,
          )
          .filter((value): value is number => value !== undefined)
      : [];
  const closestTotalGoalDelta = totalGoalDeltas.length > 0 ? Math.min(...totalGoalDeltas) : undefined;

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
        closestTotalGoalDelta,
        lockedMatchIds,
      );

      return {
        id: profile.id,
        name: profile.name,
        avatar: profile.initials,
        trend: score.latestChange,
        history: buildDailyScoreData(profilePredictions, results, lockedDates, resultWinners, lockedMatchIds).map((day) => day.points),
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

function stageIsLocked(stage: MatchStage, lockedDates: string[], lockedMatchIds: number[] = []) {
  const stageFixtures = fixtures.filter((match) => match.stage === stage);
  return stageFixtures.length > 0 && stageFixtures.every((match) => isFixtureLocked(match, lockedDates, lockedMatchIds));
}

function getOpenKnockoutStages(lockedDates: string[], lockedMatchIds: number[] = []): MatchStage[] {
  if (!stageIsLocked("Gruppspel", lockedDates, lockedMatchIds)) return [];
  if (!stageIsLocked("Sextondelsfinal", lockedDates, lockedMatchIds)) return ["Sextondelsfinal"];
  if (!stageIsLocked("Åttondelsfinal", lockedDates, lockedMatchIds)) return ["Åttondelsfinal"];
  if (!stageIsLocked("Kvartsfinal", lockedDates, lockedMatchIds)) return ["Kvartsfinal"];
  if (!stageIsLocked("Semifinal", lockedDates, lockedMatchIds)) return ["Semifinal"];

  return (["Bronsmatch", "Final"] as MatchStage[]).filter((stage) => !stageIsLocked(stage, lockedDates, lockedMatchIds));
}

function groupHasCompleteResults(group: GroupLetter, results: Record<number, ScoreLine>) {
  return fixtures.filter((match) => match.stage === "Gruppspel" && match.group === group).every((match) => Boolean(results[match.id]));
}

function completedGroupResults(results: Record<number, ScoreLine>) {
  return new Set(groupLetters.filter((group) => groupHasCompleteResults(group, results)));
}

function hasAnyCompleteGroupResults(results: Record<number, ScoreLine>) {
  return completedGroupResults(results).size > 0;
}

function isKnockoutPlaceholder(value: string) {
  return /^(Vinnare|Förlorare|Tvåa|Bästa trea)\b/.test(value);
}

function isResolvedKnockoutMatch(match: Fixture & { resolvedHome?: string; resolvedAway?: string }) {
  return !isKnockoutPlaceholder(match.resolvedHome ?? match.home) && !isKnockoutPlaceholder(match.resolvedAway ?? match.away);
}

function getResolvedActualKnockoutFixtures(
  results: Record<number, ScoreLine>,
  resultWinners: Record<number, string>,
  lockedDates: string[],
  lockedMatchIds: number[] = [],
) {
  return buildResolvedKnockoutFixtures({
    sourceResults: results,
    lockedDates,
    lockedMatchIds,
    resolveGroupTeams: hasAnyCompleteGroupResults(results),
    useSourceResultsForAdvancement: true,
    advancementWinners: resultWinners,
  });
}

function getOpenActualKnockoutStages(
  results: Record<number, ScoreLine>,
  resultWinners: Record<number, string>,
  lockedDates: string[],
  lockedMatchIds: number[] = [],
): MatchStage[] {
  const resolvedKnockout = getResolvedActualKnockoutFixtures(results, resultWinners, lockedDates, lockedMatchIds);
  return stageOrder.filter((stage) =>
    resolvedKnockout.some((match) => match.stage === stage && !isFixtureLocked(match, lockedDates, lockedMatchIds) && isResolvedKnockoutMatch(match)),
  );
}

function getPhaseStatus(lockedDates: string[], lockedMatchIds: number[] = []) {
  if (!stageIsLocked("Gruppspel", lockedDates, lockedMatchIds)) {
    return {
      label: "Gruppspel öppet",
      description: "Tippa gruppspel och bonusfrågor. Slutspel låses upp efter gruppspelet.",
      openLabel: "Gruppspel",
    };
  }

  const openKnockoutStages = getOpenKnockoutStages(lockedDates, lockedMatchIds);
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
  options?: { completedGroups: Set<GroupLetter>; allGroupResultsAvailable: boolean },
) {
  const groupWinner = slot.match(/^Vinnare grupp ([A-L])$/);
  if (groupWinner) {
    const group = groupWinner[1] as GroupLetter;
    if (options && !options.completedGroups.has(group)) return slot;
    return standingsByGroup[group]?.[0]?.team ?? slot;
  }

  const groupRunnerUp = slot.match(/^Tvåa grupp ([A-L])$/);
  if (groupRunnerUp) {
    const group = groupRunnerUp[1] as GroupLetter;
    if (options && !options.completedGroups.has(group)) return slot;
    return standingsByGroup[group]?.[1]?.team ?? slot;
  }

  const bestThird = slot.match(/^Bästa trea ([A-L]+)$/);
  if (bestThird) {
    if (options && !options.allGroupResultsAvailable) return slot;
    const slotKey = bestThird[1];
    const qualifiedThirdGroups = thirdRank
      .slice(0, 8)
      .map((item) => item.group)
      .sort()
      .join("");
    const assignment = thirdPlaceAssignmentTable.get(qualifiedThirdGroups);
    const assignedGroup = assignment?.[thirdPlaceSlotOrder.indexOf(slotKey as (typeof thirdPlaceSlotOrder)[number])] as
      | GroupLetter
      | undefined;
    const assignedThird = assignedGroup ? thirdRank.find((item) => item.group === assignedGroup) : undefined;
    if (assignedThird) return assignedThird.standing.team;

    const allowedGroups = slotKey.split("") as GroupLetter[];
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
  lockedMatchIds = [],
  resolveGroupTeams = false,
  forceResolveAll = false,
  useSourceResultsForAdvancement = false,
  advancementWinners = {},
}: {
  sourceResults: Record<number, ScoreLine>;
  predictions?: Prediction[];
  lockedDates?: string[];
  lockedMatchIds?: number[];
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
  const completedGroups = completedGroupResults(sourceResults);
  const resolutionOptions = forceResolveAll
    ? undefined
    : {
        completedGroups,
        allGroupResultsAvailable: completedGroups.size === groupLetters.length,
      };
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
      (requiredPreviousStage ? stageIsLocked(requiredPreviousStage, lockedDates, lockedMatchIds) : false);
    const resolveSlot = (slot: string) =>
      resolveFromMatchSlot(
        canResolveRound
          ? resolveKnockoutTeam(
              slot,
              standingsByGroup,
              thirdRank,
              match.stage === "Sextondelsfinal" ? usedThirdGroups : undefined,
              resolutionOptions,
            )
          : slot,
        resolvedById,
        scoreByMatchId,
        winnerByMatchId,
      );

    const resolved = {
      ...match,
      resolvedHome: resolveSlot(match.home),
      resolvedAway: resolveSlot(match.away),
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

function randomPredictionsForFixtures(
  knockoutSourceResults: Record<number, ScoreLine> = {},
  knockoutResultWinners: Record<number, string> = {},
) {
  const predictionsByMatchId = new Map<number, Prediction>();
  const sourceResults: Record<number, ScoreLine> = { ...knockoutSourceResults };
  const hasKnockoutSourceResults = Object.keys(knockoutSourceResults).length > 0;
  const allLockedDates = Array.from(new Set(fixtures.map((match) => match.date)));

  fixtures
    .filter((match) => match.stage === "Gruppspel")
    .forEach((match) => {
      const score = randomScore();
      const winner = score.home > score.away ? match.home : score.home < score.away ? match.away : "Oavgjort";
      if (!hasKnockoutSourceResults) sourceResults[match.id] = score;
      predictionsByMatchId.set(match.id, { matchId: match.id, score, winner });
    });

  for (const stage of stageOrder) {
    const resolvedKnockout = buildResolvedKnockoutFixtures({
      sourceResults,
      predictions: [...predictionsByMatchId.values()],
      lockedDates: allLockedDates,
      resolveGroupTeams: true,
      useSourceResultsForAdvancement: hasKnockoutSourceResults,
      advancementWinners: knockoutResultWinners,
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
  if (key === "totalTournamentGoals" || key === "biggestWinMargin") {
    return { ...current, [key]: value === "" ? undefined : Number(value) };
  }

  return { ...current, [key]: value };
}

type SupabaseSnapshot = {
  profiles: PlayerProfile[];
  predictionsByProfile: Record<string, Prediction[]>;
  bonusByProfile: Record<string, BonusPrediction>;
  results: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  manualResultOverrideMatchIds: number[];
  lockedDates: string[];
  lockedMatchIds: number[];
  groupStageTipsLocked: boolean;
  officialBonusAnswers: BonusPrediction;
};

type ResultWriteSource = "manual" | "api";

function mergePredictionsWithDefaults(profiles: PlayerProfile[], dbPredictions: Record<string, Prediction[]>) {
  return Object.fromEntries(
    profiles.map((profile) => {
      return [profile.id, mergeProfilePredictionsWithDefaults(dbPredictions[profile.id] ?? [])];
    }),
  );
}

function mergeProfilePredictionsWithDefaults(savedPredictions: Prediction[]) {
  const savedMatchIds = new Set(savedPredictions.map((prediction) => prediction.matchId));
  const missingDefaults = defaultPredictions.filter((prediction) => !savedMatchIds.has(prediction.matchId));
  return [...savedPredictions, ...missingDefaults];
}

async function loadSupabaseSnapshot(): Promise<SupabaseSnapshot> {
  const [
    dbProfiles,
    dbPredictions,
    dbBonus,
    dbResults,
    dbLockedDates,
    dbLockedMatchIds,
    dbGroupStageTipsLocked,
    dbOfficialBonus,
    dbManualResultOverrideMatchIds,
  ] = await Promise.all([
    loadProfilesFromDb(),
    loadAllPredictionsFromDb(),
    loadAllBonusFromDb(),
    loadResultsFromDb(),
    loadAppStateFromDb<string[]>("locked_dates", []),
    loadAppStateFromDb<number[]>("locked_match_ids", []),
    loadAppStateFromDb<boolean>("group_stage_tips_locked", false),
    loadAppStateFromDb<BonusPrediction>("official_bonus", defaultBonusAnswers),
    loadAppStateFromDb<number[]>("manual_result_override_match_ids", []),
  ]);

  const profiles = dbProfiles.length > 0 ? dbProfiles : starterProfiles;
  if (dbProfiles.length === 0) await saveProfilesToDb(starterProfiles);

  return {
    profiles,
    predictionsByProfile: mergePredictionsWithDefaults(profiles, dbPredictions),
    bonusByProfile: dbBonus,
    results: dbResults.results,
    resultWinners: dbResults.resultWinners,
    manualResultOverrideMatchIds: dbManualResultOverrideMatchIds,
    lockedDates: dbLockedDates,
    lockedMatchIds: dbLockedMatchIds,
    groupStageTipsLocked: dbGroupStageTipsLocked,
    officialBonusAnswers: dbOfficialBonus,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Hem");
  const [predictions, setPredictions] = useState<Prediction[]>(defaultPredictions);
  const [results, setResults] = useState<Record<number, ScoreLine>>(sampleResults);
  const [resultWinners, setResultWinners] = useState<Record<number, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<GroupLetter>("A");
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<PlayerProfile | null>(null);
  const [loadedProfileId, setLoadedProfileId] = useState<string>();
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPassword, setNewPlayerPassword] = useState("");
  const [authProfile, setAuthProfile] = useState<PlayerProfile | null>(null);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [lockedDates, setLockedDates] = useState<string[]>([]);
  const [lockedMatchIds, setLockedMatchIds] = useState<number[]>([]);
  const [manualResultOverrideMatchIds, setManualResultOverrideMatchIds] = useState<number[]>([]);
  const [groupStageTipsLocked, setGroupStageTipsLocked] = useState(false);
  const [matchSyncMessage, setMatchSyncMessage] = useState("");
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [winnersModalDismissed, setWinnersModalDismissed] = useState(false);
  const [homePreviewDate, setHomePreviewDate] = useState("");
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [databaseSyncMessage, setDatabaseSyncMessage] = useState("");
  const [isDatabaseSyncing, setIsDatabaseSyncing] = useState(false);
  const [bonusAnswers, setBonusAnswers] = useState<BonusPrediction>(defaultBonusAnswers);
  const [officialBonusAnswers, setOfficialBonusAnswers] = useState<BonusPrediction>(defaultBonusAnswers);
  const [allPredictionsByProfile, setAllPredictionsByProfile] = useState<Record<string, Prediction[]>>({});
  const [allBonusByProfile, setAllBonusByProfile] = useState<Record<string, BonusPrediction>>({});
  const [isDatabaseLoaded, setIsDatabaseLoaded] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local">(isSupabaseEnabled ? "supabase" : "local");
  const allPredictionsRef = useRef<Record<string, Prediction[]>>({});
  const allBonusRef = useRef<Record<string, BonusPrediction>>({});
  const resultsRef = useRef<Record<number, ScoreLine>>({});
  const resultWinnersRef = useRef<Record<number, string>>({});
  const manualResultOverrideMatchIdsRef = useRef<number[]>([]);
  const lockedDatesRef = useRef<string[]>([]);
  const lockedMatchIdsRef = useRef<number[]>([]);
  const suppressRemoteAutosaveRef = useRef(false);
  const lastMatchSyncAtRef = useRef(0);
  const dirtyResultSourcesRef = useRef<Map<number, ResultWriteSource>>(new Map());
  const predictionEditVersionRef = useRef(0);

  const suppressRemoteAutosaveBriefly = useCallback(() => {
    suppressRemoteAutosaveRef.current = true;
    window.setTimeout(() => {
      suppressRemoteAutosaveRef.current = false;
    }, 750);
  }, []);

  function markPredictionDirty() {
    predictionEditVersionRef.current += 1;
  }

  function markResultDirty(matchId: number, source: ResultWriteSource = "manual") {
    if (source === "manual" || dirtyResultSourcesRef.current.get(matchId) !== "manual") {
      dirtyResultSourcesRef.current.set(matchId, source);
    }
  }

  function updateManualResultOverrideIds(updater: (current: number[]) => number[]) {
    setManualResultOverrideMatchIds((current) => {
      const next = updater(current);
      manualResultOverrideMatchIdsRef.current = next;
      return next;
    });
  }

  function addManualResultOverride(matchId: number) {
    updateManualResultOverrideIds((current) => uniqueSortedNumbers([...current, matchId]));
  }

  const refreshProfilePredictions = useCallback(async (profileId: string, options: { forceApply?: boolean } = {}) => {
    const editVersionAtStart = predictionEditVersionRef.current;
    const dbPredictions = await loadPredictionsFromDb(profileId);
    const saved = mergeProfilePredictionsWithDefaults(dbPredictions);
    if (!options.forceApply && editVersionAtStart !== predictionEditVersionRef.current) return saved;
    suppressRemoteAutosaveBriefly();
    setPredictions(saved);
    setAllPredictionsByProfile((current) => ({ ...current, [profileId]: saved }));
    setLoadedProfileId(profileId);
    return saved;
  }, [suppressRemoteAutosaveBriefly]);

  useEffect(() => {
    allPredictionsRef.current = allPredictionsByProfile;
  }, [allPredictionsByProfile]);

  useEffect(() => {
    allBonusRef.current = allBonusByProfile;
  }, [allBonusByProfile]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    resultWinnersRef.current = resultWinners;
  }, [resultWinners]);

  useEffect(() => {
    manualResultOverrideMatchIdsRef.current = manualResultOverrideMatchIds;
  }, [manualResultOverrideMatchIds]);

  useEffect(() => {
    lockedDatesRef.current = lockedDates;
  }, [lockedDates]);

  useEffect(() => {
    lockedMatchIdsRef.current = lockedMatchIds;
  }, [lockedMatchIds]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [suppressRemoteAutosaveBriefly]);

  async function refreshSupabaseData() {
    if (!isSupabaseEnabled) {
      setDatabaseSyncMessage("Supabase är inte konfigurerat.");
      return;
    }

    setIsDatabaseSyncing(true);
    try {
      const snapshot = await loadSupabaseSnapshot();
      const refreshedCurrentProfile = currentProfile ? snapshot.profiles.find((profile) => profile.id === currentProfile.id) : undefined;

      suppressRemoteAutosaveBriefly();
      setProfiles(snapshot.profiles);
      setAllPredictionsByProfile(snapshot.predictionsByProfile);
      setAllBonusByProfile(snapshot.bonusByProfile);
      setResults(snapshot.results);
      setResultWinners(snapshot.resultWinners);
      setManualResultOverrideMatchIds(snapshot.manualResultOverrideMatchIds);
      setLockedDates(snapshot.lockedDates);
      setLockedMatchIds(snapshot.lockedMatchIds);
      setGroupStageTipsLocked(snapshot.groupStageTipsLocked);
      setOfficialBonusAnswers(snapshot.officialBonusAnswers);
      setStorageMode("supabase");
      setIsDatabaseLoaded(true);

      if (currentProfile) {
        if (refreshedCurrentProfile) setCurrentProfile(refreshedCurrentProfile);
        setPredictions(snapshot.predictionsByProfile[currentProfile.id] ?? defaultPredictions);
        setBonusAnswers(snapshot.bonusByProfile[currentProfile.id] ?? defaultBonusAnswers);
        setLoadedProfileId(currentProfile.id);
      }

      setDatabaseSyncMessage(`Databas synkad ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      setDatabaseSyncMessage("Kunde inte läsa från Supabase.");
      logStorageError("Kunde inte synka från Supabase.", error);
    } finally {
      setIsDatabaseSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      if (isSupabaseEnabled) {
        try {
          const snapshot = await loadSupabaseSnapshot();

          if (cancelled) return;

          suppressRemoteAutosaveBriefly();
          setProfiles(snapshot.profiles);
          setAllPredictionsByProfile(snapshot.predictionsByProfile);
          setAllBonusByProfile(snapshot.bonusByProfile);
          setResults(snapshot.results);
          setResultWinners(snapshot.resultWinners);
          setManualResultOverrideMatchIds(snapshot.manualResultOverrideMatchIds);
          setLockedDates(snapshot.lockedDates);
          setLockedMatchIds(snapshot.lockedMatchIds);
          setGroupStageTipsLocked(snapshot.groupStageTipsLocked);
          setOfficialBonusAnswers(snapshot.officialBonusAnswers);
          setStorageMode("supabase");
          setIsDatabaseLoaded(true);

          const activeProfileId = window.localStorage.getItem("vm-tipset-active-profile");
          const activeProfile = snapshot.profiles.find((profile) => profile.id === activeProfileId);
          if (activeProfile) setCurrentProfile(activeProfile);
          return;
        } catch (error) {
          logStorageError("Supabase kunde inte laddas, använder localStorage som fallback.", error);
          setStorageMode("local");
        }
      }

      const savedProfiles = readStoredJson<PlayerProfile[] | null>("vm-tipset-profiles", null);
      setLockedDates(readStoredJson("vm-tipset-locked-dates", []));
      setLockedMatchIds(readStoredJson("vm-tipset-locked-match-ids", []));
      setManualResultOverrideMatchIds(readStoredJson("vm-tipset-manual-result-overrides", []));
      setGroupStageTipsLocked(readStoredJson("vm-tipset-group-stage-tips-locked", false));
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
  }, [suppressRemoteAutosaveBriefly]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      if (suppressRemoteAutosaveRef.current) return;
      saveProfilesToDb(profiles).catch((error) => logStorageError("Kunde inte spara profiler.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-profiles", JSON.stringify(profiles));
  }, [isDatabaseLoaded, profiles, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      if (suppressRemoteAutosaveRef.current) return;
      saveAppStateToDb("locked_dates", lockedDates).catch((error) => logStorageError("Kunde inte spara låsta dagar.", error));
      saveAppStateToDb("locked_match_ids", lockedMatchIds).catch((error) => logStorageError("Kunde inte spara låsta matcher.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-locked-dates", JSON.stringify(lockedDates));
    window.localStorage.setItem("vm-tipset-locked-match-ids", JSON.stringify(lockedMatchIds));
  }, [isDatabaseLoaded, lockedDates, lockedMatchIds, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      if (suppressRemoteAutosaveRef.current) return;
      saveAppStateToDb("group_stage_tips_locked", groupStageTipsLocked).catch((error) => logStorageError("Kunde inte spara gruppspelslås.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-group-stage-tips-locked", JSON.stringify(groupStageTipsLocked));
  }, [groupStageTipsLocked, isDatabaseLoaded, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      saveAppStateToDb("manual_result_override_match_ids", manualResultOverrideMatchIds).catch((error) =>
        logStorageError("Kunde inte spara manuella resultatlås.", error),
      );
      return;
    }
    window.localStorage.setItem("vm-tipset-manual-result-overrides", JSON.stringify(manualResultOverrideMatchIds));
  }, [isDatabaseLoaded, manualResultOverrideMatchIds, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      const dirtyEntries = [...dirtyResultSourcesRef.current.entries()];
      if (suppressRemoteAutosaveRef.current && dirtyEntries.length === 0) return;
      if (dirtyEntries.length === 0) return;
      dirtyResultSourcesRef.current.clear();

      const saveDirtyResults = (ids: number[], source: ResultWriteSource) => {
        const dirtyResults = ids.reduce<Record<number, ScoreLine>>((map, matchId) => {
          if (results[matchId]) map[matchId] = results[matchId];
          return map;
        }, {});
        const dirtyResultWinners = ids.reduce<Record<number, string>>((map, matchId) => {
          if (resultWinners[matchId]) map[matchId] = resultWinners[matchId];
          return map;
        }, {});
        if (Object.keys(dirtyResults).length === 0) return Promise.resolve();
        return saveResultsToDb(dirtyResults, dirtyResultWinners, {
          protectedMatchIds: manualResultOverrideMatchIdsRef.current,
          source,
        });
      };

      const manualIds = dirtyEntries.filter(([, source]) => source === "manual").map(([matchId]) => matchId);
      const apiIds = dirtyEntries.filter(([, source]) => source === "api").map(([matchId]) => matchId);
      Promise.all([saveDirtyResults(manualIds, "manual"), saveDirtyResults(apiIds, "api")]).catch((error) => {
        dirtyEntries.forEach(([matchId, source]) => markResultDirty(matchId, source));
        logStorageError("Kunde inte spara resultat.", error);
      });
      return;
    }
    window.localStorage.setItem("vm-tipset-results", JSON.stringify(results));
    window.localStorage.setItem("vm-tipset-result-winners", JSON.stringify(resultWinners));
  }, [isDatabaseLoaded, resultWinners, results, storageMode]);

  useEffect(() => {
    if (!currentProfile) return;
    let cancelled = false;

    setLoadedProfileId(undefined);
    window.localStorage.setItem("vm-tipset-active-profile", currentProfile.id);

    const loadProfileData = async () => {
      if (storageMode === "supabase" && isDatabaseLoaded) {
        try {
          await refreshProfilePredictions(currentProfile.id);
          if (cancelled) return;

          const savedBonus = allBonusRef.current[currentProfile.id] ?? defaultBonusAnswers;
          setBonusAnswers(savedBonus);
          return;
        } catch (error) {
          logStorageError("Kunde inte läsa profilens tips från Supabase.", error);
        }
      }

      if (cancelled) return;
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
      setLoadedProfileId(currentProfile.id);
    };

    loadProfileData();
    setActiveTab(currentProfile.role === "admin" ? "Admin" : "Hem");
    return () => {
      cancelled = true;
    };
  }, [currentProfile, isDatabaseLoaded, refreshProfilePredictions, storageMode]);

  useEffect(() => {
    if (!currentProfile || !isDatabaseLoaded) return;
    if (loadedProfileId !== currentProfile.id) return;
    setAllPredictionsByProfile((current) => ({ ...current, [currentProfile.id]: predictions }));
    if (storageMode === "supabase") {
      return;
    }
    window.localStorage.setItem(`vm-tipset-predictions-${currentProfile.id}`, JSON.stringify(predictions));
    window.localStorage.setItem(`vm-tipset-predictions-version-${currentProfile.id}`, predictionsVersion);
  }, [currentProfile, isDatabaseLoaded, loadedProfileId, predictions, storageMode]);

  useEffect(() => {
    if (activeTab !== "Tippa") return;
    const profileId = currentProfile?.id;
    if (!profileId || !isDatabaseLoaded || storageMode !== "supabase") return;
    refreshProfilePredictions(profileId).catch((error) => logStorageError("Kunde inte läsa in tips från Supabase.", error));
  }, [activeTab, currentProfile?.id, isDatabaseLoaded, refreshProfilePredictions, storageMode]);

  useEffect(() => {
    if (!currentProfile || !isDatabaseLoaded) return;
    if (loadedProfileId !== currentProfile.id) return;
    setAllBonusByProfile((current) => ({ ...current, [currentProfile.id]: bonusAnswers }));
    if (storageMode === "supabase") {
      if (suppressRemoteAutosaveRef.current) return;
      saveBonusToDb(currentProfile.id, bonusAnswers).catch((error) => logStorageError("Kunde inte spara bonus.", error));
      return;
    }
    window.localStorage.setItem(`vm-tipset-bonus-${currentProfile.id}`, JSON.stringify(bonusAnswers));
    window.localStorage.setItem(`vm-tipset-bonus-version-${currentProfile.id}`, bonusVersion);
  }, [bonusAnswers, currentProfile, isDatabaseLoaded, loadedProfileId, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    if (storageMode === "supabase") {
      if (suppressRemoteAutosaveRef.current) return;
      saveAppStateToDb("official_bonus", officialBonusAnswers).catch((error) => logStorageError("Kunde inte spara bonusfacit.", error));
      return;
    }
    window.localStorage.setItem("vm-tipset-official-bonus", JSON.stringify(officialBonusAnswers));
  }, [isDatabaseLoaded, officialBonusAnswers, storageMode]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;

    const lockStartedMatches = () => {
      const startedMatchIds = getStartedMatchIds(new Date());
      setLockedMatchIds((current) => uniqueSortedNumbers([...current, ...startedMatchIds]));
    };

    lockStartedMatches();
    const timer = window.setInterval(lockStartedMatches, 60_000);
    return () => window.clearInterval(timer);
  }, [isDatabaseLoaded]);

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    let cancelled = false;

    const syncMatches = async () => {
      try {
        const resolvedKnockout = buildResolvedKnockoutFixtures({
          sourceResults: resultsRef.current,
          lockedDates: lockedDatesRef.current,
          lockedMatchIds: lockedMatchIdsRef.current,
          resolveGroupTeams: stageIsLocked("Gruppspel", lockedDatesRef.current, lockedMatchIdsRef.current),
          useSourceResultsForAdvancement: true,
          advancementWinners: resultWinnersRef.current,
        });
        const fixturesToMatch = [
          ...fixtures.filter((fixture) => fixture.stage === "Gruppspel"),
          ...resolvedKnockout.map((fixture) => ({
            ...fixture,
            home: fixture.resolvedHome,
            away: fixture.resolvedAway,
          })),
        ].map((fixture) => ({
          id: fixture.id,
          date: fixture.date,
          home: fixture.home,
          away: fixture.away,
          stage: fixture.stage,
        }));
        const response = await fetch("/api/match-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtures: fixturesToMatch }),
          cache: "no-store",
        });
        const payload = (await response.json()) as MatchSyncPayload;
        if (cancelled) return;

        const getUnprotectedEntries = <T,>(record: Record<number, T>) => {
          const manualOverrideIds = new Set(manualResultOverrideMatchIdsRef.current);
          return Object.entries(record).filter(([matchId]) => !manualOverrideIds.has(Number(matchId)));
        };
        const syncedResults = Object.fromEntries(getUnprotectedEntries(payload.results)) as Record<number, ScoreLine>;
        const syncedResultWinners = Object.fromEntries(getUnprotectedEntries(payload.resultWinners)) as Record<number, string>;

        if (currentProfile?.role === "admin") {
          Object.keys(syncedResults).forEach((matchId) => markResultDirty(Number(matchId), "api"));
        }
        setLockedMatchIds((current) => uniqueSortedNumbers([...current, ...payload.lockedMatchIds]));
        setResults((current) => ({ ...current, ...syncedResults }));
        setResultWinners((current) => ({ ...current, ...syncedResultWinners }));
        const syncTime = new Date(payload.syncedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
        setMatchSyncMessage(payload.ok ? payload.message ?? `Synkat ${syncTime}` : payload.message ?? "");
      } catch (error) {
        if (!cancelled) {
          setMatchSyncMessage("Kunde inte synka matchresultat just nu.");
          logStorageError("Kunde inte synka matchresultat.", error);
        }
      }
    };

    const syncWhenDue = () => {
      const interval = getMatchSyncInterval(new Date());
      if (!interval) return;

      const now = Date.now();
      if (now - lastMatchSyncAtRef.current < interval) return;
      lastMatchSyncAtRef.current = now;
      syncMatches();
    };

    syncWhenDue();
    const timer = window.setInterval(syncWhenDue, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentProfile?.role, isDatabaseLoaded]);

  const predictionScore = useMemo(
    () =>
      scorePredictions(
        predictions,
        results,
        lockedDates,
        resultWinners,
        bonusAnswers,
        officialBonusAnswers,
        undefined,
        lockedMatchIds,
      ).points,
    [bonusAnswers, lockedDates, lockedMatchIds, officialBonusAnswers, predictions, resultWinners, results],
  );

  const dashboardNow = useMemo(() => new Date(clockTick), [clockTick]);
  const bonusLocked = useMemo(() => isBonusLocked(dashboardNow, lockedDates, lockedMatchIds), [dashboardNow, lockedDates, lockedMatchIds]);
  const tournamentCountdown = useMemo(() => getTournamentCountdown(dashboardNow), [dashboardNow]);
  const next = useMemo(() => getDashboardNextFixture(homePreviewDate || undefined, dashboardNow), [dashboardNow, homePreviewDate]);
  const matchDayPanel = useMemo(() => getMatchDayPanel(homePreviewDate || undefined, dashboardNow), [dashboardNow, homePreviewDate]);
  const predictedResults = useMemo(
    () =>
      predictions.reduce<Record<number, ScoreLine>>((resultMap, prediction) => {
        if (prediction.score) resultMap[prediction.matchId] = prediction.score;
        return resultMap;
      }, {}),
    [predictions],
  );
  const thirdPlaced = rankThirdPlaced(results).slice(0, 8);
  const visibleTabs = currentProfile?.role === "admin" ? tabs : tabs.filter((tab) => tab !== "Admin");
  const phaseStatus = useMemo(() => getPhaseStatus(lockedDates, lockedMatchIds), [lockedDates, lockedMatchIds]);
  const dailyScoreData = useMemo(
    () => buildDailyScoreData(predictions, results, lockedDates, resultWinners, lockedMatchIds),
    [lockedDates, lockedMatchIds, predictions, resultWinners, results],
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
        lockedMatchIds,
      ),
    [
      allBonusByProfile,
      allPredictionsByProfile,
      bonusAnswers,
      currentProfile?.id,
      lockedDates,
      lockedMatchIds,
      officialBonusAnswers,
      predictions,
      profiles,
      resultWinners,
      results,
    ],
  );
  const topThree = liveLeaderboard.slice(0, 3);
  const currentProfileScore = liveLeaderboard.find((user) => user.id === currentProfile?.id)?.points ?? predictionScore;
  const tournamentComplete = useMemo(
    () => fixtures.every((fixture) => isFixtureLocked(fixture, lockedDates, lockedMatchIds) && results[fixture.id]),
    [lockedDates, lockedMatchIds, results],
  );

  useEffect(() => {
    if (!isDatabaseLoaded) return;
    setWinnersModalDismissed(window.localStorage.getItem("vm-tipset-winners-modal-dismissed") === "true");
  }, [isDatabaseLoaded]);

  useEffect(() => {
    if (tournamentComplete && !winnersModalDismissed) setShowWinnersModal(true);
  }, [tournamentComplete, winnersModalDismissed]);

  useEffect(() => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, [activeTab, currentProfile?.id]);

  function updatePrediction(match: Fixture & Partial<ResolvedKnockoutFixture>, side: "home" | "away", value: number) {
    if (groupStageTipsLocked && match.stage === "Gruppspel") return;
    markPredictionDirty();
    setPredictions((current) => {
      const existingPrediction = current.find((prediction) => prediction.matchId === match.id);
      if (isFixtureLocked(match, lockedDates, lockedMatchIds) && existingPrediction?.score) return current;

      const basePrediction: Prediction = existingPrediction ?? {
        matchId: match.id,
        winner: match.stage === "Gruppspel" ? "Ej tippat" : "Ej valt",
      };
      const score = basePrediction.score ?? { home: 0, away: 0 };
      const nextScore = { ...score, [side]: Number.isNaN(value) ? 0 : value };
      const home = match.resolvedHome ?? match.home;
      const away = match.resolvedAway ?? match.away;
      const winner =
        nextScore.home > nextScore.away
          ? home
          : nextScore.home < nextScore.away
            ? away
            : match.stage === "Gruppspel"
              ? "Oavgjort"
              : basePrediction.winner && [home, away].includes(basePrediction.winner)
                ? basePrediction.winner
                : "Ej valt";
      const nextPrediction = { ...basePrediction, score: nextScore, winner };

      if (!existingPrediction) return [...current, nextPrediction];
      return current.map((prediction) => (prediction.matchId === match.id ? nextPrediction : prediction));
    });
  }

  function updatePredictionWinner(match: Fixture, winner: string) {
    markPredictionDirty();
    setPredictions((current) => {
      const existingPrediction = current.find((prediction) => prediction.matchId === match.id);
      if (isFixtureLocked(match, lockedDates, lockedMatchIds) && existingPrediction?.score) return current;

      if (current.some((prediction) => prediction.matchId === match.id)) {
        return current.map((prediction) => {
          if (prediction.matchId !== match.id) return prediction;
          return { ...prediction, winner };
        });
      }

      return [...current, { matchId: match.id, winner }];
    });
  }

  function updateBonusAnswer(key: keyof BonusPrediction, value: string) {
    if (bonusLocked) return;
    setBonusAnswers((current) => updateBonusValue(current, key, value));
  }

  function updateOfficialBonusAnswer(key: keyof BonusPrediction, value: string) {
    setOfficialBonusAnswers((current) => updateBonusValue(current, key, value));
  }

  function saveCurrentPredictions() {
    if (!currentProfile) return;
    if (storageMode === "supabase") {
      savePredictionsToDb(currentProfile.id, predictions)
        .then(() => refreshProfilePredictions(currentProfile.id, { forceApply: true }))
        .then(() => {
          window.alert("Tipset är sparat.");
        })
        .catch((error) => {
          logStorageError("Kunde inte spara tips.", error);
          window.alert("Kunde inte spara tipset. Försök igen.");
        });
      return;
    }

    window.localStorage.setItem(`vm-tipset-predictions-${currentProfile.id}`, JSON.stringify(predictions));
    window.localStorage.setItem(`vm-tipset-predictions-version-${currentProfile.id}`, predictionsVersion);
    window.alert("Tipset är sparat.");
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
      playerProfiles.map((profile) => [profile.id, randomPredictionsForFixtures(randomResults, randomResultWinners)]),
    );

    playerProfiles.forEach((profile) => {
      const profilePredictions = randomPredictionsByProfile[profile.id];
      if (storageMode === "supabase") {
        savePredictionsToDb(profile.id, profilePredictions).catch((error) => logStorageError("Kunde inte spara slumpade tips.", error));
        saveBonusToDb(profile.id, defaultBonusAnswers).catch((error) => logStorageError("Kunde inte spara slumpad bonus.", error));
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
    setLockedMatchIds(fixtures.map((fixture) => fixture.id));
  }

  function randomizeResultsAndLockOnly() {
    const confirmed = window.confirm("Slumpa bara riktiga resultat och lås alla matcher? Spelarnas tips ändras inte.");
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

    const allLockedMatchIds = fixtures.map((fixture) => fixture.id);
    if (storageMode === "supabase") {
      saveResultsToDb(randomResults, randomResultWinners, { source: "manual" }).catch((error) =>
        logStorageError("Kunde inte spara slumpade resultat.", error),
      );
      saveAppStateToDb("locked_dates", allLockedDates).catch((error) => logStorageError("Kunde inte spara låsta dagar.", error));
      saveAppStateToDb("locked_match_ids", allLockedMatchIds).catch((error) => logStorageError("Kunde inte spara låsta matcher.", error));
      saveAppStateToDb("manual_result_override_match_ids", allLockedMatchIds).catch((error) =>
        logStorageError("Kunde inte spara manuella resultatlås.", error),
      );
    } else {
      window.localStorage.setItem("vm-tipset-results", JSON.stringify(randomResults));
      window.localStorage.setItem("vm-tipset-result-winners", JSON.stringify(randomResultWinners));
      window.localStorage.setItem("vm-tipset-locked-dates", JSON.stringify(allLockedDates));
      window.localStorage.setItem("vm-tipset-locked-match-ids", JSON.stringify(allLockedMatchIds));
      window.localStorage.setItem("vm-tipset-manual-result-overrides", JSON.stringify(allLockedMatchIds));
    }

    setResults(randomResults);
    setResultWinners(randomResultWinners);
    setLockedDates(allLockedDates);
    setLockedMatchIds(allLockedMatchIds);
    setManualResultOverrideMatchIds(allLockedMatchIds);
  }

  function resetResultsAndLocksOnly() {
    const confirmed = window.confirm("Nolla bara resultat och låsningar? Spelarnas tips och bonusar ändras inte.");
    if (!confirmed) return;

    if (storageMode === "supabase") {
      saveResultsToDb({}, {}, { allowDeleteAll: true }).catch((error) => logStorageError("Kunde nollställa adminresultat.", error));
      saveAppStateToDb("locked_dates", []).catch((error) => logStorageError("Kunde nollställa låsta dagar.", error));
      saveAppStateToDb("locked_match_ids", []).catch((error) => logStorageError("Kunde nollställa låsta matcher.", error));
      saveAppStateToDb("manual_result_override_match_ids", []).catch((error) => logStorageError("Kunde nollställa manuella resultatlås.", error));
      saveAppStateToDb("group_stage_tips_locked", false).catch((error) => logStorageError("Kunde nollställa gruppspelslås.", error));
    } else {
      window.localStorage.setItem("vm-tipset-results", JSON.stringify({}));
      window.localStorage.setItem("vm-tipset-result-winners", JSON.stringify({}));
      window.localStorage.setItem("vm-tipset-locked-dates", JSON.stringify([]));
      window.localStorage.setItem("vm-tipset-locked-match-ids", JSON.stringify([]));
      window.localStorage.setItem("vm-tipset-manual-result-overrides", JSON.stringify([]));
      window.localStorage.setItem("vm-tipset-group-stage-tips-locked", JSON.stringify(false));
    }

    setResults({});
    setResultWinners({});
    setLockedDates([]);
    setLockedMatchIds([]);
    setManualResultOverrideMatchIds([]);
    setGroupStageTipsLocked(false);
  }

  function resetDevData() {
    const confirmed = window.confirm("Nollställ devdata: töm alla tips, töm adminresultat och lås upp alla dagar?");
    if (!confirmed) return;

    if (storageMode === "supabase") {
      saveResultsToDb({}, {}, { allowDeleteAll: true }).catch((error) => logStorageError("Kunde nollställa adminresultat.", error));
      saveAppStateToDb("locked_dates", []).catch((error) => logStorageError("Kunde nollställa låsta dagar.", error));
      saveAppStateToDb("locked_match_ids", []).catch((error) => logStorageError("Kunde nollställa låsta matcher.", error));
      saveAppStateToDb("manual_result_override_match_ids", []).catch((error) => logStorageError("Kunde nollställa manuella resultatlås.", error));
      saveAppStateToDb("group_stage_tips_locked", false).catch((error) => logStorageError("Kunde nollställa gruppspelslås.", error));
      saveAppStateToDb("official_bonus", defaultBonusAnswers).catch((error) => logStorageError("Kunde nollställa bonusfacit.", error));
    } else {
      window.localStorage.setItem("vm-tipset-results", JSON.stringify({}));
      window.localStorage.setItem("vm-tipset-result-winners", JSON.stringify({}));
      window.localStorage.setItem("vm-tipset-locked-dates", JSON.stringify([]));
      window.localStorage.setItem("vm-tipset-locked-match-ids", JSON.stringify([]));
      window.localStorage.setItem("vm-tipset-manual-result-overrides", JSON.stringify([]));
      window.localStorage.setItem("vm-tipset-group-stage-tips-locked", JSON.stringify(false));
      window.localStorage.setItem("vm-tipset-official-bonus", JSON.stringify(defaultBonusAnswers));
    }

    profiles.forEach((profile) => {
      if (storageMode === "supabase") {
        saveBonusToDb(profile.id, defaultBonusAnswers).catch((error) => logStorageError("Kunde inte nollställa bonus.", error));
      } else {
        window.localStorage.setItem(`vm-tipset-predictions-${profile.id}`, JSON.stringify(defaultPredictions));
        window.localStorage.setItem(`vm-tipset-predictions-version-${profile.id}`, predictionsVersion);
        window.localStorage.setItem(`vm-tipset-bonus-${profile.id}`, JSON.stringify(defaultBonusAnswers));
        window.localStorage.setItem(`vm-tipset-bonus-version-${profile.id}`, bonusVersion);
      }
    });

    const profileIds = profiles.map((profile) => profile.id);
    setAllPredictionsByProfile((current) => ({
      ...current,
      ...Object.fromEntries(profileIds.map((profileId) => [profileId, defaultPredictions])),
    }));
    setAllBonusByProfile((current) => ({
      ...current,
      ...Object.fromEntries(profileIds.map((profileId) => [profileId, defaultBonusAnswers])),
    }));
    setPredictions(defaultPredictions);
    setBonusAnswers(defaultBonusAnswers);
    setOfficialBonusAnswers(defaultBonusAnswers);
    setResults({});
    setResultWinners({});
    setLockedDates([]);
    setLockedMatchIds([]);
    setManualResultOverrideMatchIds([]);
    setGroupStageTipsLocked(false);
  }

  function updateResult(matchId: number, side: "home" | "away", value: number) {
    addManualResultOverride(matchId);
    markResultDirty(matchId);
    setResults((current) => ({
      ...current,
      [matchId]: { ...(current[matchId] ?? { home: 0, away: 0 }), [side]: Number.isNaN(value) ? 0 : value },
    }));
  }

  function updateResultWinner(matchId: number, winner: string) {
    addManualResultOverride(matchId);
    markResultDirty(matchId);
    setResultWinners((current) => {
      const next = { ...current };
      if (winner) next[matchId] = winner;
      else delete next[matchId];
      return next;
    });
  }

  function clearManualResultOverride(matchId: number) {
    updateManualResultOverrideIds((current) => current.filter((id) => id !== matchId));
  }

  function toggleLockedDate(date: string) {
    const dayMatchIds = fixtures.filter((fixture) => fixture.date === date).map((fixture) => fixture.id);
    const shouldUnlock = lockedDates.includes(date) || dayMatchIds.every((matchId) => lockedMatchIds.includes(matchId));

    setLockedDates((current) => (shouldUnlock ? current.filter((item) => item !== date) : [...current, date]));
    setLockedMatchIds((current) =>
      shouldUnlock ? current.filter((matchId) => !dayMatchIds.includes(matchId)) : uniqueSortedNumbers([...current, ...dayMatchIds]),
    );
  }

  function toggleLockedMatch(matchId: number) {
    const fixture = fixtures.find((match) => match.id === matchId);
    if (!fixture) return;

    setLockedMatchIds((current) => {
      const isUnlocking = current.includes(matchId);
      const next = isUnlocking ? current.filter((item) => item !== matchId) : uniqueSortedNumbers([...current, matchId]);
      const dayMatchIds = fixtures.filter((match) => match.date === fixture.date).map((match) => match.id);
      const fullDayLocked = dayMatchIds.every((id) => next.includes(id));

      setLockedDates((dates) => {
        if (isUnlocking) return dates.filter((date) => date !== fixture.date);
        return fullDayLocked && !dates.includes(fixture.date) ? [...dates, fixture.date] : dates;
      });

      return next;
    });
  }

  function toggleGroupStageTipsLocked() {
    setGroupStageTipsLocked((current) => !current);
  }

  function openWinnersModal() {
    setShowWinnersModal(true);
  }

  function closeWinnersModal() {
    setShowWinnersModal(false);
    if (tournamentComplete) {
      window.localStorage.setItem("vm-tipset-winners-modal-dismissed", "true");
      setWinnersModalDismissed(true);
    }
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
      saveProfilesToDb([...profiles, profile])
        .then(() => saveBonusToDb(profile.id, defaultBonusAnswers))
        .catch((error) => logStorageError("Kunde inte skapa spelare.", error));
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
    if (!isDatabaseLoaded) {
      return (
        <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 text-white">
          <div className="absolute left-1/2 top-8 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan/20 blur-3xl" />
        </main>
      );
    }

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
    <main className="relative min-h-screen w-full max-w-[100dvw] overflow-x-hidden px-3 pb-20 pt-3 text-white sm:px-6 lg:px-8">
      <div className="absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-volt/20 blur-3xl" />

      <header className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 py-3 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-display text-[10px] uppercase tracking-[0.35em] text-volt sm:text-xs sm:tracking-[0.45em]">VM-Tipset 2026</p>
          <h1 className="mt-2 max-w-4xl font-display text-3xl font-black leading-[0.95] tracking-tight sm:text-4xl lg:text-[3.75rem]">
            Tipsspel för VM 2026
          </h1>
        </motion.div>
        <div className="glass flex w-full flex-wrap items-center gap-3 rounded-3xl p-2 sm:w-auto sm:flex-nowrap">
          <div className="rounded-2xl bg-volt/15 p-3 text-volt">
            <ShieldCheck size={24} />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="text-sm text-white/60">{currentProfile.name}</p>
            {currentProfile.role !== "admin" ? <p className="font-display text-2xl font-bold">{currentProfileScore} p</p> : null}
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

      <nav className="sticky top-2 z-20 mx-auto mb-5 grid w-full max-w-7xl min-w-0 grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-pitch/85 p-2 backdrop-blur-2xl sm:top-3 sm:flex sm:overflow-x-auto sm:rounded-full">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={classNames(
              "min-w-0 whitespace-nowrap rounded-full px-3 py-2.5 text-center text-sm font-bold transition sm:px-4 sm:py-2",
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
          className="mx-auto w-full max-w-7xl min-w-0 overflow-hidden"
        >
          {activeTab === "Hem" && (
            <Dashboard
              next={next}
              topThree={topThree}
              dailyScoreData={dailyScoreData}
              matchDayPanel={matchDayPanel}
              results={results}
              lockedDates={lockedDates}
              lockedMatchIds={lockedMatchIds}
              phaseStatus={phaseStatus}
              tournamentCountdown={tournamentCountdown}
              onOpenStats={() => setActiveTab("Statistik")}
            />
          )}
          {activeTab === "Tippa" && (
            <PredictionsPanel
              predictions={predictions}
              actualResults={results}
              actualResultWinners={resultWinners}
              lockedDates={lockedDates}
              lockedMatchIds={lockedMatchIds}
              groupStageTipsLocked={groupStageTipsLocked}
              bonusAnswers={bonusAnswers}
              bonusLocked={bonusLocked}
              onChange={updatePrediction}
              onWinnerChange={updatePredictionWinner}
              onBonusChange={updateBonusAnswer}
              onSavePredictions={saveCurrentPredictions}
            />
          )}
          {activeTab === "Grupper" && (
            <GroupsPanel
              selectedGroup={selectedGroup}
              setSelectedGroup={setSelectedGroup}
              predictedResults={predictedResults}
              actualResults={results}
              thirdPlaced={thirdPlaced}
            />
          )}
          {activeTab === "Slutspel" && <KnockoutPanel sourceResults={results} lockedDates={lockedDates} lockedMatchIds={lockedMatchIds} resultWinners={resultWinners} />}
          {activeTab === "Andras tips" && (
            <OtherPredictionsPanel
              profiles={profiles}
              currentProfile={currentProfile}
              allPredictionsByProfile={allPredictionsByProfile}
              allBonusByProfile={allBonusByProfile}
              lockedDates={lockedDates}
              lockedMatchIds={lockedMatchIds}
              bonusLocked={bonusLocked}
              actualResults={results}
              actualResultWinners={resultWinners}
            />
          )}
          {activeTab === "Admin" && (
            <AdminPanel
              results={results}
              resultWinners={resultWinners}
              manualResultOverrideMatchIds={manualResultOverrideMatchIds}
              updateResult={updateResult}
              updateResultWinner={updateResultWinner}
              clearManualResultOverride={clearManualResultOverride}
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
              randomizeResultsAndLockOnly={randomizeResultsAndLockOnly}
              resetResultsAndLocksOnly={resetResultsAndLocksOnly}
              resetDevData={resetDevData}
              openWinnersModal={openWinnersModal}
              lockedDates={lockedDates}
              lockedMatchIds={lockedMatchIds}
              groupStageTipsLocked={groupStageTipsLocked}
              toggleLockedDate={toggleLockedDate}
              toggleLockedMatch={toggleLockedMatch}
              toggleGroupStageTipsLocked={toggleGroupStageTipsLocked}
              matchSyncMessage={matchSyncMessage}
              databaseSyncMessage={databaseSyncMessage}
              isDatabaseSyncing={isDatabaseSyncing}
              refreshSupabaseData={refreshSupabaseData}
              homePreviewDate={homePreviewDate}
              setHomePreviewDate={setHomePreviewDate}
              officialBonusAnswers={officialBonusAnswers}
              updateOfficialBonusAnswer={updateOfficialBonusAnswer}
            />
          )}
          {activeTab === "Statistik" && (
            <StatsPanel
              leaderboardRows={liveLeaderboard}
              profiles={profiles}
              currentProfileId={currentProfile?.id}
              activePredictions={predictions}
              storedPredictions={allPredictionsByProfile}
              results={results}
              lockedDates={lockedDates}
              lockedMatchIds={lockedMatchIds}
              resultWinners={resultWinners}
            />
          )}
        </motion.section>
      </AnimatePresence>
      <AnimatePresence>
        {showWinnersModal && <WinnersModal leaderboardRows={liveLeaderboard} onClose={closeWinnersModal} />}
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
  const [isMobileAuthLayout, setIsMobileAuthLayout] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const updateLayout = () => setIsMobileAuthLayout(media.matches);
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

  const authPrompt = authProfile ? (
    <AuthPromptContent
      authProfile={authProfile}
      authPassword={authPassword}
      authError={authError}
      setAuthPassword={setAuthPassword}
      unlockProfile={unlockProfile}
      autoFocus={isMobileAuthLayout}
    />
  ) : null;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 text-white">
      <div className="absolute left-1/2 top-8 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan/20 blur-3xl" />
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="profile-gate-panel neon-border rounded-[2rem]"
      >
        <div className="glass rounded-[2rem] p-6 sm:p-8">
          <p className="font-display text-xs uppercase tracking-[0.45em] text-volt">VM-Tipset 2026</p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">Vem tippar?</h1>
          <p className="mt-3 max-w-2xl text-white/65">
            Välj ditt namn, eller skapa en ny spelare.
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
                  {profile.role === "admin" ? <Settings size={20} /> : profile.initials}
                </div>
                <p className="mt-5 font-display text-xl font-black">{profile.name}</p>
                <p className="mt-1 text-sm text-white/50">
                  {profile.passwordHash ? "Lösenord krävs" : "Sätt lösenord"}
                </p>
              </button>
            ))}
          </div>

          {authPrompt && !isMobileAuthLayout ? (
            <div className="mt-6 rounded-3xl border border-cyan/30 bg-cyan/10 p-4">{authPrompt}</div>
          ) : null}

          <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createPlayer();
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-volt"
              placeholder="Skapa ny spelare, t.ex. Anders"
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
      <AnimatePresence>
        {authPrompt && isMobileAuthLayout ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.section
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="relative w-full max-w-md rounded-3xl border border-cyan/30 bg-pitch/95 p-4 shadow-2xl"
            >
              <button
                onClick={closeAuth}
                aria-label="Stäng lösenordsruta"
                className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
              >
                <X size={18} />
              </button>
              {authPrompt}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function AuthPromptContent({
  authProfile,
  authPassword,
  authError,
  setAuthPassword,
  unlockProfile,
  autoFocus,
}: {
  authProfile: PlayerProfile;
  authPassword: string;
  authError: string;
  setAuthPassword: (value: string) => void;
  unlockProfile: () => void;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [authProfile.id, autoFocus]);

  return (
    <>
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
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          ref={inputRef}
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
    </>
  );
}

function Dashboard({
  next,
  topThree,
  dailyScoreData,
  matchDayPanel,
  results,
  lockedDates,
  lockedMatchIds,
  phaseStatus,
  tournamentCountdown,
  onOpenStats,
}: {
  next: Fixture;
  topThree: UserScore[];
  dailyScoreData: DailyScoreDay[];
  matchDayPanel: { label: string; date: string; matches: Fixture[] };
  results: Record<number, ScoreLine>;
  lockedDates: string[];
  lockedMatchIds: number[];
  phaseStatus: ReturnType<typeof getPhaseStatus>;
  tournamentCountdown: ReturnType<typeof getTournamentCountdown>;
  onOpenStats: () => void;
}) {
  return (
    <div className="grid w-full min-w-0 max-w-full gap-5">
      <div className="grid w-full min-w-0 max-w-full gap-4 lg:hidden">
        <section className="glass w-full min-w-0 max-w-full rounded-[1.5rem] p-4 ring-1 ring-volt/25">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan">Live leaderboard</p>
          <div className="mt-4 space-y-3">
            {topThree.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className={classNames(
                  "grid min-w-0 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border p-3",
                  index === 0 ? "border-volt/50 bg-volt/10" : "border-white/10 bg-white/5",
                )}
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 font-display font-black">
                  {user.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white/45">#{index + 1}</p>
                  <h2 className="truncate font-display text-lg font-black">{user.name}</h2>
                  <p className="flex items-center gap-1 text-xs text-white/55">
                    <ChevronUp size={14} className="text-volt" />
                    {user.exact} exakta resultat
                  </p>
                </div>
                <div className="text-right">
                  <div className="ml-auto">
                    <PodiumIcon index={index} size={18} />
                  </div>
                  <p className="mt-1 font-display text-2xl font-black text-volt">{user.points}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-volt">Poäng per dag</p>
              <p className="mt-1 text-xs text-white/50">Räknas när matcherna är färdigspelade.</p>
            </div>
            <p className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/65">
              {dailyScoreData[dailyScoreData.length - 1]?.points ?? 0} p
            </p>
          </div>
          <PointsAreaChart data={dailyScoreData} heightClass="h-44" />
        </section>

        <DailyPointsCard dailyScoreData={dailyScoreData} onOpenStats={onOpenStats} />

        <Metric
          icon={<CalendarClock />}
          label="Nästa match"
          value={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>{formatDate(next.date)} {next.kickoffTime}</span>
              <TeamLabel team={next.home} />
              <span>-</span>
              <TeamLabel team={next.away} />
            </span>
          }
        />

        <div className="glass w-full min-w-0 max-w-full rounded-[1.5rem] p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">{matchDayPanel.label}</p>
              <p className="mt-1 text-sm text-white/45">{formatDate(matchDayPanel.date)} · svensk tid</p>
            </div>
            <p className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">{matchDayPanel.matches.length}</p>
          </div>
          <div className="mt-4 space-y-2">
            {matchDayPanel.matches.map((match) => {
              const result = isFixtureLocked(match, lockedDates, lockedMatchIds) ? results[match.id] : undefined;

              return (
                <div key={match.id} className="rounded-2xl bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-lg font-black text-volt">{match.kickoffTime}</p>
                    {result ? (
                      <p className="rounded-full bg-volt/10 px-3 py-1 font-display text-lg font-black text-volt">
                        {formatScoreLine(result)}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-bold"><TeamLabel team={match.home} /></p>
                  <p className="truncate font-bold"><TeamLabel team={match.away} /></p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden w-full min-w-0 max-w-full items-start gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.58fr)] lg:gap-5">
        <section className="glass relative w-full min-w-0 max-w-full rounded-[1.5rem] p-4 ring-1 ring-volt/25 sm:rounded-[2rem] sm:p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan sm:text-sm sm:tracking-[0.35em]">Live leaderboard</p>
            <div className="mt-4 grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3 lg:gap-3">
              {topThree.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={classNames(
                    "w-full min-w-0 max-w-full rounded-[1.35rem] border p-4 sm:rounded-3xl sm:p-4.5",
                    index === 0 ? "border-volt/50 bg-volt/10 shadow-glow" : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 font-display font-black">
                      {user.avatar}
                    </div>
                    <PodiumIcon index={index} />
                  </div>
                  <p className="mt-4 text-xs text-white/60 sm:text-sm">#{index + 1}</p>
                  <h2 className="font-display text-lg font-black sm:text-xl">{user.name}</h2>
                  <p className="mt-2 text-2xl font-black text-volt sm:text-[2.6rem]">{user.points}</p>
                  <p className="flex items-center gap-1 text-xs text-white/60 sm:text-sm">
                    <ChevronUp size={16} className="text-volt" />
                    {user.exact} exakta resultat
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm">Poäng per dag</p>
                <p className="text-sm text-white/50">Poäng räknas när matcherna är färdigspelade.</p>
              </div>
              <p className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/65">
                {dailyScoreData[dailyScoreData.length - 1]?.points ?? 0} p totalt
              </p>
            </div>
            <PointsAreaChart data={dailyScoreData} heightClass="h-40 sm:h-52" />
        </section>


        <aside className="grid w-full min-w-0 max-w-full content-start gap-5 overflow-hidden">
        <TournamentStatusPanel phaseStatus={phaseStatus} tournamentCountdown={tournamentCountdown} />
        <DailyPointsCard dailyScoreData={dailyScoreData} onOpenStats={onOpenStats} />
        <Metric
          icon={<CalendarClock />}
          label="Nästa match"
          value={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>{formatDate(next.date)} {next.kickoffTime}</span>
              <TeamLabel team={next.home} />
              <span>-</span>
              <TeamLabel team={next.away} />
            </span>
          }
        />
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">{matchDayPanel.label}</p>
              <p className="mt-1 text-sm text-white/45">{formatDate(matchDayPanel.date)} · svensk tid</p>
            </div>
            <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">{matchDayPanel.matches.length}</p>
          </div>
          <div className="mt-4 space-y-3">
            {matchDayPanel.matches.map((match) => {
              const result = isFixtureLocked(match, lockedDates, lockedMatchIds) ? results[match.id] : undefined;

              return (
                <div key={match.id} className="grid grid-cols-[48px_1fr] gap-2 rounded-2xl bg-white/5 p-3 text-sm sm:grid-cols-[52px_1fr_auto_1fr] sm:items-center">
                  <span className="font-display font-black text-volt">{match.kickoffTime}</span>
                  <span className="font-bold"><TeamLabel team={match.home} /></span>
                  <span className={classNames("hidden font-display font-black sm:block", result ? "text-volt" : "text-white/40")}>
                    {result ? formatScoreLine(result) : "vs"}
                  </span>
                  <span className="col-start-2 font-bold sm:col-auto sm:text-right"><TeamLabel team={match.away} /></span>
                </div>
              );
            })}
          </div>
        </div>
        </aside>
      </div>

      <RulesPanel />
    </div>
  );
}

function DailyPointsCard({ dailyScoreData, onOpenStats }: { dailyScoreData: DailyScoreDay[]; onOpenStats: () => void }) {
  const todayKey = getSwedishDateKey();
  const todayMatches = getMatchesByDate(todayKey);
  const todayDay = dailyScoreData.find((day) => day.dateKey === todayKey && day.matches.length > 0);
  const hasMatchesToday = todayMatches.length > 0;
  const todayLabel = formatDate(todayKey);

  return (
    <section className="glass w-full min-w-0 max-w-full overflow-hidden rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">Dagens poäng</p>
          <h2 className="mt-2 font-display text-xl font-black sm:text-2xl">
            {todayDay ? `${todayDay.dayPoints} poäng` : "0 poäng idag"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {hasMatchesToday
              ? `${todayLabel} · ${todayDay?.matches.length ?? 0}/${todayMatches.length} matcher avräknade.`
              : `${todayLabel} · inga matcher idag.`}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-volt/10 px-4 py-2 text-right">
          <p className="font-display text-2xl font-black text-volt">+{todayDay?.dayPoints ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">idag</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenStats}
        className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/75 transition hover:bg-volt hover:text-pitch"
      >
        Visa detaljer i Statistik
      </button>
    </section>
  );
}

function TournamentStatusPanel({
  phaseStatus,
  tournamentCountdown,
}: {
  phaseStatus: ReturnType<typeof getPhaseStatus>;
  tournamentCountdown: ReturnType<typeof getTournamentCountdown>;
}) {
  if (tournamentCountdown.hasStarted) {
    return (
      <div className="glass hidden rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5 lg:block">
        <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">Aktuell fas</p>
        <h2 className="mt-2 font-display text-xl font-black sm:text-2xl">{phaseStatus.label}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{phaseStatus.description}</p>
        <p className="mt-4 rounded-full bg-volt/10 px-4 py-2 text-sm font-bold text-volt">Öppet: {phaseStatus.openLabel}</p>
      </div>
    );
  }

  return (
    <div className="glass hidden w-full min-w-0 max-w-full overflow-hidden rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5 lg:block">
      <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">Nedräkning</p>
      <h2 className="mt-2 font-display text-xl font-black sm:text-2xl">VM börjar snart</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Första matchen startar {formatDate(fixtures[0].date)} {fixtures[0].kickoffTime}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {tournamentCountdown.parts.map((part) => (
          <div key={part.label} className="min-w-0 rounded-2xl bg-volt/10 px-2 py-3 text-center">
            <p className="font-display text-xl font-black text-volt">{String(part.value).padStart(2, "0")}</p>
            <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{part.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="glass flex items-center gap-3 rounded-[1.5rem] p-4 sm:gap-4 sm:rounded-[2rem] sm:p-4.5">
      <div className="shrink-0 rounded-2xl bg-cyan/15 p-3 text-cyan">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-white/50 sm:text-sm">{label}</p>
        <p className="break-words font-display text-sm font-bold sm:text-base">{value}</p>
      </div>
    </div>
  );
}

function PointsAreaChart({ data, heightClass }: { data: DailyScoreDay[]; heightClass: string }) {
  return (
    <div className={classNames("mt-4 w-full min-w-0 max-w-full overflow-hidden", heightClass)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -28 }}>
          <defs>
            <linearGradient id="score" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#7CFF6B" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#7CFF6B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="date" stroke="rgba(255,255,255,.55)" tick={{ fontSize: 11 }} tickMargin={6} />
          <YAxis stroke="rgba(255,255,255,.55)" tick={{ fontSize: 11 }} width={34} />
          <Tooltip contentStyle={{ background: "#06130f", border: "1px solid rgba(255,255,255,.12)" }} />
          <Area name="Totalpoäng" type="monotone" dataKey="points" stroke="#7CFF6B" fill="url(#score)" strokeWidth={3} />
          <Area name="Dagspoäng" type="monotone" dataKey="dayPoints" stroke="#55D6FF" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function WinnersModal({ leaderboardRows, onClose }: { leaderboardRows: UserScore[]; onClose: () => void }) {
  const podium = leaderboardRows.slice(0, 3);
  const podiumLayout = [
    { index: 1, place: 2, height: "h-28 sm:h-36", label: "Silver" },
    { index: 0, place: 1, height: "h-36 sm:h-48", label: "Vinnare" },
    { index: 2, place: 3, height: "h-24 sm:h-32", label: "Brons" },
  ];

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <motion.section
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="profile-gate-panel glass relative max-h-[92vh] overflow-hidden rounded-[1.75rem] border-volt/25 sm:rounded-[2rem]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />

        <div className="max-h-[92vh] overscroll-contain overflow-y-auto">
          <button
            onClick={onClose}
            aria-label="Stäng vinnarruta"
            className="sticky right-4 top-4 z-30 ml-auto mr-4 grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <X size={22} />
          </button>

          <div className="-mt-11 px-4 pb-4 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
            <p className="text-xs uppercase tracking-[0.32em] text-volt sm:text-sm">VM-Tipset är avgjort</p>
            <h2 className="mt-2 pr-12 font-display text-3xl font-black sm:text-5xl">Prispallen</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
              Slutresultatet är sammanräknat. Här är vinnarna och hela slutställningen.
            </p>

            <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
              {podiumLayout.map(({ index, place, height, label }) => {
                const user = podium[index];
                if (!user) return <div key={place} />;

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + index * 0.08, duration: 0.34, ease: "easeOut" }}
                    className="grid min-w-0 gap-3 text-center"
                  >
                    <div className="mx-auto">
                      <PodiumIcon index={index} size={index === 0 ? 34 : 28} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">{label}</p>
                      <p className="truncate font-display text-lg font-black sm:text-2xl">{user.name}</p>
                      <p className="font-display text-3xl font-black text-volt sm:text-5xl">{user.points}</p>
                    </div>
                    <div
                      className={classNames(
                        "grid place-items-center rounded-t-[1.25rem] border border-white/10 bg-white/10 font-display text-3xl font-black text-white/70",
                        place === 1 && "border-volt/35 bg-volt/15 text-volt",
                        height,
                      )}
                    >
                      #{place}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-4 sm:px-8 sm:py-6">
            <h3 className="font-display text-xl font-black">Slutställning</h3>
            <div className="mt-3 grid gap-2">
              {leaderboardRows.map((user, index) => (
                <div key={user.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
                  <span className="w-8 text-sm font-bold text-white/45">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{user.name}</p>
                    <p className="text-xs text-white/45">{user.exact} exakta resultat</p>
                  </div>
                  <p className="font-display text-xl font-black text-volt">{user.points}p</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function RulesPanel() {
  const matchRules: Array<[string, string | string[]]> = [
    ["Rätt tecken (1X2)", "3 poäng"],
    ["Rätt målskillnad", "+1 poäng"],
    ["Rätt antal mål per lag", "+1 poäng per lag"],
    ["Exakt resultat", "+3 poäng"],
    ["Max per gruppspelsmatch", "8 poäng"],
  ];
  const knockoutRules: Array<[string, string | string[]]> = [
    ["Rätt lag vidare", "5 poäng"],
    ["Rätt fulltidstecken", "3 poäng"],
    ["Exakt fulltidresultat", "+3 poäng"],
    ["Multiplikatorer", ["16-del x1", "8-del x1.25", "kvart x1.5", "semi x2", "brons x1.5", "final x2"]],
  ];
  const bonusRules: Array<[string, string | string[]]> = [
    ["Världsmästare", "15 poäng"],
    ["Skytteligavinnare", "10 poäng"],
    ["Flest mål i gruppspel (lag)", "8 poäng"],
    ["Flest kort i gruppspelet (lag)", "5 poäng"],
    ["Närmast totalt antal mål i turneringen", "8 poäng"],
    ["Bästa poänggörare i turneringen", "8 poäng"],
    ["Tar sig längst (darkhorse)", "8 poäng"],
    ["Största segermarginalen i en match", "5 poäng"],
  ];
  const ruleSection = (title: string, rows: Array<[string, string | string[]]>) => (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-black/20 p-3.5">
      <h3 className="font-display text-base font-black text-volt sm:text-lg">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={classNames(
              "grid gap-1 rounded-2xl bg-white/[0.04] px-3 py-2 text-xs sm:items-start sm:gap-4 sm:text-sm",
              Array.isArray(value) ? "sm:grid-cols-1" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]",
            )}
          >
            <span className="text-white/75">{label}</span>
            {Array.isArray(value) ? (
              <span className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {value.map((item) => {
                  const [round, multiplier] = item.split(" x");
                  return (
                    <span
                      key={item}
                      className="min-h-[68px] rounded-2xl border border-volt/20 bg-volt/10 px-3 py-2.5 text-center"
                    >
                      <span className="block whitespace-nowrap text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
                        {round}
                      </span>
                      <span className="mt-2 block font-display text-lg font-black text-volt">
                        x{multiplier}
                      </span>
                    </span>
                  );
                })}
              </span>
            ) : (
              value && <span className="font-bold leading-relaxed text-white sm:text-right">{value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  const clarificationSections = [
    {
      title: "Gruppspel",
      items: [
        "Rätt tecken (1X2) ger 3 poäng.",
        "Rätt målskillnad ger 1 poäng.",
        "Rätt antal mål för respektive lag ger 1 poäng per lag.",
        "Exakt resultat ger ytterligare 3 poäng.",
        "Maxpoäng per gruppspelsmatch är 8 poäng.",
      ],
    },
    {
      title: "Slutspel",
      items: [
        "Fulltidsresultat avser resultatet efter ordinarie tid (90 minuter + tilläggstid).",
        "Rätt lag vidare räknas efter ordinarie tid, förlängning eller straffläggning.",
        "Poäng för Rätt fulltidstecken och Exakt fulltidsresultat baseras alltid på resultatet efter ordinarie tid.",
        "Slutspelspoängen multipliceras enligt respektive rundas multiplikator.",
      ],
    },
    {
      title: "Bonus",
      items: [
        "Bonuspoäng delas ut när facit för respektive kategori är fastställt.",
        "Bonuskategorierna räknas inte in förrän administratören har registrerat facit.",
        "Om flera lag delar rätt svar kan admin skriva dem med snedstreck, till exempel USA/Kanada.",
        "Totalt antal mål ger poäng till den eller de spelare som är närmast facit.",
      ],
    },
    {
      title: "Poängberäkning",
      items: [
        "Poäng delas ut först när administratören har registrerat matchresultatet och låst matchdagen.",
        "Leaderboarden uppdateras automatiskt när poängen har beräknats.",
      ],
    },
  ];

  return (
    <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-flare sm:text-sm sm:tracking-[0.3em]">Regler</p>
          <h2 className="font-display text-2xl font-black sm:text-3xl">Poängsystem</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {ruleSection("Gruppspel", matchRules)}
        {ruleSection("Slutspel", knockoutRules)}
        {ruleSection("Bonus", bonusRules)}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-3xl border border-volt/20 bg-volt/10 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-volt">Exempel gruppspel</p>
          <p className="mt-2 text-xs leading-relaxed text-white/75 sm:text-sm">
            Tippning: <span className="font-black text-white">2-1</span>, matchen slutar{" "}
            <span className="font-black text-white">3-1</span> {"->"} rätt tecken + rätt mål för ett lag ={" "}
            <span className="font-black text-volt">4 poäng</span>.
          </p>
        </div>
        <div className="rounded-3xl border border-flare/20 bg-flare/10 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-flare">Exempel slutspel</p>
          <p className="mt-2 text-xs leading-relaxed text-white/75 sm:text-sm">
            Kvartsfinal, tippning: <span className="font-black text-white">2-1</span> och rätt lag vidare. Matchen slutar{" "}
            <span className="font-black text-white">3-1</span> {"->"} rätt lag vidare 5p + rätt tecken 3p = 8p. Kvartsfinal x1.5 ger{" "}
            <span className="font-black text-flare">12 poäng</span>.
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
        <h3 className="font-display text-lg font-black text-white sm:text-xl">Förtydliganden</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {clarificationSections.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white/[0.04] p-3">
              <h4 className="font-display text-base font-black text-volt sm:text-lg">{section.title}</h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-white/70 sm:text-sm">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function PredictionsPanel({
  predictions,
  actualResults,
  actualResultWinners,
  lockedDates,
  lockedMatchIds,
  groupStageTipsLocked,
  bonusAnswers,
  bonusLocked,
  onChange,
  onWinnerChange,
  onBonusChange,
  onSavePredictions,
}: {
  predictions: Prediction[];
  actualResults: Record<number, ScoreLine>;
  actualResultWinners: Record<number, string>;
  lockedDates: string[];
  lockedMatchIds: number[];
  groupStageTipsLocked: boolean;
  bonusAnswers: BonusPrediction;
  bonusLocked: boolean;
  onChange: (match: Fixture, side: "home" | "away", value: number) => void;
  onWinnerChange: (match: Fixture, winner: string) => void;
  onBonusChange: (key: keyof BonusPrediction, value: string) => void;
  onSavePredictions: () => void;
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
  const groupStageMatches = fixtures.filter((match) => match.stage === "Gruppspel");
  const actualOpenKnockoutStages = getOpenActualKnockoutStages(actualResults, actualResultWinners, lockedDates, lockedMatchIds);
  const actualKnockoutMatches = getResolvedActualKnockoutFixtures(actualResults, actualResultWinners, lockedDates, lockedMatchIds);
  const hasResolvedKnockoutMatches = actualKnockoutMatches.some(isResolvedKnockoutMatch);
  const groupPredictionSummary = groupStageMatches.reduce(
    (summary, match) => {
      const prediction = predictionMap.get(match.id);
      if (!prediction?.score) return summary;

      const homeGoals = prediction.score.home;
      const awayGoals = prediction.score.away;

      summary.totalGoals += homeGoals + awayGoals;
      summary.biggestMargin = Math.max(summary.biggestMargin, Math.abs(homeGoals - awayGoals));
      summary.teamGoals[match.home] = (summary.teamGoals[match.home] ?? 0) + homeGoals;
      summary.teamGoals[match.away] = (summary.teamGoals[match.away] ?? 0) + awayGoals;

      return summary;
    },
    {
      totalGoals: 0,
      biggestMargin: 0,
      teamGoals: {} as Record<string, number>,
    },
  );
  const topGroupGoalTotal = Math.max(0, ...Object.values(groupPredictionSummary.teamGoals));
  const topGroupScorers = Object.entries(groupPredictionSummary.teamGoals)
    .filter(([, goals]) => goals === topGroupGoalTotal)
    .map(([team]) => team)
    .sort((a, b) => a.localeCompare(b, "sv"));

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
                {groupStageTipsLocked
                  ? "Gruppspelet är stängt för nya tips."
                  : stageIsLocked("Gruppspel", lockedDates, lockedMatchIds)
                  ? "Gruppspelet är låst. Du kan fortfarande se dina tips."
                  : "Tippa alla grupper A-L och se tabellerna uppdateras direkt."}
              </p>
            </div>
          </button>

          <button
            onClick={() => setTipMode("knockout")}
            disabled={!hasResolvedKnockoutMatches}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-left transition hover:-translate-y-1 hover:border-flare/50 hover:bg-flare/10 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:rounded-[2rem] sm:p-6"
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-flare/15 text-flare">
              <Trophy />
            </div>
            <p className="mt-6 text-sm uppercase tracking-[0.28em] text-flare">Slutspel</p>
            <h3 className="mt-2 font-display text-3xl font-black">Slutspelsträd</h3>
            <p className="mt-3 text-white/60">
              {hasResolvedKnockoutMatches
                ? `Öppen fas: ${actualOpenKnockoutStages.length > 0 ? actualOpenKnockoutStages.join(" & ") : "ingen"}.`
                : "Öppnas när första slutspelsmatchen har klara lag."}
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
          lockedMatchIds={lockedMatchIds}
          sourceResults={actualResults}
          resultWinners={actualResultWinners}
          resolveTeams={hasResolvedKnockoutMatches}
          openKnockoutStages={actualOpenKnockoutStages}
          onBack={() => setTipMode("menu")}
          onChange={onChange}
          onWinnerChange={onWinnerChange}
          onSavePredictions={onSavePredictions}
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
                    const isLocked = isFixtureLocked(match, lockedDates, lockedMatchIds);
                    const isGroupStageTipsLocked = groupStageTipsLocked && match.stage === "Gruppspel";
                    const hasPredictionScore = Boolean(prediction?.score);
                    const isInputDisabled = isGroupStageTipsLocked || (isLocked && hasPredictionScore);
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
                          <p className="font-bold"><TeamLabel team={match.home} /></p>
                          <p className="text-xs text-white/40">
                            {formatDate(match.date)}
                            {isGroupStageTipsLocked ? " · Stängt för tips" : ""}
                            {isLocked ? " · Låst" : ""}
                          </p>
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-2 py-1 sm:col-span-1 sm:py-0">
                          <ScoreField
                            label={`${match.home} mål`}
                            value={prediction?.score?.home}
                            disabled={isInputDisabled}
                            onChange={(value) => onChange(match, "home", value)}
                          />
                          <span className="text-white/40">-</span>
                          <ScoreField
                            label={`${match.away} mål`}
                            value={prediction?.score?.away}
                            disabled={isInputDisabled}
                            onChange={(value) => onChange(match, "away", value)}
                          />
                        </div>
                        <div className="col-span-2 text-left sm:col-span-1 sm:text-right">
                          <p className="font-bold"><TeamLabel team={match.away} /></p>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan">Bonusfrågor</p>
            {bonusLocked ? (
              <span className="rounded-full bg-flare/10 px-3 py-1 text-xs font-bold text-flare">Låst</span>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {bonusFieldLabels.map((question) => (
              <label key={question.key} className="block">
                <span className="text-sm font-bold leading-relaxed text-white/60">
                  {question.label} · {question.points}
                </span>
                {question.playerInput === "select" ? (
                  <select
                    value={bonusAnswers[question.key] ?? ""}
                    disabled={bonusLocked}
                    onChange={(event) => onBonusChange(question.key, event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none focus:border-cyan disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <option value="">{question.placeholder ?? "Välj"}</option>
                    {question.options?.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={question.type ?? "text"}
                    min={question.type === "number" ? 0 : undefined}
                    value={bonusAnswers[question.key] ?? ""}
                    disabled={bonusLocked}
                    onChange={(event) => onBonusChange(question.key, event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none focus:border-cyan disabled:cursor-not-allowed disabled:opacity-45"
                    placeholder={question.placeholder ?? "Ditt svar"}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-6 rounded-3xl border border-volt/20 bg-volt/10 p-4">
            <h3 className="font-display text-lg font-black text-white">Spara tips</h3>
            <p className="mt-1 text-sm text-white/60">Sparar alla matcher för din profil.</p>
            <button
              onClick={onSavePredictions}
              className="mt-4 w-full rounded-2xl bg-volt px-4 py-3 font-display font-black text-pitch transition hover:brightness-110"
            >
              Spara tips
            </button>
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-volt">Gruppspelssummering</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Tippade mål totalt</p>
              <p className="mt-1 font-display text-2xl font-black text-white">{groupPredictionSummary.totalGoals}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Största segermarginal</p>
              <p className="mt-1 font-display text-2xl font-black text-white">{groupPredictionSummary.biggestMargin}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Flest mål i gruppspel</p>
              <p className="mt-1 text-sm font-bold text-white/85">
                {topGroupScorers.length > 0 ? topGroupScorers.join(", ") : "Inga tips ännu"}
              </p>
            </div>
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Lock className="text-flare" />
          <h3 className="mt-3 font-display text-xl font-black">Låsning</h3>
          <p className="mt-2 text-sm text-white/60">Varje tips låses automatiskt vid matchstart.</p>
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
                <td className="px-3 py-2 font-bold"><TeamLabel team={team.team} /></td>
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
  predictedResults,
  actualResults,
  thirdPlaced,
}: {
  selectedGroup: GroupLetter;
  setSelectedGroup: (group: GroupLetter) => void;
  predictedResults: Record<number, ScoreLine>;
  actualResults: Record<number, ScoreLine>;
  thirdPlaced: ReturnType<typeof rankThirdPlaced>;
}) {
  const predictedStandings = buildStandings(predictedResults, selectedGroup);
  const actualStandings = buildStandings(actualResults, selectedGroup);

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-[minmax(0,.65fr)_minmax(0,.35fr)] lg:gap-5">
      <section className="glass w-full min-w-0 max-w-full rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
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
        <div className="mt-5 grid gap-4">
          <GroupStandingsTable title="Mitt tips" label={`Tippad tabell grupp ${selectedGroup}`} standings={predictedStandings} tone="cyan" />
          <GroupStandingsTable title="Riktigt utfall" label={`Officiell tabell grupp ${selectedGroup}`} standings={actualStandings} tone="volt" />
        </div>
      </section>
      <aside className="glass w-full min-w-0 max-w-full rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <p className="text-sm uppercase tracking-[0.3em] text-volt">Bästa treor</p>
        <div className="mt-4 space-y-3">
          {thirdPlaced.map(({ group, standing }, index) => (
            <div key={group} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white/5 p-4">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 truncate">
                <span>{index + 1}. Grupp {group}</span>
                <TeamLabel team={standing.team} />
              </span>
              <span className="shrink-0 font-black text-volt">{standing.points}p</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function GroupStandingsTable({
  title,
  label,
  standings,
  tone,
}: {
  title: string;
  label: string;
  standings: ReturnType<typeof buildStandings>;
  tone: "cyan" | "volt";
}) {
  const accentClass = tone === "cyan" ? "text-cyan" : "text-volt";

  return (
    <section className="min-w-0">
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <p className={classNames("text-xs font-black uppercase tracking-[0.24em]", accentClass)}>{title}</p>
        <p className="text-xs text-white/45">{label}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 sm:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,2rem)] items-center gap-2 border-b border-white/10 bg-white/[0.06] px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-white/45">
          <span className="text-left">Lag</span>
          <span>S</span>
          <span>V</span>
          <span>O</span>
          <span>F</span>
          <span className={accentClass}>P</span>
        </div>
        {standings.map((team, index) => (
          <div
            key={team.team}
            className="grid grid-cols-[minmax(0,1fr)_repeat(5,2rem)] items-center gap-2 border-b border-white/10 px-3 py-4 text-center text-sm last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-2 text-left">
              <span className="w-4 shrink-0 text-white/45">{index + 1}</span>
              <span className="min-w-0 truncate font-bold"><TeamLabel team={team.team} /></span>
            </div>
            <span>{team.played}</span>
            <span>{team.won}</span>
            <span>{team.drawn}</span>
            <span>{team.lost}</span>
            <span className={classNames("font-black", accentClass)}>{team.points}</span>
          </div>
        ))}
      </div>
      <div className="hidden w-full max-w-full overflow-hidden rounded-3xl border border-white/10 sm:block">
        <table className="w-full table-fixed text-left text-xs sm:text-sm">
          <colgroup>
            <col className="w-[34%]" />
            <col span={8} />
          </colgroup>
          <thead className="bg-white/10 text-white/55">
            <tr>
              {["Lag", "M", "V", "O", "F", "GM", "IM", "+/-", "P"].map((head) => (
                <th key={head} className="px-2 py-3 sm:px-3">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((team, index) => (
              <tr key={team.team} className="border-t border-white/10">
                <td className="truncate px-2 py-4 font-bold sm:px-3">
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                    <span>{index + 1}.</span>
                    <TeamLabel team={team.team} />
                  </span>
                </td>
                <td className="px-2 py-4 sm:px-3">{team.played}</td>
                <td className="px-2 py-4 sm:px-3">{team.won}</td>
                <td className="px-2 py-4 sm:px-3">{team.drawn}</td>
                <td className="px-2 py-4 sm:px-3">{team.lost}</td>
                <td className="px-2 py-4 sm:px-3">{team.goalsFor}</td>
                <td className="px-2 py-4 sm:px-3">{team.goalsAgainst}</td>
                <td className="px-2 py-4 sm:px-3">{team.goalDifference}</td>
                <td className={classNames("px-2 py-4 font-black sm:px-3", accentClass)}>{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KnockoutPredictionPanel({
  predictions,
  lockedDates,
  lockedMatchIds,
  sourceResults,
  resultWinners,
  resolveTeams,
  openKnockoutStages,
  onBack,
  onChange,
  onWinnerChange,
  onSavePredictions,
}: {
  predictions: Prediction[];
  lockedDates: string[];
  lockedMatchIds: number[];
  sourceResults: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  resolveTeams: boolean;
  openKnockoutStages: MatchStage[];
  onBack: () => void;
  onChange: (match: Fixture, side: "home" | "away", value: number) => void;
  onWinnerChange: (match: Fixture, winner: string) => void;
  onSavePredictions: () => void;
}) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  const knockout = buildResolvedKnockoutFixtures({
    sourceResults,
    predictions,
    lockedDates,
    lockedMatchIds,
    resolveGroupTeams: resolveTeams,
    useSourceResultsForAdvancement: true,
    advancementWinners: resultWinners,
  });
  const completedCount = knockout.filter((match) => predictionMap.get(match.id)?.score).length;

  return (
    <section className="glass rounded-[1.5rem] p-3 sm:rounded-[2rem] sm:p-5">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-flare sm:text-sm sm:tracking-[0.35em]">Mitt tips</p>
          <h2 className="font-display text-2xl font-black sm:text-[28px]">Slutspel</h2>
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
          <button
            onClick={onSavePredictions}
            className="rounded-full bg-volt px-4 py-2 text-sm font-black text-pitch transition hover:brightness-110"
          >
            Spara tips
          </button>
          <p className="rounded-full bg-flare/10 px-4 py-2 text-sm text-flare">{completedCount}/32 matcher</p>
        </div>
      </div>

      <div className="grid gap-4">
        {stageOrder.map((stage) => {
          const stageMatches = knockout.filter((match) => match.stage === stage);

          return (
            <section key={stage} className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 sm:rounded-[1.75rem]">
              <div className="border-b border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-flare sm:text-sm sm:tracking-[0.3em]">{stage}</p>
              </div>
              <div className="grid gap-2 p-2 sm:p-2.5">
                {stageMatches.map((match) => {
                  const prediction = predictionMap.get(match.id);
                  const isLocked = isFixtureLocked(match, lockedDates, lockedMatchIds);
                  const isMatchResolved = isResolvedKnockoutMatch(match);
                  const hasPredictionScore = Boolean(prediction?.score);
                  const isRepairableBlankPrediction = Boolean(resolveTeams) && isMatchResolved && isLocked && !hasPredictionScore;
                  const isOpenStage = openKnockoutStages.includes(match.stage);
                  const isEditable = (resolveTeams && isMatchResolved && isOpenStage && !isLocked) || isRepairableBlankPrediction;
                  const isDraw = prediction?.score?.home === prediction?.score?.away;
                  const winner = getWinnerLabel(match, prediction?.score, prediction?.winner);
                  const statusLabel = isRepairableBlankPrediction
                    ? "Fyll i saknat tips"
                    : isLocked
                      ? "Låst"
                      : isEditable
                        ? "Öppen"
                        : isMatchResolved
                          ? "Öppnar senare"
                          : "Väntar på lag";

                  return (
                    <div
                      key={match.id}
                      className={classNames(
                        "grid grid-cols-[34px_1fr] gap-2 rounded-2xl border border-white/10 bg-pitch/55 p-3 sm:grid-cols-[44px_1fr_auto_1fr] sm:gap-3 sm:rounded-3xl",
                        isLocked && "border-flare/25 bg-flare/5",
                      )}
                    >
                      <span className="pt-1 text-sm font-bold text-white/40">#{match.id}</span>
                      <div>
                        <p className="font-bold"><TeamLabel team={match.resolvedHome} /></p>
                        <p className="text-xs text-white/40">
                          {formatDate(match.date)} {match.kickoffTime} · {statusLabel}
                        </p>
                        {match.resolvedHome !== match.home && <p className="text-xs text-white/30"><TeamLabel team={match.home} /></p>}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2 py-1 sm:col-span-1 sm:py-0">
                        <ScoreField
                          label={`${match.resolvedHome} mål`}
                          value={prediction?.score?.home}
                          disabled={!isEditable}
                          onChange={(value) => onChange(match, "home", value)}
                          tone="flare"
                        />
                        <span className="text-white/40">-</span>
                        <ScoreField
                          label={`${match.resolvedAway} mål`}
                          value={prediction?.score?.away}
                          disabled={!isEditable}
                          onChange={(value) => onChange(match, "away", value)}
                          tone="flare"
                        />
                      </div>
                      <div className="col-span-2 text-left sm:col-span-1 sm:text-right">
                        <p className="font-bold"><TeamLabel team={match.resolvedAway} /></p>
                        {match.resolvedAway !== match.away && <p className="text-xs text-white/30"><TeamLabel team={match.away} /></p>}
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
                            <option value={match.resolvedHome}>{match.resolvedHome}</option>
                            <option value={match.resolvedAway}>{match.resolvedAway}</option>
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
  lockedMatchIds = [],
  resultWinners = {},
}: {
  sourceResults?: Record<number, ScoreLine>;
  lockedDates?: string[];
  lockedMatchIds?: number[];
  resultWinners?: Record<number, string>;
}) {
  const groupStageLocked = stageIsLocked("Gruppspel", lockedDates, lockedMatchIds);
  const knockout = buildResolvedKnockoutFixtures({
    sourceResults,
    lockedDates,
    lockedMatchIds,
    resolveGroupTeams: groupStageLocked,
    useSourceResultsForAdvancement: true,
    advancementWinners: resultWinners,
  });
  const matchById = new Map(knockout.map((match) => [match.id, match]));
  const leftSide = {
    round32: [74, 77, 73, 75, 83, 84, 81, 82],
    round16: [89, 90, 93, 94],
    quarter: [97, 98],
    semi: [101],
  };
  const rightSide = {
    round32: [76, 78, 79, 80, 86, 88, 85, 87],
    round16: [91, 92, 95, 96],
    quarter: [99, 100],
    semi: [102],
  };

  return (
    <section className="glass overflow-hidden rounded-[2rem] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-flare sm:text-sm">Slutspel</p>
          <h2 className="mt-2 font-display text-3xl font-black">Slutspelsträd</h2>
        </div>
        <p className="rounded-full bg-flare/10 px-4 py-2 text-sm font-bold text-flare">
          {groupStageLocked ? "Gruppspelet låst" : "Väntar på gruppspel"}
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        <div className="grid min-w-[2476px] grid-cols-[988px_500px_988px] items-center gap-0">
          <BracketSide
            side="left"
            rounds={leftSide}
            matchById={matchById}
            sourceResults={sourceResults}
            resultWinners={resultWinners}
            lockedDates={lockedDates}
            lockedMatchIds={lockedMatchIds}
          />

          <BracketFinalStage
            matchById={matchById}
            sourceResults={sourceResults}
            resultWinners={resultWinners}
            lockedDates={lockedDates}
            lockedMatchIds={lockedMatchIds}
          />

          <BracketSide
            side="right"
            rounds={rightSide}
            matchById={matchById}
            sourceResults={sourceResults}
            resultWinners={resultWinners}
            lockedDates={lockedDates}
            lockedMatchIds={lockedMatchIds}
          />
        </div>
      </div>
    </section>
  );
}

function BracketSide({
  side,
  rounds,
  matchById,
  sourceResults,
  resultWinners,
  lockedDates,
  lockedMatchIds,
}: {
  side: "left" | "right";
  rounds: { round32: number[]; round16: number[]; quarter: number[]; semi: number[] };
  matchById: Map<number, ResolvedKnockoutFixture>;
  sourceResults: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  lockedDates: string[];
  lockedMatchIds: number[];
}) {
  const cardColumn = (title: string, ids: number[], span: number) => (
    <div className="grid grid-rows-[32px_repeat(8,132px)] gap-y-3">
      <BracketRoundHeader title={title} />
      {ids.map((id, index) => {
        const match = matchById.get(id);
        if (!match) return null;
        const rowStart = 2 + index * span;
        return (
          <div key={id} className="flex items-center" style={{ gridRow: `${rowStart} / span ${span}` }}>
            <BracketMatchCard
              match={match}
              result={sourceResults[id]}
              resultWinner={resultWinners[id]}
              isLocked={isFixtureLocked(match, lockedDates, lockedMatchIds)}
            />
          </div>
        );
      })}
    </div>
  );

  const connectorColumn = (span: number) => (
    <div className="grid grid-rows-[32px_repeat(8,132px)] gap-y-3">
      <div />
      {Array.from({ length: 8 / span }).map((_, index) => (
        <BracketConnector
          key={`${span}-${index}`}
          side={side}
          style={{ gridRow: `${2 + index * span} / span ${span}` }}
        />
      ))}
    </div>
  );

  const columns =
    side === "left"
      ? [
          cardColumn("Sextondelsfinal", rounds.round32, 1),
          connectorColumn(2),
          cardColumn("Åttondelsfinal", rounds.round16, 2),
          connectorColumn(4),
          cardColumn("Kvartsfinal", rounds.quarter, 4),
          connectorColumn(8),
          cardColumn("Semifinal", rounds.semi, 8),
        ]
      : [
          cardColumn("Semifinal", rounds.semi, 8),
          connectorColumn(8),
          cardColumn("Kvartsfinal", rounds.quarter, 4),
          connectorColumn(4),
          cardColumn("Åttondelsfinal", rounds.round16, 2),
          connectorColumn(2),
          cardColumn("Sextondelsfinal", rounds.round32, 1),
        ];

  const gridColumns =
    side === "left"
      ? "grid-cols-[220px_36px_220px_36px_220px_36px_220px]"
      : "grid-cols-[220px_36px_220px_36px_220px_36px_220px]";

  return (
    <div className={classNames("grid gap-x-0", gridColumns)}>
      {columns.map((column, index) => (
        <div key={index}>{column}</div>
      ))}
    </div>
  );
}

const bracketHeaderHeight = 32;
const bracketRowHeight = 132;
const bracketRowGap = 12;

function bracketSpanHeight(span: number) {
  return span * bracketRowHeight + (span - 1) * bracketRowGap;
}

function bracketSpanCenter(span: number) {
  return bracketSpanHeight(span) / 2;
}

function bracketGridCellCenter(rowStart: number, span: number) {
  const top = rowStart === 1 ? 0 : bracketHeaderHeight + bracketRowGap + (rowStart - 2) * (bracketRowHeight + bracketRowGap);
  return top + bracketSpanCenter(span);
}

function BracketFinalStage({
  matchById,
  sourceResults,
  resultWinners,
  lockedDates,
  lockedMatchIds,
}: {
  matchById: Map<number, ResolvedKnockoutFixture>;
  sourceResults: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  lockedDates: string[];
  lockedMatchIds: number[];
}) {
  const finalMatch = matchById.get(104);
  const bronzeMatch = matchById.get(103);
  const semifinalCenter = bracketGridCellCenter(2, 8);
  const finalCenter = bracketGridCellCenter(4, 2);
  const bronzeCenter = bracketGridCellCenter(6, 2);

  return (
    <div className="relative grid min-w-[500px] grid-rows-[32px_repeat(8,132px)] gap-y-3">
      <div />

      <div className="pointer-events-none absolute left-0 h-px w-[24%] bg-white/25" style={{ top: semifinalCenter }} />
      <div className="pointer-events-none absolute left-[24%] w-px bg-white/25" style={{ top: finalCenter, height: bronzeCenter - finalCenter }} />
      <div className="pointer-events-none absolute left-[24%] h-px w-[6%] bg-white/25" style={{ top: finalCenter }} />
      <div className="pointer-events-none absolute left-[24%] h-px w-[6%] bg-white/25" style={{ top: bronzeCenter }} />
      <div className="pointer-events-none absolute right-0 h-px w-[24%] bg-white/25" style={{ top: semifinalCenter }} />
      <div className="pointer-events-none absolute right-[24%] w-px bg-white/25" style={{ top: finalCenter, height: bronzeCenter - finalCenter }} />
      <div className="pointer-events-none absolute right-[24%] h-px w-[6%] bg-white/25" style={{ top: finalCenter }} />
      <div className="pointer-events-none absolute right-[24%] h-px w-[6%] bg-white/25" style={{ top: bronzeCenter }} />

      {finalMatch ? (
        <div className="relative z-10 flex items-center px-[30%]" style={{ gridRow: "4 / span 2" }}>
          <BracketMatchCard
            match={finalMatch}
            result={sourceResults[104]}
            resultWinner={resultWinners[104]}
            isLocked={isFixtureLocked(finalMatch, lockedDates, lockedMatchIds)}
            featured
          />
        </div>
      ) : null}

      {bronzeMatch ? (
        <div className="relative z-10 flex items-center px-[30%]" style={{ gridRow: "6 / span 2" }}>
          <BracketMatchCard
            match={bronzeMatch}
            result={sourceResults[103]}
            resultWinner={resultWinners[103]}
            isLocked={isFixtureLocked(bronzeMatch, lockedDates, lockedMatchIds)}
          />
        </div>
      ) : null}
    </div>
  );
}

function BracketRoundHeader({ title }: { title: string }) {
  return (
    <p className="rounded-full bg-white/10 px-3 py-1 text-center text-xs font-bold uppercase tracking-[0.18em] text-white/45">
      {title}
    </p>
  );
}

function BracketConnector({ side, style }: { side: "left" | "right"; style: React.CSSProperties }) {
  const span = typeof style.gridRow === "string" ? Number(style.gridRow.match(/span (\d+)/)?.[1] ?? 1) : 1;
  const upperCenter = bracketSpanCenter(span / 2);
  const lowerCenter = bracketSpanHeight(span) - upperCenter;
  const mergeCenter = bracketSpanCenter(span);

  return (
    <div className="relative" style={style}>
      <span className="absolute h-px w-1/2 bg-white/25" style={side === "left" ? { left: 0, top: upperCenter } : { right: 0, top: upperCenter }} />
      <span className="absolute h-px w-1/2 bg-white/25" style={side === "left" ? { left: 0, top: lowerCenter } : { right: 0, top: lowerCenter }} />
      <span
        className="absolute w-px bg-white/25"
        style={side === "left" ? { left: "50%", top: upperCenter, height: lowerCenter - upperCenter } : { right: "50%", top: upperCenter, height: lowerCenter - upperCenter }}
      />
      <span className="absolute h-px w-1/2 bg-white/25" style={side === "left" ? { right: 0, top: mergeCenter } : { left: 0, top: mergeCenter }} />
    </div>
  );
}

function getBracketMatchTitle(match: ResolvedKnockoutFixture) {
  if (match.id === 104) return "Final";
  if (match.id === 103) return "Bronsmatch";
  return `Match ${match.id}`;
}

function BracketMatchCard({
  match,
  result,
  resultWinner,
  isLocked,
  featured = false,
}: {
  match: ResolvedKnockoutFixture;
  result?: ScoreLine;
  resultWinner?: string;
  isLocked: boolean;
  featured?: boolean;
}) {
  const winner = result ? matchWinner(match.resolvedHome, match.resolvedAway, result, resultWinner) : undefined;
  const teamRows = [
    { team: match.resolvedHome, score: result?.home },
    { team: match.resolvedAway, score: result?.away },
  ];

  return (
    <article
      className={classNames(
        "w-full rounded-2xl border bg-black/25 p-3 shadow-sm",
        featured ? "border-flare/35 bg-flare/10" : isLocked ? "border-volt/25 bg-volt/5" : "border-white/10",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{getBracketMatchTitle(match)}</p>
        <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-bold", isLocked ? "bg-volt/15 text-volt" : "bg-white/10 text-white/45")}>
          {isLocked ? "Klar" : formatDate(match.date)}
        </span>
      </div>
      <div className="grid gap-1">
        {teamRows.map(({ team, score }) => (
          <div
            key={team}
            className={classNames(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-1.5",
              winner === team ? "bg-volt/15 text-volt" : "bg-white/[0.04]",
            )}
          >
            <span className="min-w-0 text-sm font-bold">
              <TeamLabel team={team} />
            </span>
            <span className="font-display text-sm font-black">{score ?? "-"}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AdminPanel({
  results,
  resultWinners,
  manualResultOverrideMatchIds,
  updateResult,
  updateResultWinner,
  clearManualResultOverride,
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
  randomizeResultsAndLockOnly,
  resetResultsAndLocksOnly,
  resetDevData,
  openWinnersModal,
  lockedDates,
  lockedMatchIds,
  groupStageTipsLocked,
  toggleLockedDate,
  toggleLockedMatch,
  toggleGroupStageTipsLocked,
  matchSyncMessage,
  databaseSyncMessage,
  isDatabaseSyncing,
  refreshSupabaseData,
  homePreviewDate,
  setHomePreviewDate,
  officialBonusAnswers,
  updateOfficialBonusAnswer,
}: {
  results: Record<number, ScoreLine>;
  resultWinners: Record<number, string>;
  manualResultOverrideMatchIds: number[];
  updateResult: (matchId: number, side: "home" | "away", value: number) => void;
  updateResultWinner: (matchId: number, winner: string) => void;
  clearManualResultOverride: (matchId: number) => void;
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
  randomizeResultsAndLockOnly: () => void;
  resetResultsAndLocksOnly: () => void;
  resetDevData: () => void;
  openWinnersModal: () => void;
  lockedDates: string[];
  lockedMatchIds: number[];
  groupStageTipsLocked: boolean;
  toggleLockedDate: (date: string) => void;
  toggleLockedMatch: (matchId: number) => void;
  toggleGroupStageTipsLocked: () => void;
  matchSyncMessage: string;
  databaseSyncMessage: string;
  isDatabaseSyncing: boolean;
  refreshSupabaseData: () => void;
  homePreviewDate: string;
  setHomePreviewDate: (date: string) => void;
  officialBonusAnswers: BonusPrediction;
  updateOfficialBonusAnswer: (key: keyof BonusPrediction, value: string) => void;
}) {
  const [adminStage, setAdminStage] = useState<Fixture["stage"]>("Gruppspel");
  const resolvedAdminKnockout = buildResolvedKnockoutFixtures({
    sourceResults: results,
    lockedDates,
    lockedMatchIds,
    resolveGroupTeams: stageIsLocked("Gruppspel", lockedDates, lockedMatchIds),
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
  const homePreviewMatches = homePreviewDate ? getMatchesByDate(homePreviewDate) : [];
  const manualResultOverrideIdSet = new Set(manualResultOverrideMatchIds);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-5">
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-coral sm:text-sm sm:tracking-[0.3em]">Adminpanel</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-2xl font-black sm:text-3xl">Mata in riktiga resultat</h2>
          <p className="mt-1 text-sm text-white/55">Matcher låses automatiskt vid avspark. Slutresultat kan synkas från API.</p>
          <p className="rounded-full bg-coral/10 px-4 py-2 text-sm font-bold text-coral">
            {Object.keys(results).length}/104 resultat
          </p>
          <button
            type="button"
            onClick={refreshSupabaseData}
            disabled={isDatabaseSyncing}
            className="rounded-full bg-volt px-4 py-2 text-sm font-black text-pitch transition hover:bg-volt/85 disabled:cursor-wait disabled:opacity-60"
          >
            {isDatabaseSyncing ? "Synkar..." : "Synka Supabase"}
          </button>
          {databaseSyncMessage ? (
            <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/65">{databaseSyncMessage}</p>
          ) : null}
          {matchSyncMessage ? (
            <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/65">{matchSyncMessage}</p>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:pb-2">
          {adminStageOrder.map((stage) => (
            <button
              key={stage}
              onClick={() => setAdminStage(stage)}
              className={classNames(
                "min-w-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition sm:px-4",
                adminStage === stage ? "bg-coral text-white" : "bg-white/10 text-white/60 hover:text-white",
              )}
            >
              {stage}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-5">
          {adminFixturesByDate.map((day) => {
            const dayLocked = day.matches.every((match) => isFixtureLocked(match, lockedDates, lockedMatchIds));

            return (
            <section key={day.date} className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 sm:rounded-[1.75rem]">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-coral">Matchdag</p>
                  <h3 className="font-display text-xl font-black">{formatDate(day.date)}</h3>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <p className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">{day.matches.length} matcher</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-white/70">
                    <span>{dayLocked ? "Låst" : "Lås dag"}</span>
                    <input
                      type="checkbox"
                      checked={dayLocked}
                      onChange={() => toggleLockedDate(day.date)}
                      className="peer sr-only"
                    />
                    <span
                      className={classNames(
                        "relative h-6 w-11 rounded-full transition",
                        dayLocked ? "bg-coral" : "bg-white/20",
                      )}
                    >
                      <span
                        className={classNames(
                          "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition",
                          dayLocked && "translate-x-5",
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
                  const isLocked = isFixtureLocked(match, lockedDates, lockedMatchIds);
                  const hasManualOverride = manualResultOverrideIdSet.has(match.id);
                  const selectedWinner =
                    resultWinners[match.id] && [home, away].includes(resultWinners[match.id])
                      ? resultWinners[match.id]
                      : matchWinner(home, away, result) ?? "";

                  return (
                  <div key={match.id} className="grid gap-3 rounded-2xl bg-white/5 p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:rounded-3xl">
                    <div>
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-bold">
                        <TeamLabel team={home} />
                        <span>-</span>
                        <TeamLabel team={away} />
                      </p>
                      <p className="text-sm text-white/45">
                        Match {match.id}
                        {match.group ? ` · Grupp ${match.group}` : ` · ${match.stage}`}
                        {isLocked ? " · Låst" : ""}
                        {hasManualOverride ? " · Manuell override · API stoppat" : ""}
                      </p>
                      {match.stage !== "Gruppspel" && (home !== match.home || away !== match.away) ? (
                        <p className="text-xs text-white/35">
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <TeamLabel team={match.home} />
                            <span>-</span>
                            <TeamLabel team={match.away} />
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => toggleLockedMatch(match.id)}
                        className={classNames(
                          "h-11 rounded-2xl px-3 text-xs font-bold transition",
                          isLocked ? "bg-coral/20 text-coral" : "bg-white/10 text-white/60 hover:text-white",
                        )}
                      >
                        {isLocked ? "Låst" : "Lås"}
                      </button>
                      {hasManualOverride ? (
                        <button
                          type="button"
                          onClick={() => clearManualResultOverride(match.id)}
                          className="h-11 rounded-2xl bg-flare/15 px-3 text-xs font-bold text-flare transition hover:bg-flare/25"
                        >
                          Släpp API
                        </button>
                      ) : null}
                      <input
                        type="number"
                        min={0}
                        value={results[match.id]?.home ?? ""}
                        onChange={(event) => updateResult(match.id, "home", Number(event.target.value))}
                        className="h-11 w-14 rounded-2xl bg-black/30 text-center font-black outline-none focus:ring-2 focus:ring-coral"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        min={0}
                        value={results[match.id]?.away ?? ""}
                        onChange={(event) => updateResult(match.id, "away", Number(event.target.value))}
                        className="h-11 w-14 rounded-2xl bg-black/30 text-center font-black outline-none focus:ring-2 focus:ring-coral"
                      />
                      {match.stage !== "Gruppspel" ? (
                        <select
                          value={selectedWinner}
                          onChange={(event) => updateResultWinner(match.id, event.target.value)}
                          className="h-11 min-w-0 flex-1 rounded-2xl bg-black/30 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-coral sm:max-w-[180px] sm:flex-none"
                          aria-label={`Vinnare match ${match.id}`}
                        >
                          <option value="">Välj vinnare</option>
                          <option value={home}>{home}</option>
                          <option value={away}>{away}</option>
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
      <aside className="space-y-5">
        <div className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
          <Trophy className="text-flare" />
          <h3 className="mt-3 font-display text-xl font-black">Bonusfacit</h3>
          <p className="mt-2 text-sm text-white/60">
            Fyll i slutligt facit. Bonus ger max 67 poäng och räknas om direkt.
          </p>
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
                  placeholder={question.type === "number" ? "Officiellt nummer" : "Officiellt facit, t.ex. USA/Kanada"}
                />
              </label>
            ))}
          </div>
          <p className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/55">
            Vid flera korrekta lag kan facit skrivas med snedstreck, till exempel USA/Kanada. Totala mål ger poäng till närmaste tips.
          </p>
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
                    {profile.role === "admin" ? <Settings size={18} /> : profile.initials}
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
          <CalendarClock className="text-cyan" />
          <h3 className="mt-3 font-display text-xl font-black">Testa hemskärmsdag</h3>
          <p className="mt-2 text-sm text-white/60">
            Välj en dag för att förhandsvisa vilka matcher som visas på Hem. Lämna tomt för live-läge.
          </p>
          <select
            value={homePreviewDate}
            onChange={(event) => setHomePreviewDate(event.target.value)}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold outline-none focus:border-cyan"
          >
            <option value="">Följ livetid</option>
            {fixtureDates.map((date) => (
              <option key={date} value={date}>
                {formatDate(date)} · {getMatchesByDate(date).length} matcher
              </option>
            ))}
          </select>
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                {homePreviewDate ? formatDate(homePreviewDate) : "Live"}
              </p>
              <p className="shrink-0 rounded-full bg-cyan/10 px-3 py-1 text-xs font-black text-cyan">
                {homePreviewDate ? `${homePreviewMatches.length} matcher` : "Auto"}
              </p>
            </div>
            {homePreviewDate ? (
              <div className="mt-3 space-y-2">
                {homePreviewMatches.slice(0, 4).map((match) => (
                  <div key={match.id} className="grid grid-cols-[44px_1fr] gap-2 rounded-2xl bg-white/5 p-2 text-sm">
                    <span className="font-display font-black text-volt">{match.kickoffTime}</span>
                    <span className="min-w-0 truncate font-bold">
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                        <TeamLabel team={match.home} />
                        <span>-</span>
                        <TeamLabel team={match.away} />
                      </span>
                    </span>
                  </div>
                ))}
                {homePreviewMatches.length > 4 ? (
                  <p className="text-xs text-white/45">+{homePreviewMatches.length - 4} matcher till visas på Hem.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/55">Hemsidan använder svensk dagens datum och uppdaterar panelen varje minut.</p>
            )}
          </div>
          {homePreviewDate ? (
            <button
              onClick={() => setHomePreviewDate("")}
              className="mt-4 w-full rounded-2xl bg-cyan/15 px-4 py-3 font-display font-black text-cyan transition hover:bg-cyan/20"
            >
              Återgå till livetid
            </button>
          ) : null}
        </div>
        <div className="glass rounded-[1.5rem] border-coral/20 p-4 sm:rounded-[2rem] sm:p-6">
          <Sparkles className="text-coral" />
          <h3 className="mt-3 font-display text-xl font-black">Utvecklarverktyg</h3>
          <p className="mt-2 text-sm text-white/60">Endast för test: lås matcher med slumpade resultat eller fyll all testdata.</p>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span>
              <span className="block font-display text-base font-black text-white">Lås gruppspelstips</span>
              <span className="mt-1 block text-sm text-white/55">
                {groupStageTipsLocked ? "Gruppspelet är stängt för tippning." : "Spelare kan fortfarande tippa gruppspelet."}
              </span>
            </span>
            <input
              type="checkbox"
              checked={groupStageTipsLocked}
              onChange={toggleGroupStageTipsLocked}
              className="peer sr-only"
            />
            <span
              className={classNames(
                "relative h-7 w-12 shrink-0 rounded-full transition",
                groupStageTipsLocked ? "bg-coral" : "bg-white/20",
              )}
            >
              <span
                className={classNames(
                  "absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition",
                  groupStageTipsLocked && "translate-x-5",
                )}
              />
            </span>
          </label>
          <div className="mt-4 grid gap-2">
            <button
              onClick={randomizeResultsAndLockOnly}
              className="rounded-2xl bg-cyan/90 px-4 py-3 font-display font-black text-pitch transition hover:brightness-110"
            >
              Slumpa resultat och lås
            </button>
            <button
              onClick={resetResultsAndLocksOnly}
              className="rounded-2xl bg-white/10 px-4 py-3 font-display font-black text-white/70 transition hover:bg-white/15"
            >
              Nolla resultat och låsningar
            </button>
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
            <button
              onClick={openWinnersModal}
              className="rounded-2xl bg-flare/90 px-4 py-3 font-display font-black text-pitch transition hover:brightness-110"
            >
              Visa vinnarruta
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function OtherPredictionsPanel({
  profiles,
  currentProfile,
  allPredictionsByProfile,
  allBonusByProfile,
  lockedDates,
  lockedMatchIds,
  bonusLocked,
  actualResults,
  actualResultWinners,
}: {
  profiles: PlayerProfile[];
  currentProfile: PlayerProfile;
  allPredictionsByProfile: Record<string, Prediction[]>;
  allBonusByProfile: Record<string, BonusPrediction>;
  lockedDates: string[];
  lockedMatchIds: number[];
  bonusLocked: boolean;
  actualResults: Record<number, ScoreLine>;
  actualResultWinners: Record<number, string>;
}) {
  const playerProfiles = profiles.filter((profile) => profile.role === "player");
  const visibleProfiles = currentProfile.role === "admin" ? playerProfiles : playerProfiles.filter((profile) => profile.id !== currentProfile.id);
  const [selectedProfileId, setSelectedProfileId] = useState(visibleProfiles[0]?.id ?? "");
  const selectedProfile = visibleProfiles.find((profile) => profile.id === selectedProfileId) ?? visibleProfiles[0];
  const selectedPredictions = selectedProfile ? allPredictionsByProfile[selectedProfile.id] ?? defaultPredictions : defaultPredictions;
  const selectedBonus = selectedProfile ? allBonusByProfile[selectedProfile.id] ?? defaultBonusAnswers : defaultBonusAnswers;
  const predictionMap = new Map(selectedPredictions.map((prediction) => [prediction.matchId, prediction]));
  const resolvedKnockoutMatches = getResolvedActualKnockoutFixtures(actualResults, actualResultWinners, lockedDates, lockedMatchIds);

  useEffect(() => {
    if (!selectedProfileId || !visibleProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(visibleProfiles[0]?.id ?? "");
    }
  }, [selectedProfileId, visibleProfiles]);

  if (visibleProfiles.length === 0) {
    return (
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan sm:text-sm">Andras tips</p>
        <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">Inga andra tips ännu</h2>
        <p className="mt-2 text-sm text-white/60">När fler spelare finns med visas deras sparade tips här.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
      <aside className="glass h-fit rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan sm:text-sm">Andras tips</p>
        <h2 className="mt-2 font-display text-2xl font-black">Spelare</h2>
        <div className="mt-4 grid gap-2">
          {visibleProfiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setSelectedProfileId(profile.id)}
              className={classNames(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
                selectedProfile?.id === profile.id ? "bg-cyan text-pitch" : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white",
              )}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/15 font-display text-sm font-black">
                {profile.initials}
              </span>
              <span className="min-w-0 truncate font-bold">{profile.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="glass min-w-0 rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-volt sm:text-sm">Sparat tips</p>
            <h2 className="font-display text-2xl font-black sm:text-3xl">{selectedProfile?.name}</h2>
          </div>
          <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/60">
            {selectedPredictions.filter((prediction) => prediction.score).length}/{fixtures.length} matcher
          </p>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan">Bonusfrågor</p>
            {!bonusLocked ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/45">Dolda tills första matchstart</span>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {bonusFieldLabels.map((question) => (
              <div key={question.key} className="rounded-2xl bg-white/[0.05] px-3 py-2">
                <p className="text-xs text-white/45">{question.label}</p>
                {bonusLocked ? (
                  <p className="mt-1 font-bold text-white">{selectedBonus[question.key] ?? "Ej tippat"}</p>
                ) : (
                  <SkeletonLine className="mt-2 h-5 w-32" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5">
          {groupLetters.map((group) => {
            const groupMatches = fixtures.filter((match) => match.stage === "Gruppspel" && match.group === group);
            return (
              <PredictionReadOnlySection
                key={group}
                title={`Grupp ${group}`}
                tone="volt"
                matches={groupMatches}
                predictionMap={predictionMap}
                lockedDates={lockedDates}
                lockedMatchIds={lockedMatchIds}
              />
            );
          })}

          {stageOrder.map((stage) => {
            const stageMatches = resolvedKnockoutMatches.filter((match) => match.stage === stage);
            return (
              <PredictionReadOnlySection
                key={stage}
                title={stage}
                tone="flare"
                matches={stageMatches}
                predictionMap={predictionMap}
                lockedDates={lockedDates}
                lockedMatchIds={lockedMatchIds}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PredictionReadOnlySection({
  title,
  tone,
  matches,
  predictionMap,
  lockedDates,
  lockedMatchIds,
}: {
  title: string;
  tone: "volt" | "flare";
  matches: Array<Fixture & Partial<ResolvedKnockoutFixture>>;
  predictionMap: Map<number, Prediction>;
  lockedDates: string[];
  lockedMatchIds: number[];
}) {
  const accentClass = tone === "flare" ? "text-flare" : "text-volt";

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 sm:rounded-[1.75rem]">
      <div className="border-b border-white/10 bg-white/[0.06] p-3">
        <p className={classNames("text-xs font-black uppercase tracking-[0.28em] sm:text-sm", accentClass)}>{title}</p>
      </div>
      <div className="grid gap-2 p-2 sm:p-3">
        {matches.map((match) => {
          const prediction = predictionMap.get(match.id);
          const isLocked = isFixtureLocked(match, lockedDates, lockedMatchIds);
          const resolvedHome = match.resolvedHome ?? match.home;
          const resolvedAway = match.resolvedAway ?? match.away;
          const home = isKnockoutPlaceholder(resolvedHome) ? match.home : resolvedHome;
          const away = isKnockoutPlaceholder(resolvedAway) ? match.away : resolvedAway;
          const scoreLabel = prediction?.score ? `${prediction.score.home}-${prediction.score.away}` : "-";

          return (
            <div
              key={match.id}
              className="grid grid-cols-[38px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-white/10 bg-pitch/55 p-3 text-sm sm:grid-cols-[46px_minmax(0,1fr)_72px_minmax(0,1fr)]"
            >
              <span className="text-xs font-bold text-white/40">#{match.id}</span>
              <span className="min-w-0 truncate font-bold"><TeamLabel team={home} /></span>
              <span className={classNames("grid min-h-7 place-items-center text-center font-display text-lg font-black", accentClass)}>
                {isLocked ? scoreLabel : <SkeletonLine className="h-6 w-14" />}
              </span>
              <span className="min-w-0 truncate text-right font-bold"><TeamLabel team={away} /></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <span
      aria-label="Dolt tips"
      className={classNames("inline-block animate-pulse rounded-full bg-white/10", className)}
    />
  );
}

function PlayerDailyBreakdown({
  profiles,
  currentProfileId,
  activePredictions,
  storedPredictions,
  results,
  lockedDates,
  lockedMatchIds,
  resultWinners,
}: {
  profiles: PlayerProfile[];
  currentProfileId?: string;
  activePredictions: Prediction[];
  storedPredictions: Record<string, Prediction[]>;
  results: Record<number, ScoreLine>;
  lockedDates: string[];
  lockedMatchIds: number[];
  resultWinners: Record<number, string>;
}) {
  const playerProfiles = profiles.filter((profile) => profile.role === "player");
  const [selectedPlayerId, setSelectedPlayerId] = useState(currentProfileId ?? playerProfiles[0]?.id ?? "");
  const selectedProfile = playerProfiles.find((profile) => profile.id === selectedPlayerId) ?? playerProfiles[0];
  const selectedPredictions = selectedProfile
    ? loadProfilePredictions(selectedProfile.id, currentProfileId, activePredictions, storedPredictions)
    : defaultPredictions;
  const selectedDailyScoreData = useMemo(
    () => buildDailyScoreData(selectedPredictions, results, lockedDates, resultWinners, lockedMatchIds),
    [lockedDates, lockedMatchIds, resultWinners, results, selectedPredictions],
  );
  const scoredDays = selectedDailyScoreData.filter((day) => day.matches.length > 0);
  const todayKey = getSwedishDateKey();
  const preferredDay = scoredDays.find((day) => day.dateKey === todayKey) ?? scoredDays[scoredDays.length - 1];
  const [selectedDate, setSelectedDate] = useState(preferredDay?.dateKey ?? "");
  const selectedDay = scoredDays.find((day) => day.dateKey === selectedDate) ?? preferredDay;

  useEffect(() => {
    if (!selectedProfile) return;
    if (selectedPlayerId !== selectedProfile.id) setSelectedPlayerId(selectedProfile.id);
  }, [selectedPlayerId, selectedProfile]);

  useEffect(() => {
    if (!preferredDay) {
      if (selectedDate) setSelectedDate("");
      return;
    }
    if (!scoredDays.some((day) => day.dateKey === selectedDate)) {
      setSelectedDate(preferredDay.dateKey);
    }
  }, [preferredDay, scoredDays, selectedDate]);

  if (playerProfiles.length === 0) {
    return (
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5 lg:col-span-2">
        <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">Matchdetaljer</p>
        <h2 className="mt-2 font-display text-xl font-black sm:text-2xl">Inga spelare ännu</h2>
      </section>
    );
  }

  return (
    <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-5 lg:col-span-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">Matchdetaljer</p>
          <h2 className="mt-2 font-display text-xl font-black sm:text-2xl">Poäng per dag</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[32rem]">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Spelare</span>
            <select
              value={selectedProfile?.id ?? ""}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-volt"
            >
              {playerProfiles.map((profile) => (
                <option key={profile.id} value={profile.id} className="bg-pitch text-white">
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Datum</span>
            <select
              value={selectedDay?.dateKey ?? ""}
              onChange={(event) => setSelectedDate(event.target.value)}
              disabled={scoredDays.length === 0}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-volt disabled:cursor-not-allowed disabled:opacity-45"
            >
              {scoredDays.length === 0 ? (
                <option value="" className="bg-pitch text-white">
                  Ingen avräkning än
                </option>
              ) : (
                scoredDays.map((day) => (
                  <option key={day.dateKey} value={day.dateKey} className="bg-pitch text-white">
                    {day.date} · {day.dayPoints}p
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      {!selectedDay ? (
        <p className="mt-5 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/55">När matcher är låsta och resultat finns visas spelarens tips här.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div>
              <p className="text-sm text-white/50">{selectedProfile?.name}</p>
              <p className="font-display text-2xl font-black">{selectedDay.date}</p>
            </div>
            <div className="rounded-2xl bg-volt/10 px-4 py-2 text-right">
              <p className="font-display text-2xl font-black text-volt">{selectedDay.dayPoints}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">poäng denna dag</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {selectedDay.matches.map((match) => (
              <div key={match.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                    #{match.id} · {match.kickoffTime} · {match.stage}
                  </p>
                  <p className="rounded-full bg-volt/10 px-3 py-1 text-sm font-black text-volt">+{match.points}p</p>
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3 font-display text-lg font-black">
                  <span className="min-w-0 truncate"><TeamLabel team={match.home} /></span>
                  <span className="text-white/35">-</span>
                  <span className="min-w-0 truncate text-right"><TeamLabel team={match.away} /></span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/60">
                  <span className="rounded-full bg-white/5 px-3 py-1">Tips: {formatScoreLine(match.predictedScore)}</span>
                  <span className="rounded-full bg-white/5 px-3 py-1">Utfall: {formatScoreLine(match.actualScore)}</span>
                  {match.stage !== "Gruppspel" ? (
                    <>
                      <span className="rounded-full bg-white/5 px-3 py-1">Tippat vidare: {match.predictedWinner ?? "-"}</span>
                      <span className="rounded-full bg-white/5 px-3 py-1">Vidare: {match.actualWinner ?? "-"}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function StatsPanel({
  leaderboardRows,
  profiles,
  currentProfileId,
  activePredictions,
  storedPredictions,
  results,
  lockedDates,
  lockedMatchIds,
  resultWinners,
}: {
  leaderboardRows: UserScore[];
  profiles: PlayerProfile[];
  currentProfileId?: string;
  activePredictions: Prediction[];
  storedPredictions: Record<string, Prediction[]>;
  results: Record<number, ScoreLine>;
  lockedDates: string[];
  lockedMatchIds: number[];
  resultWinners: Record<number, string>;
}) {
  const [expandedChart, setExpandedChart] = useState(false);
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
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
  const hasBonusPoints = leaderboardRows.some((user) => user.bonusPoints > 0);
  const scoreHistoryLength = maxHistoryLength + (hasBonusPoints ? 1 : 0);
  const bonusIndex = scoreHistoryLength - 1;
  const scoreHistoryData = Array.from({ length: scoreHistoryLength }, (_, index) => {
    const isBonusPoint = hasBonusPoints && index === bonusIndex;
    const row: Record<string, string | number> = { day: isBonusPoint ? "Bonus" : index === 0 ? "Start" : `Dag ${index}` };
    leaderboardRows.forEach((user) => {
      const matchPoints = user.history[index] ?? user.history[user.history.length - 1] ?? 0;
      row[user.name] = isBonusPoint ? matchPoints + user.bonusPoints : matchPoints;
    });
    return row;
  });
  const visibleRows = leaderboardRows.filter((user) => visiblePlayerIds.includes(user.id));

  useEffect(() => {
    setVisiblePlayerIds((current) => {
      const existingIds = new Set(leaderboardRows.map((user) => user.id));
      const keptIds = current.filter((id) => existingIds.has(id));
      const missingIds = leaderboardRows.map((user) => user.id).filter((id) => !keptIds.includes(id));
      return [...keptIds, ...missingIds];
    });
  }, [leaderboardRows]);

  function toggleVisiblePlayer(playerId: string) {
    setVisiblePlayerIds((current) => {
      if (current.includes(playerId) && current.length === 1) return current;
      return current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];
    });
  }

  const scoreChart = (rows: UserScore[], heightClass: string, animationKey = "default") => (
    <div key={animationKey} className={classNames("relative overflow-visible", heightClass)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={scoreHistoryData} margin={{ top: 18, right: 22, bottom: 8, left: -10 }}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="day" stroke="rgba(255,255,255,.55)" tick={{ fontSize: 11 }} tickMargin={8} />
          <YAxis
            stroke="rgba(255,255,255,.55)"
            tick={{ fontSize: 11 }}
            width={42}
            domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.08))]}
          />
          <Tooltip contentStyle={{ background: "#06130f", border: "1px solid rgba(255,255,255,.12)" }} />
        </AreaChart>
      </ResponsiveContainer>
      <motion.div
        className="absolute inset-0"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={scoreHistoryData} margin={{ top: 18, right: 22, bottom: 8, left: -10 }}>
            <XAxis dataKey="day" stroke="transparent" tick={false} axisLine={false} tickLine={false} height={30} />
            <YAxis
              stroke="transparent"
              tick={false}
              axisLine={false}
              tickLine={false}
              width={42}
              domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.08))]}
            />
            <Tooltip contentStyle={{ background: "#06130f", border: "1px solid rgba(255,255,255,.12)" }} />
            {rows.map((user) => {
              const colorIndex = leaderboardRows.findIndex((row) => row.id === user.id);
              return (
                <Area
                  key={user.id}
                  type="monotone"
                  dataKey={user.name}
                  stroke={lineColors[Math.max(colorIndex, 0) % lineColors.length]}
                  fill="transparent"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-4">
      <PlayerDailyBreakdown
        profiles={profiles}
        currentProfileId={currentProfileId}
        activePredictions={activePredictions}
        storedPredictions={storedPredictions}
        results={results}
        lockedDates={lockedDates}
        lockedMatchIds={lockedMatchIds}
        resultWinners={resultWinners}
      />
      <section className="glass rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-4 lg:col-span-2">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
          <BarChart3 className="text-cyan" />
            <h2 className="font-display text-lg font-black sm:text-xl">Poängutveckling per spelare</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-white/50">X-axel: dagar{hasBonusPoints ? " + bonus" : ""} · Y-axel: totalpoäng</p>
            <button
              onClick={() => {
                setChartAnimationKey((current) => current + 1);
                setExpandedChart(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-cyan/15 px-4 py-2 text-sm font-bold text-cyan transition hover:bg-cyan/25"
            >
              <Expand size={16} />
              Förstora
            </button>
          </div>
        </div>
        {scoreChart(leaderboardRows, "h-60 sm:h-72")}
      </section>
      <AnimatePresence>
        {expandedChart ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-md sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <motion.section
              initial={{ opacity: 0, scale: 0.9, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="glass max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan">Förstorad graf</p>
                  <h2 className="font-display text-xl font-black sm:text-2xl">Poängutveckling per spelare</h2>
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
                        "rounded-full border px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:py-2 sm:text-sm",
                        isVisible ? "bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/35",
                      )}
                      style={isVisible ? { borderColor: lineColors[index % lineColors.length] } : undefined}
                    >
                      {user.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                {scoreChart(visibleRows, "h-[50vh] min-h-[280px] sm:min-h-[320px]", `expanded-${chartAnimationKey}`)}
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
          <section key={board.title} className="glass rounded-[1.5rem] p-3.5 sm:rounded-[2rem] sm:p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-volt sm:text-sm sm:tracking-[0.3em]">{board.title}</p>
            <div className="mt-3 space-y-2.5">
              {rows.map((user, index) => {
                const value = Number(user[board.key]);
                const formattedValue = board.key === "latestChange" && value > 0 ? `+${value}` : `${value}`;

                return (
                  <div key={user.id} className="grid grid-cols-[40px_1fr] gap-3 rounded-2xl bg-white/5 p-3 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:rounded-3xl sm:p-3.5">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 font-bold">{index + 1}</div>
                    <div>
                      <p className="font-bold">{user.name}</p>
                      <p className="text-xs text-white/50 sm:text-sm">
                        {user.groupPoints} grupp · {user.knockoutPoints} slutspel · {user.bonusPoints} bonus
                      </p>
                    </div>
                    <p className="col-span-2 font-display text-xl font-black text-volt sm:col-auto sm:text-2xl">
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
