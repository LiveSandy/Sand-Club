// Drop-in replacement for the claude.ai artifact's window.storage-backed
// helpers. Same function signatures as before (loadKey/saveKey/
// loadPersonalKey/savePersonalKey), so App.jsx needed almost no changes —
// just import these instead of defining them locally.
//
// Shared data (rosters, plans, attendance, everything the whole club
// needs to see) lives in Supabase, in a single key/value table. Personal
// data is just the login session, which is inherently per-device, so it
// stays in localStorage — no Supabase table needed for that.

import { supabase } from "./supabaseClient";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function loadKey(key, fallback) {
  try {
    const { data, error } = await withTimeout(
      supabase.from("app_storage").select("value").eq("key", key).maybeSingle(),
      4000
    );
    if (error || !data) return fallback;
    return data.value ?? fallback;
  } catch (e) {
    console.error("loadKey failed, using fallback", key, e);
    return fallback;
  }
}

export async function saveKey(key, value) {
  try {
    const { error } = await withTimeout(
      supabase.from("app_storage").upsert({ key, value, updated_at: new Date().toISOString() }),
      4000
    );
    if (error) console.error("saveKey failed", key, error);
  } catch (e) {
    console.error("saveKey failed (kept in-memory)", key, e);
  }
}

export async function loadPersonalKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function savePersonalKey(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error("savePersonalKey failed", key, e);
  }
}
