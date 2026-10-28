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
        // Signalfarver som rgb-tripler i globals.css, så de skifter med temaet.
        success: { DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)", foreground: "#ffffff" },
        warning: { DEFAULT: "rgb(var(--warning-rgb) / <alpha-value>)", foreground: "#ffffff" },
        danger:  { DEFAULT: "rgb(var(--danger-rgb) / <alpha-value>)", foreground: "#ffffff" },
        info:    { DEFAULT: "rgb(var(--info-rgb) / <alpha-value>)", foreground: "#ffffff" },
        hot: "#b84e14",
      },
      // "Blank is": flader (kort, paneler) får --radius-flade (8 px),
      // knapper, felter, tags og rækker --radius (4 px).
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius-flade)",
        "2xl": "var(--radius-flade)",
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
