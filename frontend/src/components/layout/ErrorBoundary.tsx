import React from "react";

/**
 * LA-UX-REFRESH-003 H9 (bug sweep) — the app had no error boundary anywhere.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * so a single bad value in any one view — a null where a shape was expected,
 * a chart handed a malformed row — took the entire application to a blank
 * white page with the failure visible only in the console. For a student
 * mid-revision that is indistinguishable from the site being down.
 *
 * This catches it at the route level: the header and the rest of the shell
 * survive, the failure is stated plainly, and there is a way out that does
 * not involve knowing to press F5.
 */

interface Props {
  children: React.ReactNode;
  /** Changing this resets the boundary — pass the current tab/route so navigating away from a broken screen recovers. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props): void {
    // Navigating to a different screen clears the error: the broken view is
    // gone, so keeping its error on screen would strand the user on it.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Kept as a console error rather than sent anywhere: this project has no
    // error-reporting service configured, and inventing a destination for
    // user data would be worse than logging it locally.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="max-w-xl mx-auto my-16 p-8 rounded-[24px] bg-white dark:bg-[var(--navy)] border border-rose-200 dark:border-rose-900/60 shadow-sm text-center">
        <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">error</span>
        </div>
        <h2 className="text-xl font-black text-[#00243B] dark:text-white mb-2">This screen didn't load</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-1">
          Something went wrong while rendering this page. Your work and your results are unaffected — this is a display
          failure, not a data one.
        </p>
        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 break-words mb-6">{error.message}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => this.setState({ error: null })}
            className="px-5 py-2.5 rounded-xl bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.assign("/dashboard")}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }
}
