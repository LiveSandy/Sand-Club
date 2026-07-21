import { supabase } from "./supabaseClient";

export async function signUp(email, password, label) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error };
  // Create their profile row right away (role stays null until the
  // Director approves them — see schema.sql for why this is safe to do
  // client-side).
  if (data.user) {
    await supabase.from("profiles").insert({ id: data.user.id, email, label: label || email, approved: false });
  }
  return { data };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOutUser() {
  await supabase.auth.signOut();
}

export async function getCurrentProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  return profile ? { ...profile, session } : { id: session.user.id, email: session.user.email, approved: false, session };
}

export function onAuthChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}

export async function listPendingProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").eq("approved", false);
  if (error) {
    console.error("listPendingProfiles failed", error);
    return [];
  }
  return data || [];
}

export async function listAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("listAllProfiles failed", error);
    return [];
  }
  return data || [];
}

export async function approveProfile(id, { role, coachId, playerId, label }) {
  const { error } = await supabase
    .from("profiles")
    .update({ role, coach_id: coachId || null, player_id: playerId || null, label, approved: true })
    .eq("id", id);
  if (error) console.error("approveProfile failed", error);
  return { error };
}

export async function revokeProfile(id) {
  const { error } = await supabase.from("profiles").update({ approved: false, role: null }).eq("id", id);
  if (error) console.error("revokeProfile failed", error);
  return { error };
}
