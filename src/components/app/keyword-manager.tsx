"use client";

import { useEffect, useMemo, useState } from "react";
import { KeywordType } from "@prisma/client";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { normalizeText } from "@/lib/utils";

type Option = {
  id: string;
  name: string;
};

type Keyword = {
  id: string;
  text: string;
  keywordType: KeywordType;
  isPrimaryTarget: boolean;
  isActive: boolean;
  marketId: string | null;
  intentGroupId: string | null;
  market?: { name: string } | null;
  intentGroup?: { name: string } | null;
  localPair?: { id: string } | null;
  corePair?: { id: string } | null;
};

type Pair = {
  id: string;
  localKeyword: { id: string; text: string };
  coreKeyword: { id: string; text: string };
};

const keywordTypeOptions = [KeywordType.LOCAL, KeywordType.CORE, KeywordType.BRANDED, KeywordType.OTHER];

export function KeywordManager({
  projectId,
  markets,
  intentGroups,
  keywordSets,
}: {
  projectId: string;
  markets: Option[];
  intentGroups: Option[];
  keywordSets: Option[];
}) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [message, setMessage] = useState<string>("");

  const [text, setText] = useState("");
  const [keywordType, setKeywordType] = useState<KeywordType>(KeywordType.LOCAL);
  const [marketId, setMarketId] = useState<string>("none");
  const [intentGroupId, setIntentGroupId] = useState<string>("none");
  const [keywordSetId, setKeywordSetId] = useState<string>("none");
  const [primaryTarget, setPrimaryTarget] = useState<boolean>(true);

  const [bulkText, setBulkText] = useState("");

  const [pairLocalId, setPairLocalId] = useState<string>("none");
  const [pairCoreId, setPairCoreId] = useState<string>("none");

  const localKeywords = keywords.filter((keyword) => keyword.keywordType === KeywordType.LOCAL && keyword.isActive);
  const coreKeywords = keywords.filter((keyword) => keyword.keywordType === KeywordType.CORE && keyword.isActive);

  async function refresh() {
    const [keywordsResponse, pairsResponse] = await Promise.all([
      fetch(`/api/keywords?projectId=${projectId}&activeOnly=false`),
      fetch(`/api/keywords/pairs?projectId=${projectId}`),
    ]);

    if (keywordsResponse.ok) {
      const data = await keywordsResponse.json();
      setKeywords(data);
    }

    if (pairsResponse.ok) {
      const data = await pairsResponse.json();
      setPairs(data);
    }
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Keyword[]>();

    for (const keyword of keywords.filter((item) => item.isActive)) {
      const key = `${normalizeText(keyword.text)}|${keyword.keywordType}|${keyword.marketId ?? "none"}`;
      const list = map.get(key) ?? [];
      list.push(keyword);
      map.set(key, list);
    }

    return [...map.values()].filter((group) => group.length > 1);
  }, [keywords]);

  const incompletePairs = useMemo(
    () =>
      keywords.filter((keyword) => {
        if (!keyword.isActive) return false;
        if (keyword.keywordType === KeywordType.LOCAL) return !keyword.localPair;
        if (keyword.keywordType === KeywordType.CORE) return !keyword.corePair;
        return false;
      }),
    [keywords],
  );

  async function addKeyword() {
    setMessage("");
    const response = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        keywordType,
        projectId,
        marketId: marketId === "none" ? null : marketId,
        intentGroupId: intentGroupId === "none" ? null : intentGroupId,
        keywordSetId: keywordSetId === "none" ? null : keywordSetId,
        isPrimaryTarget: primaryTarget,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to add keyword");
      return;
    }

    setText("");
    setMessage("Keyword added");
    refresh();
  }

  async function addBulkKeywords() {
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        text: line,
        keywordType,
        marketId: marketId === "none" ? null : marketId,
        intentGroupId: intentGroupId === "none" ? null : intentGroupId,
        keywordSetId: keywordSetId === "none" ? null : keywordSetId,
        isPrimaryTarget: primaryTarget,
      }));

    if (rows.length === 0) {
      return;
    }

    const response = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, keywords: rows }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to bulk import keywords");
      return;
    }

    setBulkText("");
    setMessage(`Bulk import complete. Added ${data.created} keywords.`);
    refresh();
  }

  async function togglePrimary(keyword: Keyword) {
    await fetch(`/api/keywords/${keyword.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimaryTarget: !keyword.isPrimaryTarget }),
    });

    refresh();
  }

  async function toggleActive(keyword: Keyword) {
    await fetch(`/api/keywords/${keyword.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !keyword.isActive }),
    });

    refresh();
  }

  async function createPair() {
    if (pairLocalId === "none" || pairCoreId === "none") return;

    const response = await fetch("/api/keywords/pairs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        localKeywordId: pairLocalId,
        coreKeywordId: pairCoreId,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to create pair");
      return;
    }

    setPairLocalId("none");
    setPairCoreId("none");
    setMessage("Pair created");
    refresh();
  }

  async function removePair(pairId: string) {
    await fetch("/api/keywords/pairs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairId }),
    });

    refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Add Keywords</CardTitle>
            <CardDescription>Create individual or bulk keywords with Local/Core typing and intent group assignment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Keyword Text</Label>
                <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="miami divorce lawyer" />
              </div>
              <div className="space-y-1">
                <Label>Keyword Type</Label>
                <Select value={keywordType} onValueChange={(value) => setKeywordType(value as KeywordType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {keywordTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Market</Label>
                <Select value={marketId} onValueChange={setMarketId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {markets.map((market) => (
                      <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Intent Group</Label>
                <Select value={intentGroupId} onValueChange={setIntentGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {intentGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Keyword Set</Label>
                <Select value={keywordSetId} onValueChange={setKeywordSetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {keywordSets.map((set) => (
                      <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => setPrimaryTarget((prev) => !prev)} variant={primaryTarget ? "default" : "outline"}>
                  {primaryTarget ? "Primary Target" : "Not Primary"}
                </Button>
              </div>
            </div>

            <Button onClick={addKeyword} disabled={!text.trim()}>Add Keyword</Button>

            <div className="space-y-2">
              <Label>Bulk Import (one keyword per line)</Label>
              <Textarea rows={7} value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={"miami divorce lawyer\nmiami child custody lawyer"} />
              <Button variant="secondary" onClick={addBulkKeywords}>Bulk Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyword Pairing</CardTitle>
            <CardDescription>Create Local ↔ Core pair relationships for side-by-side comparison logic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Local Keyword</Label>
                <Select value={pairLocalId} onValueChange={setPairLocalId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select LOCAL keyword</SelectItem>
                    {localKeywords.map((keyword) => (
                      <SelectItem key={keyword.id} value={keyword.id}>{keyword.text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Core Keyword</Label>
                <Select value={pairCoreId} onValueChange={setPairCoreId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select CORE keyword</SelectItem>
                    {coreKeywords.map((keyword) => (
                      <SelectItem key={keyword.id} value={keyword.id}>{keyword.text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={createPair}>Create Pair</Button>

            <div className="space-y-2">
              {pairs.map((pair) => (
                <div key={pair.id} className="flex items-center justify-between rounded-md border border-stone-200 p-2 text-sm">
                  <span>{pair.localKeyword.text} ↔ {pair.coreKeyword.text}</span>
                  <Button variant="outline" size="sm" onClick={() => removePair(pair.id)}>Unpair</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Keyword Health</CardTitle>
            <CardDescription>Detect duplicates and incomplete Local/Core pair coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <Badge variant={duplicateGroups.length ? "error" : "success"}>Duplicate groups: {duplicateGroups.length}</Badge>
              <Badge variant={incompletePairs.length ? "warning" : "success"}>Incomplete pairs: {incompletePairs.length}</Badge>
            </div>

            {incompletePairs.length > 0 ? (
              <Alert variant="warning">
                <AlertCircle className="mb-1 h-4 w-4" />
                <AlertTitle>Unpaired keywords detected</AlertTitle>
                <AlertDescription>
                  {incompletePairs.slice(0, 6).map((keyword) => `${keyword.text} (${keyword.keywordType})`).join(", ")}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyword Table</CardTitle>
            <CardDescription>{keywords.length} keywords</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[700px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((keyword) => (
                    <TableRow key={keyword.id}>
                      <TableCell className="font-medium">{keyword.text}</TableCell>
                      <TableCell><Badge variant="outline">{keyword.keywordType}</Badge></TableCell>
                      <TableCell>{keyword.intentGroup?.name ?? "-"}</TableCell>
                      <TableCell>{keyword.market?.name ?? "-"}</TableCell>
                      <TableCell>{keyword.isPrimaryTarget ? "Yes" : "No"}</TableCell>
                      <TableCell>{keyword.isActive ? "Active" : "Archived"}</TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => togglePrimary(keyword)}>
                          Toggle Primary
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(keyword)}>
                          {keyword.isActive ? "Archive" : "Restore"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
