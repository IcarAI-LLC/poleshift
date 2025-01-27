"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

export interface ITypewriterProps {
    delay: number;
    texts: string[];
    baseText?: string;
    /** The new callback: called once *all* type animations are complete. */
    onComplete?: () => void;
}

export function Typewriter({ delay, texts, baseText = "", onComplete }: ITypewriterProps) {
    const [baseTextAnimationDone, setBaseTextAnimationDone] = useState(false);
    const [allAnimationsComplete, setAllAnimationsComplete] = useState(false);

    // -- Animate the baseText
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const displayText = useTransform(rounded, (latest) => baseText.slice(0, latest));

    useEffect(() => {
        const controls = animate(count, baseText.length, {
            type: "tween",
            delay,
            duration: 1,
            ease: "easeInOut",
            onComplete: () => setBaseTextAnimationDone(true),
        });
        return () => controls.stop?.();
    }, [count, baseText.length, delay]);

    // Whenever *all* animations complete, inform the parent via onComplete
    useEffect(() => {
        if (allAnimationsComplete) {
            onComplete?.();
        }
    }, [allAnimationsComplete, onComplete]);

    return (
        <span className="font-mono text-3xl text-center bg-transparent inline-block">
      <motion.span>{displayText}</motion.span>

            {/* Only start the repeated text animation once baseText is done */}
            {baseTextAnimationDone && (
                <RepeatedTextAnimation
                    texts={texts}
                    delay={delay + 1}
                    onComplete={() => setAllAnimationsComplete(true)}
                />
            )}

            {/* Blinking cursor if NOT finished. Otherwise show a period. */}
            {allAnimationsComplete ? (
                <span className="inline-block">.</span>
            ) : (
                <BlinkingCursor />
            )}
    </span>
    );
}

// --------------------------------------------------

export interface IRepeatedTextAnimationProps {
    delay: number;
    texts: string[];
    /** Called once the entire repeated text expand/collapse cycle completes. */
    onComplete?: () => void;
}

function RepeatedTextAnimation({ delay, texts, onComplete }: IRepeatedTextAnimationProps) {
    const textIndex = useMotionValue(0);
    const count = useMotionValue(0);
    const baseText = useTransform(textIndex, (latest) => texts[latest] || "");
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const displayText = useTransform(rounded, (latest) => baseText.get().slice(0, latest));

    const updatedThisRound = useMotionValue(true);

    useEffect(() => {
        const animation = animate(count, 60, {
            type: "tween",
            delay,
            duration: 1,
            ease: "easeIn",
            // Repeat 6 times for forward+reverse expansions
            repeat: 6,
            repeatType: "reverse",
            repeatDelay: 1,
            onUpdate(latest) {
                // Once we've reversed back to 0, move to the next text
                if (updatedThisRound.get() && latest > 0) {
                    updatedThisRound.set(false);
                } else if (!updatedThisRound.get() && latest === 0) {
                    textIndex.set((textIndex.get() + 1) % texts.length);
                    updatedThisRound.set(true);
                }
            },
            onComplete: () => {
                onComplete?.(); // Fire after the entire cycle finishes
            },
        });

        return () => animation.stop?.();
    }, [count, delay, texts, textIndex, updatedThisRound, onComplete]);

    return <motion.span className="inline">{displayText}</motion.span>;
}

// --------------------------------------------------

const cursorVariants = {
    blinking: {
        opacity: [0, 0, 1, 1],
        transition: {
            duration: 1,
            repeat: Infinity,
            repeatDelay: 0,
            ease: "linear",
            times: [0, 0.5, 0.5, 1],
        },
    },
};

function BlinkingCursor() {
    return (
        <motion.span
            variants={cursorVariants}
            animate="blinking"
            className="align-middle ml-0.5 inline-block h-8 w-[2px] bg-current"
        />
    );
}
