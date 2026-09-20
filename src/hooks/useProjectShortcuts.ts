import { useEffect, useMemo, useRef } from "react";
import type { ProjectSummary } from "@/lib/types";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform);

interface UseProjectShortcutsOptions {
  groups: [string, ProjectSummary[]][];
  filteredProjects: ProjectSummary[];
  collapsedGroups: Set<string>;
  ungrouped: ProjectSummary[];
  busy: boolean;
  isModalOpen: boolean;
  onLaunchProject: (id: string) => void;
  onLaunchGroup: (groupProjects: ProjectSummary[]) => void;
}

export function useProjectShortcuts({
  groups,
  filteredProjects,
  collapsedGroups,
  ungrouped,
  busy,
  isModalOpen,
  onLaunchProject,
  onLaunchGroup,
}: UseProjectShortcutsOptions) {
  const launchableShortcuts = useMemo(() => {
    const list: {
      key: string;
      digit: number;
      label: string;
      action: () => void;
    }[] = [];

    let currentDigit = 1;

    function addShortcut(key: string, action: () => void) {
      if (currentDigit <= 9) {
        list.push({
          key,
          digit: currentDigit,
          label: isMac ? `⌘${currentDigit}` : `Ctrl+${currentDigit}`,
          action,
        });
        currentDigit++;
      }
    }

    if (groups.length === 0) {
      filteredProjects.forEach((p) => {
        addShortcut(`project:${p.id}`, () => onLaunchProject(p.id));
      });
    } else {
      groups.forEach(([groupName, groupProjects]) => {
        addShortcut(`group:${groupName}`, () => onLaunchGroup(groupProjects));

        if (!collapsedGroups.has(groupName)) {
          groupProjects.forEach((p) => {
            addShortcut(`project:${p.id}`, () => onLaunchProject(p.id));
          });
        }
      });

      if (ungrouped.length > 0 && !collapsedGroups.has("__ungrouped__")) {
        ungrouped.forEach((p) => {
          addShortcut(`project:${p.id}`, () => onLaunchProject(p.id));
        });
      }
    }

    const map = new Map<string, { digit: number; label: string; action: () => void }>();
    list.forEach((item) => {
      map.set(item.key, item);
    });

    return { list, map };
  }, [groups, filteredProjects, collapsedGroups, ungrouped, busy, onLaunchProject, onLaunchGroup]);

  const shortcutsRef = useRef(launchableShortcuts.list);
  shortcutsRef.current = launchableShortcuts.list;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (busy || isModalOpen) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          const item = shortcutsRef.current.find((i) => i.digit === digit);
          if (item) {
            e.preventDefault();
            item.action();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, isModalOpen]);

  return launchableShortcuts;
}
