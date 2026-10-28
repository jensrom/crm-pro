"use client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      // Glossy blå og hvidt glas — se .knap-glossy og .knap-glas i globals.css
      primary: "knap-glossy",
      secondary: "knap-glas",
      ghost: "hover:bg-[color:var(--hover)] text-foreground",
      danger: "maerke-glans bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_6px_16px_-6px_rgba(168,34,52,.55)]",
      outline: "knap-glas",
    };
    const sizes = { sm: "text-xs px-3 py-1.5 h-8", md: "text-sm px-4 py-2 h-10 sm:h-9", lg: "text-sm px-5 py-2.5 h-10" };
    return (
      <button ref={ref} disabled={disabled || loading} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
