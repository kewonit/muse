"use client";

import { FormEvent, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Field } from "@base-ui/react/field";
import { AppButton } from "@/components/ui/button";
import { sanitizeDisplayName, validateDisplayName } from "@/lib/display-name";

interface UsernameDialogProps {
  name?: string;
  disabled?: boolean;
  open?: boolean;
  required?: boolean;
  showTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
}

export function UsernameDialog({
  name,
  disabled,
  open,
  required = false,
  showTrigger = true,
  onOpenChange,
  onSave,
}: UsernameDialogProps) {
  const isControlled = open !== undefined;
  const allowCloseRef = useRef(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [draftName, setDraftName] = useState(name || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogOpen = isControlled ? open : localOpen;

  const setDialogOpen = (nextOpen: boolean) => {
    if (required && !nextOpen && !allowCloseRef.current) {
      return;
    }

    allowCloseRef.current = false;
    if (!isControlled) {
      setLocalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);

    if (nextOpen) {
      setDraftName(name || "");
      setError(null);
    }
  };

  const submitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitizedName = sanitizeDisplayName(draftName);
    const validationError = validateDisplayName(sanitizedName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(sanitizedName);
      allowCloseRef.current = true;
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root
      open={dialogOpen}
      onOpenChange={setDialogOpen}
    >
      {showTrigger && (
        <Dialog.Trigger
          disabled={disabled}
          className="absolute left-5 top-5 h-10 rounded-full border border-border px-4 text-xs font-semibold text-muted transition-colors hover:border-foreground hover:text-foreground disabled:opacity-45"
        >
          {name || "Pick name"}
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <Dialog.Popup className="w-full max-w-md rounded-[1.75rem] bg-surface p-6 shadow-[0_24px_90px_rgba(0,0,0,0.65)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-4xl font-black leading-none sm:text-5xl">Your name</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted">
                  Shown on the scoreboard.
                </Dialog.Description>
              </div>
              {!required && (
                <Dialog.Close className="h-9 w-9 rounded-full border border-border text-sm text-muted hover:border-foreground hover:text-foreground">
                  x
                </Dialog.Close>
              )}
            </div>

            <form className="mt-5 space-y-4" onSubmit={submitName}>
              <Field.Root name="displayName">
                <Field.Label className="sr-only">Display name</Field.Label>
                <Field.Control
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(sanitizeDisplayName(event.target.value));
                    setError(null);
                  }}
                  placeholder="Display name"
                  maxLength={24}
                  autoFocus
                  className="h-16 w-full rounded-full border-2 border-foreground bg-transparent px-6 text-xl font-semibold text-foreground placeholder:text-muted focus:border-foreground"
                />
                {error && <Field.Error className="mt-2 block text-sm text-danger">{error}</Field.Error>}
              </Field.Root>

              <AppButton type="submit" disabled={saving} size="lg" className="w-full">
                {saving ? "Saving..." : "Save"}
              </AppButton>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
