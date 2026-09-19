import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Folder, Terminal, TerminalGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TerminalGroupPanel } from "@/components/TerminalGroupPanel";

interface Props {
  groups: TerminalGroup[];
  folders: Folder[];
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  onAddTerminal: (groupId: string) => void;
  onUpdateTerminal: (groupId: string, terminalId: string, patch: Partial<Terminal>) => void;
  onRemoveTerminal: (groupId: string, terminalId: string) => void;
}

export function TerminalGrid({
  groups,
  folders,
  onAddGroup,
  onRemoveGroup,
  onAddTerminal,
  onUpdateTerminal,
  onRemoveTerminal,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <TerminalGroupPanel
          key={group.id}
          group={group}
          folders={folders}
          onAddTerminal={() => onAddTerminal(group.id)}
          onUpdateTerminal={(terminalId, patch) => onUpdateTerminal(group.id, terminalId, patch)}
          onRemoveTerminal={(terminalId) => onRemoveTerminal(group.id, terminalId)}
          onRemoveGroup={() => onRemoveGroup(group.id)}
        />
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={onAddGroup}>
        <Plus className="size-3.5" />
        {t("terminals.addGroup")}
      </Button>
    </div>
  );
}
