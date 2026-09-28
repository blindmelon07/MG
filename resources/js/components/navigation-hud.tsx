import {
    ArrowUp,
    ArrowUpLeft,
    ArrowUpRight,
    CornerUpLeft,
    CornerUpRight,
    Flag,
    Undo2,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spokenDistance } from '@/lib/campus-route';
import type { Instruction } from '@/lib/campus-route';

function ManeuverIcon({ instruction }: { instruction: Instruction }) {
    const className = 'size-9 shrink-0';
    const turn = instruction.maneuver?.turn ?? 0;
    const amount = Math.abs(turn);
    const left = turn < 0;

    if (!instruction.maneuver) {
        return <ArrowUp className={className} />;
    }

    if (amount < 55) {
        return left ? (
            <ArrowUpLeft className={className} />
        ) : (
            <ArrowUpRight className={className} />
        );
    }

    if (amount < 135) {
        return left ? (
            <CornerUpLeft className={className} />
        ) : (
            <CornerUpRight className={className} />
        );
    }

    return (
        <Undo2
            className={className}
            style={left ? undefined : { transform: 'scaleX(-1)' }}
        />
    );
}

/** Waze-style overlay: next instruction on top, trip summary below. */
export function NavigationHud({
    destination,
    instruction,
    remaining,
    minutes,
    arrived,
    muted,
    canSpeak,
    onToggleMute,
    onEnd,
}: {
    destination: string;
    instruction: Instruction | null;
    remaining: number;
    minutes: number;
    arrived: boolean;
    muted: boolean;
    canSpeak: boolean;
    onToggleMute: () => void;
    onEnd: () => void;
}) {
    return (
        <>
            <div
                role="status"
                aria-live="polite"
                className="absolute inset-x-2 top-2 flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg"
            >
                {arrived || !instruction ? (
                    <>
                        <Flag className="size-9 shrink-0" />
                        <div className="text-lg leading-tight font-semibold">
                            You&apos;ve arrived at {destination}
                        </div>
                    </>
                ) : (
                    <>
                        <ManeuverIcon instruction={instruction} />
                        <div className="min-w-0">
                            {instruction.maneuver && (
                                <div className="text-2xl leading-none font-bold tabular-nums">
                                    {spokenDistance(instruction.distance)}
                                </div>
                            )}
                            <div className="text-base leading-tight font-medium">
                                {instruction.text}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                        {destination}
                    </div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                        {arrived
                            ? 'Arrived'
                            : `${spokenDistance(remaining)} · ${minutes} min walk`}
                    </div>
                </div>
                {canSpeak && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onToggleMute}
                        aria-pressed={muted}
                    >
                        {muted ? <VolumeX /> : <Volume2 />}
                        <span className="sr-only">
                            {muted ? 'Turn voice on' : 'Mute voice'}
                        </span>
                    </Button>
                )}
                <Button
                    variant={arrived ? 'default' : 'destructive'}
                    onClick={onEnd}
                >
                    {arrived ? (
                        'Done'
                    ) : (
                        <>
                            <X /> End
                        </>
                    )}
                </Button>
            </div>
        </>
    );
}
