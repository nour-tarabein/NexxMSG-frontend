// src/animations/menuFlip.js
import { spring } from "framer-motion";

export const itemVariants = {
  initial: { rotateX: 0, opacity: 1 },
  selected: { rotateX: -90, opacity: 0 },
};

export const backVariants = {
  initial: { rotateX: 90, opacity: 0 },
  selected: { rotateX: 0, opacity: 1 },
};

export const glowVariants = {
  initial: { opacity: 0, scale: 0.8 },
  selected: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      scale: { type: "spring", stiffness: 300, damping: 25 },
    },
  },
};

export const sharedTransition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
  duration: 0.5,
};

// exact orange radial used in your MenuBar bell
export const orangeGradient =
  "radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 100%)";
