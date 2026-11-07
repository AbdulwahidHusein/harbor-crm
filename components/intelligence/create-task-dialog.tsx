"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTaskFromRecommendation } from "@/actions/intelligence/recommendations";

type SubjectType = "contact" | "account" | "opportunity" | "lead";

const DUE_OPTIONS = [
  { value: "0", label: "Today" },
  { value: "1", label: "Tomorrow" },
  { value: "3", label: "In 3 days" },
  { value: "7", label: "In a week" },
];

/**
 * Turn a recommendation into a CRM task. The user reviews and edits the task
 * before anything is written; nothing is created without this confirmation.
 */
export function CreateTaskDialog({
  subjectType,
  subjectId,
  subjectLabel,
  defaultTitle,
  defaultDueInDays = 1,
  details,
  onCreated,
  trigger,
}: {
  subjectType: SubjectType;
  subjectId: string;
  subjectLabel: string;
  defaultTitle: string;
  defaultDueInDays?: number;
  details?: string;
  onCreated?: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState(details ?? "");
  const [due, setDue] = useState(String(Math.min(defaultDueInDays, 7)));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError("Give the task a short title.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createTaskFromRecommendation({
        subjectType,
        subjectId,
        title: title.trim(),
        details: notes.trim() || undefined,
        dueInDays: Number(due),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Task created", { description: title.trim() });
      setOpen(false);
      onCreated?.();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setTitle(defaultTitle);
          setNotes(details ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus /> Create task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create follow-up task</DialogTitle>
            <DialogDescription>Linked to {subjectLabel}. Assigned to you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ci-task-title">Title</Label>
            <Input id="ci-task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ci-task-notes">Notes</Label>
            <Textarea id="ci-task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label>Due</Label>
            <Select value={due} onValueChange={setDue}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DUE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
