/** localStorage key for the user's theme preference. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Inlined in <head>: applies the saved theme before first paint so there is no
 * light→dark flash. Keep in sync with applyTheme() in components/providers/theme.tsx.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})()`;
