import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-zinc-800 text-zinc-300",
        active: "bg-[#B1CA1E]/20 text-[#B1CA1E] border border-[#B1CA1E]/30",
        success: "bg-emerald-900/50 text-emerald-400 border border-emerald-700/30",
        error: "bg-red-900/50 text-red-400 border border-red-700/30",
        warning: "bg-amber-900/50 text-amber-400 border border-amber-700/30",
        info: "bg-sky-900/50 text-sky-400 border border-sky-700/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
