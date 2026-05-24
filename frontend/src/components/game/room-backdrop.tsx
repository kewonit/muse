"use client";

interface RoomBackdropProps {
  albumArt?: string;
  urgent: boolean;
}

export function RoomBackdrop({ albumArt, urgent }: RoomBackdropProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(116,168,245,0.16),transparent_32rem),linear-gradient(180deg,transparent,rgba(0,0,0,0.08))] dark:bg-[radial-gradient(circle_at_50%_36%,rgba(124,165,231,0.13),transparent_34rem),linear-gradient(180deg,rgba(5,6,7,0.08),rgba(5,6,7,0.88))]" />
      {albumArt && (
        <div
          className="absolute left-1/2 top-[36%] h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cover bg-center opacity-[0.08] blur-[7rem]"
          style={{ backgroundImage: `url(${albumArt})` }}
        />
      )}
      <div
        className={
          urgent
            ? "absolute left-1/2 top-[34%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger/[0.10] blur-[6rem]"
            : "absolute left-1/2 top-[34%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.08] blur-[6rem]"
        }
      />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background via-background/85 to-transparent" />
    </div>
  );
}
