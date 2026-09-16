import { SquareTerminal, X } from "lucide-react";
import type { Folder, Terminal } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  terminal: Terminal;
  folders: Folder[];
  onChange: (patch: Partial<Terminal>) => void;
  onRemove: () => void;
}

/** One pane in a terminal split — styled like a real VS Code terminal tab. */
export function TerminalPane({ terminal, folders, onChange, onRemove }: Props) {
  return (
    <div className="flex min-w-48 flex-1 flex-col border-r border-border last:border-r-0">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1.5">
        <SquareTerminal className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={terminal.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
          aria-label="Nome do terminal"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-5 shrink-0"
          onClick={onRemove}
          aria-label="Remover terminal"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 p-2">
        <Select value={terminal.folder_id} onValueChange={(folder_id) => onChange({ folder_id })}>
          <SelectTrigger size="sm" className="w-full font-mono text-xs">
            <SelectValue placeholder="Pasta" />
          </SelectTrigger>
          <SelectContent>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id} className="font-mono text-xs">
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          placeholder="comando (opcional)"
          value={terminal.command ?? ""}
          onChange={(e) => onChange({ command: e.target.value || null })}
          className="min-h-14 resize-none font-mono text-xs"
        />

        <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          <Switch
            checked={terminal.keep_alive}
            onCheckedChange={(keep_alive) => onChange({ keep_alive })}
          />
          manter vivo após o comando
        </Label>
      </div>
    </div>
  );
}
