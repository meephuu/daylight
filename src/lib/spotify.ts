import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { create } from "zustand";

/**
 * Spotify Web API, for what Windows' media controls cannot do: playlists, search and the queue.
 * Sign-in is the PKCE flow for a Spotify developer app the owner creates (their own Client ID, no
 * secret): the browser opens Spotify's consent page, which redirects back to a one-shot listener on
 * 127.0.0.1 in the Rust side. Tokens stay in this PC's app storage.
 */

export const REDIRECT_PORT = 43117;
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");
const STORAGE_KEY = "spotifyAuth";
const API = "https://api.spotify.com/v1";

interface Auth {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** Date.now() ms. */
  expiresAt: number;
}

function readAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}

function writeAuth(auth: Auth | null) {
  try {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the sign-in lasts this session only.
  }
}

interface SpotifyState {
  auth: Auth | null;
  connecting: boolean;
  error: string | null;
}

export const useSpotify = create<SpotifyState>(() => ({ auth: readAuth(), connecting: false, error: null }));

const PINS_KEY = "spotifyPinnedPlaylists";

function readPins(): SpotifyPlaylist[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    return raw ? (JSON.parse(raw) as SpotifyPlaylist[]) : [];
  } catch {
    return [];
  }
}

interface PinsState {
  /** Pinned playlists, in the order they were pinned. Spotify's own pins are not available to apps. */
  pins: SpotifyPlaylist[];
  togglePin: (playlist: SpotifyPlaylist) => void;
}

export const usePinnedPlaylists = create<PinsState>((set, get) => ({
  pins: readPins(),
  togglePin: (playlist) => {
    const pinned = get().pins.some((item) => item.id === playlist.id);
    const pins = pinned ? get().pins.filter((item) => item.id !== playlist.id) : [...get().pins, playlist];
    try {
      localStorage.setItem(PINS_KEY, JSON.stringify(pins));
    } catch {
      // Still pinned for this session.
    }
    set({ pins });
  },
}));

function setAuth(auth: Auth | null) {
  writeAuth(auth);
  useSpotify.setState({ auth });
}

function base64Url(bytes: Uint8Array): string {
  let text = "";
  bytes.forEach((byte) => (text += String.fromCharCode(byte)));
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes).slice(0, length);
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description ?? data.error ?? `Spotify said ${response.status}`);
  return data;
}

