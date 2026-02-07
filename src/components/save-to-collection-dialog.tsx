"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Check } from "lucide-react";
import type { SearchResult, Collection } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (result: SearchResult) => Promise<number>;
  result: SearchResult;
}

export function SaveToCollectionDialog({ open, onOpenChange, onSave, result }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savedToIds, setSavedToIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSavedToIds(new Set());
      fetch("/api/collections")
        .then((r) => r.json())
        .then(setCollections)
        .catch(() => setCollections([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleSaveToCollection = useCallback(
    async (collectionId: number) => {
      setSaving(true);
      try {
        const paperId = await onSave(result);
        const res = await fetch(`/api/collections/${collectionId}/papers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId }),
        });
        const data = await res.json();
        if (data.alreadyExists) {
          setSavedToIds((prev) => new Set(prev).add(collectionId));
        } else {
          setSavedToIds((prev) => new Set(prev).add(collectionId));
          // Brief delay so user sees the checkmark
          setTimeout(() => onOpenChange(false), 400);
        }
      } finally {
        setSaving(false);
      }
    },
    [onSave, result, onOpenChange]
  );

  const handleCreateCollection = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const collection = await res.json();
      setCollections((prev) => [{ ...collection, paperCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev]);
      setNewName("");
      await handleSaveToCollection(collection.id);
    } finally {
      setCreating(false);
    }
  }, [newName, handleSaveToCollection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to Collection</DialogTitle>
          <DialogDescription className="line-clamp-1">{result.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
            />
            <Button onClick={handleCreateCollection} disabled={creating || !newName.trim()} size="sm">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No collections yet. Create one above.
            </p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {collections.map((c) => {
                const alreadySaved = savedToIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSaveToCollection(c.id)}
                    disabled={saving || alreadySaved}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left ${
                      alreadySaved ? "bg-emerald-500/10 text-emerald-400" : "hover:bg-accent"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {alreadySaved && <Check className="h-3 w-3" />}
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {alreadySaved ? "Added" : `${c.paperCount} papers`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
