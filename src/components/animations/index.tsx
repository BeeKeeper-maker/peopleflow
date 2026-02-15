"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

// Fade in animation
interface FadeInProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    delay?: number;
    duration?: number;
}

export function FadeIn({
    children,
    delay = 0,
    duration = 0.4,
    ...props
}: FadeInProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration, ease: "easeOut" }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Slide in from left
export function SlideInLeft({
    children,
    delay = 0,
    duration = 0.4,
    ...props
}: FadeInProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration, ease: "easeOut" }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Slide in from right
export function SlideInRight({
    children,
    delay = 0,
    duration = 0.4,
    ...props
}: FadeInProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration, ease: "easeOut" }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Scale up animation
export function ScaleIn({
    children,
    delay = 0,
    duration = 0.3,
    ...props
}: FadeInProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration, ease: "easeOut" }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Stagger children animation
interface StaggerContainerProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    staggerDelay?: number;
}

export function StaggerContainer({
    children,
    staggerDelay = 0.1,
    ...props
}: StaggerContainerProps) {
    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={{
                hidden: {},
                show: {
                    transition: {
                        staggerChildren: staggerDelay,
                    },
                },
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Stagger item
export function StaggerItem({
    children,
    ...props
}: Omit<FadeInProps, "delay">) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 },
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Page transition wrapper
export function PageTransition({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
        >
            {children}
        </motion.div>
    );
}

// Animated card with hover effect
interface AnimatedCardProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
}

export function AnimatedCard({ children, className, ...props }: AnimatedCardProps) {
    return (
        <motion.div
            whileHover={{
                y: -4,
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Pulse animation for notifications/badges
export function Pulse({ children }: { children: ReactNode }) {
    return (
        <motion.div
            animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "loop",
            }}
        >
            {children}
        </motion.div>
    );
}

// Shimmer loading effect
export function Shimmer({ className }: { className?: string }) {
    return (
        <motion.div
            className={`bg-linear-to-r from-white/5 via-white/10 to-white/5 ${className}`}
            animate={{
                backgroundPosition: ["200% 0", "-200% 0"],
            }}
            transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "loop",
            }}
            style={{ backgroundSize: "200% 100%" }}
        />
    );
}

// Number counter animation
interface CountUpProps {
    from?: number;
    to: number;
    duration?: number;
    className?: string;
}

export function CountUp({ from = 0, to, duration = 1, className }: CountUpProps) {
    return (
        <motion.span
            className={className}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <motion.span
                initial={{}}
                animate={{}}
                transition={{ duration }}
            >
                {to}
            </motion.span>
        </motion.span>
    );
}

// Floating animation
export function Float({ children }: { children: ReactNode }) {
    return (
        <motion.div
            animate={{
                y: [0, -10, 0],
            }}
            transition={{
                duration: 3,
                repeat: Infinity,
                repeatType: "loop",
                ease: "easeInOut",
            }}
        >
            {children}
        </motion.div>
    );
}
