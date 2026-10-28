export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in <head> before first paint: resolves the stored preference (or the
 * OS setting) into data-theme on <html>, and keeps following the OS while
 * the preference is "system". Kept tiny and dependency-free on purpose.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,k="${THEME_STORAGE_KEY}",m=window.matchMedia("(prefers-color-scheme: dark)");function p(){try{return localStorage.getItem(k)}catch(e){return null}}function a(){var v=p();d.setAttribute("data-theme",v==="light"||v==="dark"?v:(m.matches?"dark":"light"))}a();m.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===k)a()})})()`;

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

const PREFERENCE_EVENT = "theme-preference-change";

/** For useSyncExternalStore: fires on changes from this tab or another one. */
export function subscribeThemePreference(onChange: () => void): () => void {
  window.addEventListener(PREFERENCE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function applyThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode / blocked storage: still apply for this page view.
  }
  const dark =
    preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
}
