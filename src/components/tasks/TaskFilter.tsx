
"use client";

import * as React from 'react'; // Imported React for React.memo
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TASK_PRIORITIES, TASK_FILTERABLE_STATUSES } from "@/lib/constants";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { FilterIcon, XIcon } from "lucide-react";

interface TaskFilterProps {
  appliedFilters: {
    status: TaskStatus[];
    priority: TaskPriority[];
  };
  onFilterChange: (filterType: "status" | "priority", value: string) => void;
  onClearFilters: () => void;
}

const TaskFilterComponent = ({ appliedFilters, onFilterChange, onClearFilters }: TaskFilterProps) => {
  const activeFilterCount = appliedFilters.status.length + appliedFilters.priority.length;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="relative">
            <FilterIcon className="mr-2 h-4 w-4" />
            Filter Tasks
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TASK_FILTERABLE_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={appliedFilters.status.includes(status)}
              onCheckedChange={() => onFilterChange("status", status)}
            >
              {status}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TASK_PRIORITIES.map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority}
              checked={appliedFilters.priority.includes(priority)}
              onCheckedChange={() => onFilterChange("priority", priority)}
            >
              {priority}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
          <XIcon className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
};

export const TaskFilter = React.memo(TaskFilterComponent);
