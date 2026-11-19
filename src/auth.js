import { sb, hasCloud } from './supabase.js';

const MODE = 'bm:mode';
export const guestMode = () => localStorage.getItem(MODE) === 'guest';
export const enterGuest = () => localStorage.setItem(MODE, 'guest');
export const leaveGuest = () => localStorage.removeItem(MODE);

// Reads the stored session. It works offline, so a signed-in person is never bounced to sign-in without signal.
export async function currentUser() {
  if (!hasCloud) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user ?? null;
  } catch { return null; }
}

// Signed in → the user. Guest mode → { id: 'guest' }. Otherwise go to sign-in.
export async function requireUser(to = 'lab.html') {
  const user = await currentUser();
  if (user) { leaveGuest(); return user; }
  if (guestMode()) return { id: 'guest', email: '', guest: true };
  location.replace(to);
  return null;
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: new URL('app.html', location.href).href } });
  if (error) throw error;
  return data;
}

export async function magicLink(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: new URL('app.html', location.href).href } });
  if (error) throw error;
}

export async function resetPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('lab.html?reset=1', location.href).href });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  leaveGuest();
  try { await sb?.auth.signOut(); } catch { /* already signed out */ }
  location.replace('lab.html');
}

export function friendlyError(err) {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match. Try again.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Sign in instead.';
  if (m.includes('at least') && m.includes('characters')) return 'Use a password of at least 6 characters.';
  if (m.includes('email not confirmed')) return 'Confirm your email first, then sign in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('fetch') || m.includes('network')) return 'No connection. Check your signal, or continue without an account.';
  return err?.message || 'Something went wrong. Try again.';
}
