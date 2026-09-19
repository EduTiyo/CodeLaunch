import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Folder, Terminal, TerminalGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TerminalPane } from "@/components/TerminalPane";

interface Props {
  group: TerminalGroup;
  folders: Folder[];
  onAddTerminal: () => void;
  onUpdateTerminal: (terminalId: string, patch: Partial<Terminal>) => void;
  onRemoveTerminal: (terminalId: string) => void;
  onRemoveGroup: () => void;
  onUpdateGroupName: (name: string) => void;
  onMoveGroupUp?: () => void;
  onMoveGroupDown?: () => void;
  onMoveTerminal: (terminalId: string, direction: "left" | "right") => void;
}

/** A group of terminals rendered as a single split panel, mirroring the real
 * VS Code layout this project generates (panes divided side by side). */
export function TerminalGroupPanel({
  group,
  folders,
  onAddTerminal,
  onUpdateTerminal,
  onRemoveTerminal,
  onRemoveGroup,
  onUpdateGroupName,
  onMoveGroupUp,
  onMoveGroupDown,
  onMoveTerminal,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <input
          value={group.name}
          onChange={(e) => onUpdateGroupName(e.target.value)}
          placeholder={t("terminals.groupNamePlaceholder")}
          className="rounded px-1.5 py-0.5 text-sm font-medium hover:bg-muted/50 focus:bg-muted focus:outline-none transition-colors"
          aria-label={t("terminals.groupNamePlaceholder")}
        />
        <div className="flex items-center gap-1">
          {onMoveGroupUp && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={onMoveGroupUp}
              aria-label={t("terminals.moveUp")}
              title={t("terminals.moveUp")}
            >
              <ChevronUp className="size-3.5" />
            </Button>
          )}
          {onMoveGroupDown && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={onMoveGroupDown}
              aria-label={t("terminals.moveDown")}
              title={t("terminals.moveDown")}
            >
              <ChevronDown className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onAddTerminal}>
            <Plus className="size-3.5" />
            {t("terminals.addTerminal")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onRemoveGroup}
            aria-label={t("terminals.removeGroup")}
            title={t("terminals.removeGroup")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex overflow-hidden rounded-lg border border-border">
        {group.terminals.length === 0 ? (
          <p className="w-full p-4 text-center text-xs text-muted-foreground">
            {t("terminals.emptyGroup")}
          </p>
        ) : (
          group.terminals.map((terminal, index) => (
            <TerminalPane
              key={terminal.id}
              terminal={terminal}
              folders={folders}
              onChange={(patch) => onUpdateTerminal(terminal.id, patch)}
              onRemove={() => onRemoveTerminal(terminal.id)}
              onMoveLeft={index > 0 ? () => onMoveTerminal(terminal.id, "left") : undefined}
              onMoveRight={
                index < group.terminals.length - 1
                  ? () => onMoveTerminal(terminal.id, "right")
                  : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
