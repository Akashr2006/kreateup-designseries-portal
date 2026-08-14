"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { NOTE_COLORS, type NoteColor } from "@/lib/constants";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type NoteRow = {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  updatedAt: string;
};

const BLANK = { title: "", body: "", color: "blue" as NoteColor };

/**
 * Private notes. Nothing here is ever readable by a mentor or admin — the API
 * scopes every query to the signed-in user and there is no console view.
 *
 * Editing autosaves on a debounce, so the note is never lost to a closed tab.
 */
export function NotesClient({ notes }: { notes: NoteRow[] }) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<NoteRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [deleting, setDeleting] = useState<NoteRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const saveTimer = useRef<number | null>(null);

  const filtered = notes.filter((note) =>
    query.trim()
      ? `${note.title} ${note.body}`.toLowerCase().includes(query.trim().toLowerCase())
      : true
  );

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  // Debounced autosave while a note is open.
  useEffect(() => {
    if (!editing) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      try {
        await fetch("/api/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, title: draft.title || "Untitled note", body: draft.body, color: draft.color }),
        });
        setSavedAt(new Date().toISOString());
        router.refresh();
      } catch {
        /* the user will see the "not saved" state and can retry by typing */
      }
    }, 900);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, editing, router]);

  const openNew = () => {
    setDraft(BLANK);
    setSavedAt(null);
    setCreating(true);
  };

  const openExisting = (note: NoteRow) => {
    setDraft({ title: note.title, body: note.body, color: note.color as NoteColor });
    setSavedAt(null);
    setEditing(note);
  };

  const create = async () => {
    if (!draft.title.trim() && !draft.body.trim()) {
      toast.warning("Nothing to save", "Add a title or some text first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, title: draft.title.trim() || "Untitled note" }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not save the note", payload.error);
        return;
      }
      toast.success("Note saved");
      setCreating(false);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (note: NoteRow) => {
    try {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
      });
      router.refresh();
    } catch {
      toast.error("Could not update the note");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await fetch("/api/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleting.id }),
      });
      toast.success("Note deleted");
      setDeleting(null);
      setEditing(null);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <Input
            icon="search"
            placeholder="Search your notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search notes"
          />
        </div>
        <Button icon="plus" onClick={openNew} className="ml-auto">
          New note
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          tone="green"
          title="Your notebook is empty"
          description="This is your private scratchpad — sprint checklists, mentor feedback, half-formed ideas. Nobody else can read it, not even an admin."
          action={
            <Button icon="plus" onClick={openNew}>
              Write your first note
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState compact icon="search" title="No notes match that search" />
      ) : (
        <div className="flex flex-col gap-5">
          {pinned.length > 0 ? (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
                <Icon name="pin" className="h-3.5 w-3.5" />
                Pinned
              </h2>
              <NoteGrid notes={pinned} onOpen={openExisting} onPin={togglePin} onDelete={setDeleting} />
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section>
              {pinned.length > 0 ? (
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
                  Everything else
                </h2>
              ) : null}
              <NoteGrid notes={rest} onOpen={openExisting} onPin={togglePin} onDelete={setDeleting} />
            </section>
          ) : null}
        </div>
      )}

      {/* New note ------------------------------------------------------- */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New note"
        description="Only you can see this."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={create} loading={busy}>
              Save note
            </Button>
          </>
        }
      >
        <NoteFields draft={draft} setDraft={setDraft} />
      </Modal>

      {/* Edit note ------------------------------------------------------ */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit note"
        description={savedAt ? `Autosaved ${relativeTime(savedAt)}` : "Changes save automatically as you type."}
        footer={
          <>
            <Button
              variant="ghost"
              icon="trash"
              onClick={() => editing && setDeleting(editing)}
              className="mr-auto"
              style={{ color: "var(--color-brand-red)" }}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Done
            </Button>
          </>
        }
      >
        <NoteFields draft={draft} setDraft={setDraft} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        destructive
        title="Delete this note?"
        message="This cannot be undone. The note is only stored here."
        confirmLabel="Delete note"
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function NoteGrid({
  notes,
  onOpen,
  onPin,
  onDelete,
}: {
  notes: NoteRow[];
  onOpen: (note: NoteRow) => void;
  onPin: (note: NoteRow) => void;
  onDelete: (note: NoteRow) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <li
          key={note.id}
          data-accent={note.color}
          className="group surface-flat relative flex min-h-[150px] flex-col overflow-hidden p-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "var(--tone)" }} />

          <button onClick={() => onOpen(note)} className="flex-1 text-left">
            <h3 className="pr-14 text-[14px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
              {note.title}
            </h3>
            <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {note.body || "No content yet."}
            </p>
          </button>

          <p className="mt-3 text-[10.5px]" style={{ color: "var(--text-faint)" }}>
            Edited {relativeTime(note.updatedAt)}
          </p>

          <span className="absolute right-2.5 top-2.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <IconButton
              size="sm"
              icon="pin"
              label={note.pinned ? "Unpin note" : "Pin note"}
              onClick={() => onPin(note)}
              style={{ color: note.pinned ? "var(--tone)" : "var(--text-faint)" }}
            />
            <IconButton
              size="sm"
              icon="trash"
              label="Delete note"
              onClick={() => onDelete(note)}
              style={{ color: "var(--text-faint)" }}
            />
          </span>

          {note.pinned ? (
            <Icon
              name="pin"
              className="absolute right-3 top-3 h-3.5 w-3.5 group-hover:opacity-0"
              style={{ color: "var(--tone)" }}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function NoteFields({
  draft,
  setDraft,
}: {
  draft: { title: string; body: string; color: NoteColor };
  setDraft: (next: { title: string; body: string; color: NoteColor }) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Title" htmlFor="note-title">
        <Input
          id="note-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Sprint checklist"
          maxLength={120}
        />
      </Field>

      <Field label="Note" htmlFor="note-body" hint={`${draft.body.length}/8000`}>
        <Textarea
          id="note-body"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value.slice(0, 8000) })}
          placeholder="Anything you want to remember…"
          rows={10}
          className="min-h-[220px]"
        />
      </Field>

      <div>
        <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-default)" }}>
          Colour
        </p>
        <div className="flex gap-2">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              data-accent={color}
              onClick={() => setDraft({ ...draft, color })}
              aria-label={`${color} note`}
              aria-pressed={draft.color === color}
              className={cn("h-8 w-8 rounded-full transition-transform", draft.color === color && "scale-110")}
              style={{
                background: "var(--tone)",
                boxShadow: draft.color === color ? "0 0 0 2px var(--surface-raised), 0 0 0 4px var(--tone)" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
