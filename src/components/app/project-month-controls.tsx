"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type ProjectOption = {
  id: string;
  name: string;
};

type Props = {
  projects: ProjectOption[];
  currentProjectId: string;
  currentMonth: string;
};

export function ProjectMonthControls({ projects, currentProjectId, currentMonth }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(currentMonth);

  const query = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(query.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label>Project</Label>
        <Select value={currentProjectId} onValueChange={(value) => update("projectId", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Reporting Month</Label>
        <Input
          type="month"
          value={month}
          onChange={(event) => {
            const value = event.target.value;
            setMonth(value);
            if (value) {
              update("reportingMonth", value);
            }
          }}
        />
      </div>
    </div>
  );
}
