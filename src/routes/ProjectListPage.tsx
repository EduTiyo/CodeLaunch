import { useTranslation } from "react-i18next";
import { useProjectList } from "@/hooks/useProjectList";
import { useProjectShortcuts } from "@/hooks/useProjectShortcuts";
import { ProjectListHeader } from "@/components/projects/ProjectListHeader";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { ProjectGroupSection } from "@/components/projects/ProjectGroupSection";
import { BatchActionBar } from "@/components/projects/BatchActionBar";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { EmptyProjectsState } from "@/components/projects/EmptyProjectsState";
import { ProjectGroupDialog } from "@/components/ProjectGroupDialog";
import { RenameGroupDialog } from "@/components/RenameGroupDialog";

interface Props {
  onEdit: (id: string | null) => void;
}

export function ProjectListPage({ onEdit }: Props) {
  const { t } = useTranslation();
  const list = useProjectList();

  const isModalOpen =
    !!list.projectToDelete ||
    list.isGroupDialogOpen ||
    list.isRenameDialogOpen;

  const shortcuts = useProjectShortcuts({
    groups: list.groups,
    filteredProjects: list.filteredProjects,
    collapsedGroups: list.collapsedGroups,
    ungrouped: list.ungrouped,
    busy: list.busy,
    isModalOpen,
    onLaunchProject: list.handleLaunch,
    onLaunchGroup: list.handleLaunchGroup,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6 pb-24">
      <ProjectListHeader
        search={list.search}
        onSearchChange={list.setSearch}
        hasProjects={list.projects.length > 0}
        busy={list.busy}
        onImport={list.handleImport}
        onNewProject={() => onEdit(null)}
      />

      {list.projects.length === 0 ? (
        <EmptyProjectsState />
      ) : list.filteredProjects.length === 0 ? (
        <EmptyProjectsState
          search={list.search}
          onClearSearch={() => list.setSearch("")}
        />
      ) : list.groups.length === 0 ? (
        <ProjectTable
          items={list.filteredProjects}
          selected={list.selected}
          onToggle={list.toggle}
          showGroupBadge
          shortcutsMap={shortcuts.map}
          busy={list.busy}
          onLaunch={list.handleLaunch}
          onEdit={onEdit}
          onDuplicate={list.handleDuplicate}
          onAssignGroup={list.openGroupDialogForSingle}
          onDelete={list.setProjectToDelete}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {list.groups.map(([groupName, groupProjects]) => {
            const isCollapsed = list.collapsedGroups.has(groupName);
            const allSelected =
              groupProjects.length > 0 &&
              groupProjects.every((p) => list.selected.has(p.id));
            const groupShortcut = shortcuts.map.get(`group:${groupName}`);

            return (
              <ProjectGroupSection
                key={groupName}
                title={groupName}
                count={groupProjects.length}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => list.toggleGroupCollapse(groupName)}
                allSelected={allSelected}
                onToggleSelect={() => list.handleToggleGroupSelect(groupProjects)}
                shortcutLabel={groupShortcut?.label}
                busy={list.busy}
                onLaunchGroup={() => list.handleLaunchGroup(groupProjects)}
                onRenameGroup={() => {
                  list.setGroupToRename(groupName);
                  list.setIsRenameDialogOpen(true);
                }}
                onUngroupAll={() => list.handleUngroupAll(groupName)}
              >
                <ProjectTable
                  items={groupProjects}
                  selected={list.selected}
                  onToggle={list.toggle}
                  shortcutsMap={shortcuts.map}
                  busy={list.busy}
                  onLaunch={list.handleLaunch}
                  onEdit={onEdit}
                  onDuplicate={list.handleDuplicate}
                  onAssignGroup={list.openGroupDialogForSingle}
                  onDelete={list.setProjectToDelete}
                />
              </ProjectGroupSection>
            );
          })}

          {list.ungrouped.length > 0 && (
            <ProjectGroupSection
              title={t("projects.ungroupedProjects")}
              count={list.ungrouped.length}
              isCollapsed={list.collapsedGroups.has("__ungrouped__")}
              onToggleCollapse={() => list.toggleGroupCollapse("__ungrouped__")}
              allSelected={
                list.ungrouped.length > 0 &&
                list.ungrouped.every((p) => list.selected.has(p.id))
              }
              onToggleSelect={() => list.handleToggleGroupSelect(list.ungrouped)}
              busy={list.busy}
            >
              <ProjectTable
                items={list.ungrouped}
                selected={list.selected}
                onToggle={list.toggle}
                shortcutsMap={shortcuts.map}
                busy={list.busy}
                onLaunch={list.handleLaunch}
                onEdit={onEdit}
                onDuplicate={list.handleDuplicate}
                onAssignGroup={list.openGroupDialogForSingle}
                onDelete={list.setProjectToDelete}
              />
            </ProjectGroupSection>
          )}
        </div>
      )}

      <BatchActionBar
        selectedCount={list.selected.size}
        busy={list.busy}
        onGroupSelected={list.openGroupDialogForSelection}
        onLaunchSelected={list.handleLaunchSelected}
      />

      <DeleteProjectDialog
        project={list.projectToDelete}
        busy={list.busy}
        onClose={() => list.setProjectToDelete(null)}
        onConfirm={list.handleConfirmDelete}
      />

      <ProjectGroupDialog
        open={list.isGroupDialogOpen}
        onOpenChange={list.setIsGroupDialogOpen}
        selectedCount={list.targetProjectsForGroup.length}
        existingGroups={list.existingGroups}
        initialGroupName={list.initialGroupNameForDialog}
        hasGroupedProjects={list.hasGroupedProjects}
        onSaveGroup={list.handleSaveGroup}
      />

      <RenameGroupDialog
        open={list.isRenameDialogOpen}
        onOpenChange={list.setIsRenameDialogOpen}
        oldName={list.groupToRename}
        onRename={list.handleRenameGroup}
      />
    </div>
  );
}
