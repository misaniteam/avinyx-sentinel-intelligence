import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontFamily: {
      sans: [
        "var(--font-inter)",
        "var(--font-noto-bengali)",
        "system-ui",
        "sans-serif",
      ],
    },
    extend: {
      /* ==============================
         COLORS (CSS VARIABLES BASED)
      ============================== */
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        background: "var(--background)",
        foreground: "var(--foreground)",

        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },

        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },

        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },

        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },

        destructive: "var(--destructive)",

        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },

        card2: {
          DEFAULT: "var(--card2)",
          foreground: "var(--card2-foreground)",
        },

        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },

        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          accent: "var(--sidebar-accent)",
        },

        /* custom theme */
        "theme-primary": "var(--theme-primary)",
        "theme-primary-light-1": "var(--theme-primary-light-1)",
        "theme-primary-light-2": "var(--theme-primary-light-2)",
        "theme-primary-dark-1": "var(--theme-primary-dark-1)",
        "theme-primary-dark-2": "var(--theme-primary-dark-2)",
        "body-bg": "var(--body-bg)",
      },

      /* ==============================
         Z-INDEX SYSTEM
      ============================== */
      zIndex: {
        base: "var(--z-base)",
        low: "var(--z-low)",
        normal: "var(--z-normal)",
        high: "var(--z-high)",
        overlay: "var(--z-overlay)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        sidebar: "var(--z-sidebar)",
        header: "var(--z-header)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        toast: "var(--z-toast)",
        tooltip: "var(--z-tooltip)",
        top: "var(--z-top)",
      },

      /* ==============================
         BORDER RADIUS
      ============================== */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      /* ==============================
         SHADOW (optional)
      ============================== */
      boxShadow: {
        theme: "0 0 20px var(--theme-blur)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
