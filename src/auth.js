import { sb } from './supabase.js';

export async function currentUser() {
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

// Guard for app pages: sends signed-out visitors to the lab.
export async function requireUser(to = 'lab.html') {
  const user = await currentUser();
  if (!user) location.replace(to);
  return user;
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Returns { session } so the caller knows whether email confirmation is pending.
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await sb.auth.signOut();
  location.replace('lab.html');
}
