export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Redirect to our custom NHS login page (not Manus OAuth portal)
// This prevents the app from redirecting to the Manus OAuth portal when the session expires.
export const getLoginUrl = (returnPath?: string) => {
  const base = `${window.location.origin}/login`;
  if (returnPath) return `${base}?returnTo=${encodeURIComponent(returnPath)}`;
  return base;
};
