import { sb } from './supabase.js';

export async function currentUser() {
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

export async function requireUser(to = 'lab.html') {
  const user = await currentUser();
  if (!user) location.replace(to);
  return user;
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function resetPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('lab.html', location.href).href });
  if (error) throw error;
}

export async function signOut() {
  await sb.auth.signOut();
  location.replace('lab.html');
}

// Turns raw Supabase errors into plain language.
export function friendlyError(err) {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match. Try again.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Sign in instead.';
  if (m.includes('at least') && m.includes('characters')) return 'Use a password of at least 6 characters.';
  if (m.includes('email not confirmed')) return 'Confirm your email first, then sign in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('fetch') || m.includes('network')) return 'No connection. Check your signal and try again.';
  return 'Something went wrong. Try again.';
}
