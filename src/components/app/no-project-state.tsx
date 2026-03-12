import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoProjectState({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Create a project from your business URL in Workspace before using this section.</CardDescription>
      </CardHeader>
      <CardContent>
        <Link className="inline-flex rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100" href="/">
          Go To Workspace
        </Link>
      </CardContent>
    </Card>
  );
}
