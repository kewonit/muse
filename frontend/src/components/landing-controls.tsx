"use client";

import { Popover } from "@base-ui/react/popover";
import { SlidersHorizontal } from "lucide-react";
import { AppButton } from "./ui/button";

interface EntryButtonProps {
  label: string;
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
}

interface SettingsPopoverProps {
  duration: number;
  rounds: number;
  choiceCount: number;
  durations: readonly number[];
  roundOptions: readonly number[];
  choiceOptions: readonly number[];
  disabled: boolean;
  onDurationChange: (value: number) => void;
  onRoundsChange: (value: number) => void;
  onChoiceCountChange: (value: number) => void;
}

export function EntryButton({
  label,
  primary = false,
  disabled,
  onClick,
}: EntryButtonProps) {
  return (
    <AppButton
      onClick={onClick}
      disabled={disabled}
      variant={primary ? "primary" : "secondary"}
      size="lg"
      className="h-16"
    >
      {label}
    </AppButton>
  );
}

export function SettingsPopover({
  duration,
  rounds,
  choiceCount,
  durations,
  roundOptions,
  choiceOptions,
  disabled,
  onDurationChange,
  onRoundsChange,
  onChoiceCountChange,
}: SettingsPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Game settings"
        disabled={disabled}
        className="absolute right-5 top-5 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-xs font-semibold text-muted transition-[background-color,border-color,color,opacity,transform] hover:border-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-45 data-[pressed]:scale-[0.97]"
      >
        <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
        Settings
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="z-40"
        >
          <Popover.Popup className="w-[min(calc(100vw-2rem),23rem)] origin-[var(--transform-origin)] rounded-[1.5rem] border border-border bg-surface/95 p-3 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[opacity,transform] duration-150 data-[closed]:scale-[0.98] data-[closed]:opacity-0">
            <div className="flex items-center justify-between px-2 pb-3 pt-1">
              <Popover.Title className="text-sm font-black">Game settings</Popover.Title>
              <p className="text-xs font-semibold text-muted">
                {duration}s / {rounds} rounds
              </p>
            </div>

            <div className="space-y-2">
              <SegmentedControl
                label="Audio"
                options={durations}
                value={duration}
                suffix="s"
                disabled={disabled}
                onChange={onDurationChange}
              />
              <SegmentedControl
                label="Rounds"
                options={roundOptions}
                value={rounds}
                disabled={disabled}
                onChange={onRoundsChange}
              />
              <SegmentedControl
                label="Choices"
                options={choiceOptions}
                value={choiceCount}
                disabled={disabled}
                onChange={onChoiceCountChange}
              />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SegmentedControl({
  label,
  options,
  value,
  suffix = "",
  disabled,
  onChange,
}: {
  label: string;
  options: readonly number[];
  value: number;
  suffix?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 rounded-[1.25rem] border border-border bg-background/85 p-2">
      <span className="px-2 text-sm font-semibold text-muted">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => (
          <AppButton
            key={option}
            onClick={() => onChange(option)}
            disabled={disabled}
            size="sm"
            variant={value === option ? "primary" : "ghost"}
            className={`h-9 px-2 py-1 text-sm ${
              value === option ? "bg-foreground text-background" : "text-muted hover:text-foreground"
            } disabled:opacity-50`}
          >
            {option}{suffix}
          </AppButton>
        ))}
      </div>
    </div>
  );
}
