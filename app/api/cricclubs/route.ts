import { getGoogleUser } from "../../google-auth";
import { enforceApiRateLimit, isSameOrigin } from "../security";

const CORE = "https://core-prod-origin.cricclubs.com/core/";
const TEAM_ID = /^[A-Za-z0-9_-]{10,80}$/;
const PUBLIC_MODULUS = BigInt("0x8da248fae4d61cf4b75866c8418ba23505456ef0d76171a7d29334ae805570532770eedd833da65c7b0c64928dc6d91ff4392f2cede1c79257fa78ce58ed80236d96ce40e934f6121b28c61aa1e8f1d146e2b882f84f9fc818b415e3407923d155a4afd5683dd12ddcd408af4324066c0082de58913095d4464f3809ec2d29d0af");
const PUBLIC_EXPONENT = 65537n;
const RSA_BYTES = 128;

type RemotePlayer = { playerID?: unknown; firstName?: unknown; lastName?: unknown; playerName?: unknown };
type RemoteInnings = { teamId?: unknown; teamName?: unknown; batting?: RemotePlayer[] };
type RemoteMatch = {
  fixtureId?: unknown;
  seriesName?: unknown;
  matchDateTime?: unknown;
  ground?: { name?: unknown };
  teamOne?: { id?: unknown; name?: unknown };
  teamTwo?: { id?: unknown; name?: unknown };
  scoreSummary?: { matchId?: unknown; result?: unknown };
};

const string = (value: unknown) => typeof value === "string" ? value.trim() : "";

function modPow(base: bigint, exponent: bigint, modulus: bigint) {
  let result = 1n;
  for (let value = base % modulus, power = exponent; power > 0n; power >>= 1n, value = value * value % modulus) {
    if (power & 1n) result = result * value % modulus;
  }
  return result;
}

function bytesToBigInt(bytes: Uint8Array) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function contentToken() {
  const message = new TextEncoder().encode(`core-${Date.now()}`);
  const paddingLength = RSA_BYTES - message.length - 3;
  if (paddingLength < 8) throw new Error("Token message is too long");
  const encoded = new Uint8Array(RSA_BYTES);
  encoded[1] = 2;
  const random = new Uint8Array(paddingLength);
  crypto.getRandomValues(random);
  for (let index = 0; index < random.length; index++) {
    while (random[index] === 0) crypto.getRandomValues(random.subarray(index, index + 1));
    encoded[index + 2] = random[index];
  }
  encoded[paddingLength + 2] = 0;
  encoded.set(message, paddingLength + 3);
  let encrypted = modPow(bytesToBigInt(encoded), PUBLIC_EXPONENT, PUBLIC_MODULUS);
  const output = new Uint8Array(RSA_BYTES);
  for (let index = output.length - 1; index >= 0; index--) {
    output[index] = Number(encrypted & 255n);
    encrypted >>= 8n;
  }
  let binary = "";
  for (const byte of output) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function cricclubs(path: string) {
  const response = await fetch(`${CORE}${path}`, {
    headers: { Accept: "application/json", "x-content-token": contentToken() },
  });
  if (!response.ok) throw new Error(`CricClubs returned ${response.status}`);
  return response.json() as Promise<{ status?: string; data?: unknown }>;
}

function parseTeamUrl(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 1_000) return null;
  try {
    const url = new URL(raw);
    if (!["cricclubs.com","www.cricclubs.com"].includes(url.hostname.toLowerCase())) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const teamsIndex = parts.indexOf("teams");
    const shortCode = parts[0];
    const teamId = parts[teamsIndex + 1];
    const seriesId = url.searchParams.get("seriesId") ?? "";
    if (teamsIndex !== 1 || !/^[A-Za-z0-9_-]{1,30}$/.test(shortCode) || !TEAM_ID.test(teamId) || !TEAM_ID.test(seriesId)) return null;
    return { shortCode, teamId, seriesId };
  } catch { return null; }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const allowed = await enforceApiRateLimit(`cricclubs:${user.email.toLowerCase()}`, 12, 60 * 60 * 1_000);
  if (!allowed) return Response.json({ error: "Too many CricClubs sync checks. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => ({})) as { teamUrl?: unknown };
  const parsed = parseTeamUrl(body.teamUrl);
  if (!parsed) return Response.json({ error: "Enter a valid CricClubs team results URL." }, { status: 400 });

  try {
    const leagueResponse = await cricclubs(`public/league/${encodeURIComponent(parsed.shortCode)}/info`);
    const league = leagueResponse.data as { id?: unknown } | undefined;
    const leagueId = string(league?.id);
    if (!TEAM_ID.test(leagueId)) throw new Error("League could not be identified");
    const query = new URLSearchParams({
      status: "hasMatch", teamId: parsed.teamId, leagueId, page: "1", size: "100",
    });
    const matchesResponse = await cricclubs(`public/series/${encodeURIComponent(parsed.seriesId)}/matches?${query}`);
    const completed = ((matchesResponse.data as { completed?: RemoteMatch[] } | undefined)?.completed ?? []).slice(0, 100);
    const matches = await Promise.all(completed.map(async match => {
      const matchId = string(match.scoreSummary?.matchId);
      if (!TEAM_ID.test(matchId)) return null;
      const scorecardResponse = await cricclubs(`public/series/match/${encodeURIComponent(matchId)}/scorecard?leagueId=${encodeURIComponent(leagueId)}`);
      const scorecard = scorecardResponse.data as Record<string, unknown> | undefined;
      const innings = ["innings1","innings2","innings3","innings4"]
        .map(key => scorecard?.[key] as RemoteInnings | undefined)
        .filter((entry): entry is RemoteInnings => Boolean(entry));
      const teamInnings = innings.find(entry => string(entry.teamId) === parsed.teamId);
      const playerMap = new Map<string,string>();
      for (const player of teamInnings?.batting ?? []) {
        const externalId = string(player.playerID);
        const name = `${string(player.firstName)} ${string(player.lastName)}`.trim() || string(player.playerName);
        if (externalId && name) playerMap.set(externalId, name.replace(/\s+/g," "));
      }
      const teamOneId = string(match.teamOne?.id);
      const opponent = teamOneId === parsed.teamId ? string(match.teamTwo?.name) : string(match.teamOne?.name);
      return {
        externalId: matchId,
        sourceUrl: `https://www.cricclubs.com/${encodeURIComponent(parsed.shortCode)}/results/${encodeURIComponent(matchId)}`,
        seriesName: string(match.seriesName),
        date: string(match.matchDateTime).slice(0,10),
        opponent,
        venue: string(match.ground?.name),
        result: string(match.scoreSummary?.result),
        players: [...playerMap].map(([externalId,name]) => ({ externalId,name })),
      };
    }));
    return Response.json({ matches: matches.filter(Boolean) });
  } catch {
    return Response.json({ error: "CricClubs could not be reached. Try again shortly." }, { status: 502 });
  }
}
