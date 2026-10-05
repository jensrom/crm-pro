import tailwindcssAnimate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        // Signalfarver: dæmpede toner, der kun bruges til status og advarsler.
        success: { DEFAULT: "#3f8a68", foreground: "#f9f9fa", light: "#e1ece6" }, // salviegrøn
        warning: { DEFAULT: "#b07a2a", foreground: "#f9f9fa", light: "#f1e8d9" }, // okker
        danger:  { DEFAULT: "#b1434f", foreground: "#f9f9fa", light: "#f2e1e3" }, // dæmpet rød
        info:    { DEFAULT: "#4a7393", foreground: "#f9f9fa", light: "#e2e9ef" }, // stålblå
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        // "serif" er display-skriften til mærket og de store nøgletal: Inter Tight.
        // Navnet beholdes, så eksisterende font-serif-klasser følger med.
        serif: ['"Inter Tight"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { "fade-in": "fade-in 0.2s ease-out" },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
