import { useSyncExternalStore } from "react";
import { NEET_SYLLABUS, subscribeSyllabus } from "../data/neetSyllabus";

/**
 * Subscribes the component to syllabus changes (e.g. topic status edits made in
 * the wizard's Syllabus Progress step) without needing a full context provider.
 * Returns a version counter — components should still read from NEET_SYLLABUS
 * directly for the actual data, and re-render whenever this hook's value changes.
 */
export function useSyllabusVersion(): number {
  return useSyncExternalStore(
    subscribeSyllabus,
    () => versionSnapshot,
    () => versionSnapshot
  );
}

let versionSnapshot = 0;
subscribeSyllabus(() => {
  versionSnapshot += 1;
});

export { NEET_SYLLABUS };
