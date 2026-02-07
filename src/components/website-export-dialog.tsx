"use client";

import { useState } from "react";
import { Globe, Loader2, FileText, BookOpen, Share2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  collectionId: number;
  collectionName: string;
  paperCount: number;
  synthesisCount: number;
  knowledgeCount: number;
}

export function WebsiteExportDialog({
  collectionId,
  collectionName,
  paperCount,
  synthesisCount,
  knowledgeCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/website-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ||
        `${collectionName.replace(/\s+/g, "_")}_research_site.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      console.error("Website export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="h-4 w-4" /> Export Website
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Research Website</DialogTitle>
          <DialogDescription>
            Generate a static website from this collection that can be hosted
            anywhere (GitHub Pages, Netlify, S3, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h4 className="font-medium text-sm">{collectionName}</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>
                  {paperCount} {paperCount === 1 ? "paper" : "papers"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                <span>
                  {synthesisCount}{" "}
                  {synthesisCount === 1 ? "synthesis" : "syntheses"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5" />
                <span>{knowledgeCount} knowledge items</span>
              </div>
              <div className="flex items-center gap-2">
                <Share2 className="h-3.5 w-3.5" />
                <span>Interactive citation graph</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>The exported zip file includes:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Landing page with collection overview &amp; synthesis</li>
              <li>Individual pages for each paper</li>
              <li>Categorized knowledge browser</li>
              <li>Interactive citation graph (React + xyflow)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting || paperCount === 0}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" /> Export Website
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