/** Opens Spotify's sign-in in the browser and waits for it to come back. */
export async function connectSpotify(clientId: string): Promise<void> {
  const id = clientId.trim();
  if (!id) return;
  useSpotify.setState({ connecting: true, error: null });
  try {
    const verifier = randomString(64);
    const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const state = randomString(16);
    const url = new URL("https://accounts.spotify.com/authorize");
    url.search = new URLSearchParams({
      client_id: id,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: SCOPES,
      state,
    }).toString();
    const waiting = invoke<string>("spotify_auth_wait", { port: REDIRECT_PORT });
    await openUrl(url.toString());
    const query = new URLSearchParams(await waiting);
    if (query.get("error")) throw new Error(query.get("error") === "access_denied" ? "Sign-in was cancelled." : query.get("error")!);
    if (query.get("state") !== state) throw new Error("Sign-in did not match; try again.");
    const token = await tokenRequest({
      grant_type: "authorization_code",
      code: query.get("code") ?? "",
      redirect_uri: REDIRECT_URI,
      client_id: id,
      code_verifier: verifier,
    });
    setAuth({
      clientId: id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt: Date.now() + token.expires_in * 1000,
    });
  } catch (error) {
    useSpotify.setState({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    useSpotify.setState({ connecting: false });
  }
}

export function disconnectSpotify() {
  setAuth(null);
}

let refreshing: Promise<Auth | null> | null = null;

async function validAuth(): Promise<Auth | null> {
  const auth = useSpotify.getState().auth;
  if (!auth) return null;
  if (auth.expiresAt - 60_000 > Date.now()) return auth;
  refreshing ??= tokenRequest({ grant_type: "refresh_token", refresh_token: auth.refreshToken, client_id: auth.clientId })
    .then((token) => {
      const next: Auth = {
        ...auth,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? auth.refreshToken,
        expiresAt: Date.now() + token.expires_in * 1000,
      };
      setAuth(next);
      return next;
    })
    .catch(() => {
      // The refresh token was revoked: sign in again.
      setAuth(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = await validAuth();
  if (!auth) throw new SpotifyError("Not connected to Spotify", 401);
  const response = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json", ...init.headers },
  });
  if (response.status === 204 || response.status === 202) return undefined as T;
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const error = data?.error;
    throw new SpotifyError(error?.message ?? `Spotify said ${response.status}`, response.status, error?.reason);
  }
  return data as T;
}

/* --- Shapes (only the fields the page uses) --------------------------------------------------------- */

export interface SpotifyImage {
  url: string;
  width?: number | null;
}

export interface SpotifyTrack {
  uri: string;
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album?: { name: string; images: SpotifyImage[]; uri: string };
}

export interface SpotifyPlaylist {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[] | null;
  owner: { display_name?: string };
  tracks?: { total: number };
  items?: { total: number };
}

export interface SpotifyAlbum {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[];
  artists: { name: string }[];
}

/** The smallest image that is still at least `size` px (Spotify lists them largest first). */
export function imageFor(images: SpotifyImage[] | null | undefined, size = 64): string | null {
  if (!images?.length) return null;
  const fitting = images.filter((image) => (image.width ?? size) >= size);
  return (fitting[fitting.length - 1] ?? images[0])!.url;
}

export const artistNames = (artists: { name: string }[]) => artists.map((artist) => artist.name).join(", ");

export async function getPlaylists(): Promise<SpotifyPlaylist[]> {
  const page = await api<{ items: SpotifyPlaylist[] }>("/me/playlists?limit=50");
  return page.items.filter(Boolean);
}

/** A playlist's songs (newer API name first, then the older one). */
export async function getPlaylistTracks(id: string): Promise<SpotifyTrack[]> {
  type Row = { track?: SpotifyTrack | null; item?: SpotifyTrack | null };
  let page: { items: Row[] };
  try {
    page = await api<{ items: Row[] }>(`/playlists/${id}/items?limit=100`);
  } catch (error) {
    if (!(error instanceof SpotifyError) || error.status !== 404) throw error;
    page = await api<{ items: Row[] }>(`/playlists/${id}/tracks?limit=100`);
  }
  return page.items.map((row) => row.item ?? row.track).filter((track): track is SpotifyTrack => !!track && !!track.uri?.startsWith("spotify:track"));
}

export async function search(query: string): Promise<{ tracks: SpotifyTrack[]; albums: SpotifyAlbum[]; playlists: SpotifyPlaylist[] }> {
  const params = new URLSearchParams({ q: query, type: "track,album,playlist", limit: "10" });
  const data = await api<{
    tracks?: { items: SpotifyTrack[] };
    albums?: { items: SpotifyAlbum[] };
    playlists?: { items: (SpotifyPlaylist | null)[] };
  }>(`/search?${params}`);
  return {
    tracks: data.tracks?.items ?? [],
    albums: data.albums?.items ?? [],
    playlists: (data.playlists?.items ?? []).filter((item): item is SpotifyPlaylist => !!item),
  };
}

/** Lower case, without "(feat. ...)" / "[...]" asides or punctuation, for comparing names. */
function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/**
 * A song from Daylight's history (title and artist as Windows reported them) found on Spotify: the
 * result whose title and artist both match, else the one whose title matches, else Spotify's best guess.
 */
export async function findTrack(title: string, artist: string): Promise<SpotifyTrack | null> {
  const params = new URLSearchParams({ q: `${title} ${artist}`, type: "track", limit: "10" });
  const data = await api<{ tracks?: { items: SpotifyTrack[] } }>(`/search?${params}`);
  const tracks = data.tracks?.items ?? [];
  const wantTitle = plain(title);
  const wantArtist = plain(artist);
  const titleMatches = (track: SpotifyTrack) => plain(track.name) === wantTitle;
  const artistMatches = (track: SpotifyTrack) => track.artists.some((item) => wantArtist.includes(plain(item.name)));
  return (
    tracks.find((track) => titleMatches(track) && artistMatches(track)) ?? tracks.find(titleMatches) ?? tracks[0] ?? null
  );
}

/** An artist's photo from Spotify, found by name (the best match), or null. */
export async function getArtistImage(name: string): Promise<string | null> {
  const params = new URLSearchParams({ q: name, type: "artist", limit: "5" });
  const data = await api<{ artists?: { items: ({ name: string; images: SpotifyImage[] } | null)[] } }>(`/search?${params}`);
  const items = (data.artists?.items ?? []).filter((item): item is { name: string; images: SpotifyImage[] } => !!item);
  const exact = items.find((item) => item.name.toLowerCase() === name.toLowerCase()) ?? items[0];
  return imageFor(exact?.images, 240);
}

export async function getQueue(): Promise<{ current: SpotifyTrack | null; queue: SpotifyTrack[] }> {
  const data = await api<{ currently_playing: SpotifyTrack | null; queue: SpotifyTrack[] } | undefined>("/me/player/queue");
  return {
    current: data?.currently_playing ?? null,
    queue: (data?.queue ?? []).filter((item) => item?.uri?.startsWith("spotify:track")),
  };
}

interface Device {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

async function listDevices(): Promise<Device[]> {
  return (await api<{ devices: Device[] }>("/me/player/devices")).devices ?? [];
}

/**
 * The Spotify device that is this PC: the computer named like this PC, else the only computer signed in
 * (a web player does not count), else null. `exact` says whether the name matched.
 */
function pickThisPc(devices: Device[], pcName: string): { device: Device; exact: boolean } | null {
  const computers = devices.filter((device) => device.type === "Computer" && !/^web player/i.test(device.name));
  const named = pcName ? computers.find((device) => device.name.toLowerCase() === pcName.toLowerCase()) : undefined;
  if (named) return { device: named, exact: true };
  return computers.length === 1 ? { device: computers[0]!, exact: false } : null;
}

const inApp = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
let pcName: Promise<string> | null = null;
const thisPcName = () => (pcName ??= inApp() ? invoke<string>("computer_name").catch(() => "") : Promise.resolve(""));

/**
 * This PC's Spotify as a Web API device. When Spotify is not open on this PC it is opened, and Daylight
 * waits (up to 15 s) for it to sign in and show up.
 */
async function thisPcDevice(): Promise<{ device: Device; exact: boolean } | null> {
  const name = await thisPcName();
  let device = pickThisPc(await listDevices(), name);
  if (device || !inApp()) return device;
  // No computer at all: Spotify is not open here, so open it.
  await invoke("open_spotify").catch(() => undefined);
  for (let tries = 0; tries < 15 && !device; tries++) {
    await wait(1000);
    device = pickThisPc(await listDevices(), name);
  }
  return device;
}

async function withDevice(run: (query: string) => Promise<void>) {
  try {
    await run("");
  } catch (error) {
    if (error instanceof SpotifyError && error.status === 404) {
      const device = (await listDevices())[0];
      if (!device) throw new SpotifyError("Open Spotify on this PC first.", 404);
      await run(`?device_id=${encodeURIComponent(device.id)}`);
      return;
    }
    throw error;
  }
}

export interface PlayResult {
  /** Where it plays: this PC's Spotify, or the device Spotify used instead. */
  device: string;
  thisPc: boolean;
}

/**
 * Play a song, or a playlist/album (optionally from one of its songs), on this PC's Spotify: playback
 * moves here from a phone or another computer, and Spotify is opened if it is closed. Only when this PC's
 * Spotify cannot be found does it play wherever Spotify is active, and the result says where.
 */
export async function play(target: { uris?: string[]; contextUri?: string; offsetUri?: string }): Promise<PlayResult> {
  const body = JSON.stringify(
    target.contextUri
      ? { context_uri: target.contextUri, ...(target.offsetUri ? { offset: { uri: target.offsetUri } } : {}) }
      : { uris: target.uris },
  );
  const found = await thisPcDevice();
  if (found) {
    const pc = found.device;
    // A Spotify that has just opened can take a moment to accept commands.
    for (let tries = 0; ; tries++) {
      try {
        await api<void>(`/me/player/play?device_id=${encodeURIComponent(pc.id)}`, { method: "PUT", body });
        return { device: pc.name, thisPc: found.exact };
      } catch (error) {
        if (!(error instanceof SpotifyError) || error.status !== 404 || tries >= 3) throw error;
        await wait(1000);
      }
    }
  }
  await withDevice((query) => api<void>(`/me/player/play${query}`, { method: "PUT", body }));
  const active = (await listDevices()).find((device) => device.is_active);
  return { device: active?.name ?? "another device", thisPc: false };
}

export function addToQueue(uri: string) {
  return withDevice((query) =>
    api<void>(`/me/player/queue${query ? `${query}&` : "?"}uri=${encodeURIComponent(uri)}`, { method: "POST" }),
  );
}

/** What to tell the owner when a call fails. */
export function explain(error: unknown): string {
  if (error instanceof SpotifyError) {
    if (error.status === 403 && error.reason === "PREMIUM_REQUIRED") return "Playing from Daylight needs Spotify Premium.";
    if (error.status === 403) return "Spotify refused this. Check that your account is added to your developer app.";
    if (error.status === 429) return "Spotify asked to slow down. Try again in a minute.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
