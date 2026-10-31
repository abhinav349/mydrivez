import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1.25rem", lg: "2rem" }, screens: { "2xl": "1320px" } },
    extend: {
      colors: {
        ink: { DEFAULT: "#101820", 900: "#0B1117", 800: "#101820", 700: "#1A232C", 600: "#252B33", 500: "#3A424D" },
        charcoal: "#252B33",
        lime: { DEFAULT: "#C6F36B", 50: "#F6FDE6", 100: "#ECFBCB", 200: "#DDF8A2", 300: "#C6F36B", 400: "#B2E64A", 500: "#93C72E", 600: "#6F9A1E" },
        paper: "#F7F8FA",
        graphite: "#20242A",
        muted: "#6B7280",
        line: "#E7E9EE",
        success: { DEFAULT: "#16A34A", soft: "#E8F7EE" },
        warning: { DEFAULT: "#D97706", soft: "#FDF3E3" },
        danger: { DEFAULT: "#DC2626", soft: "#FDECEC" },
        info: { DEFAULT: "#2563EB", soft: "#EAF1FE" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "14px", "2xl": "18px", "3xl": "24px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,32,.04), 0 4px 16px -4px rgba(16,24,32,.06)",
        lift: "0 2px 4px rgba(16,24,32,.04), 0 18px 40px -12px rgba(16,24,32,.18)",
        glow: "0 0 0 1px rgba(198,243,107,.35), 0 8px 30px -6px rgba(198,243,107,.45)",
      },
      letterSpacing: { tightest: "-0.045em" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up .6s cubic-bezier(.2,.7,.2,1) both",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
