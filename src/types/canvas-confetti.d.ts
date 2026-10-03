declare module "canvas-confetti" {
  type ConfettiOptions = {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    disableForReducedMotion?: boolean;
    scalar?: number;
  };

  export default function confetti(options?: ConfettiOptions): Promise<null> | null;
}
