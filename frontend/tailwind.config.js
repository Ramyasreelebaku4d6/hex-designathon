/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0062CC",
        "primary-dark": "#0052AA",
        "primary-50": "#EBF3FF",
        "primary-100": "#C8DFFE",
        secondary: "#00A896",
        "secondary-50": "#E0F5F3",
        "secondary-dark": "#008A7C",
        navy: "#071729",
        "navy-700": "#0C2444",
        "navy-600": "#112E5C",
        "navy-500": "#163A70",
        lightBg: "#F2F5FC",
        "border-light": "#DDE5F4",
        "text-primary": "#0B1837",
        "text-secondary": "#4A5E7D",
        "text-muted": "#8FA3BF",
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(7,23,41,0.05), 0 1px 2px rgba(7,23,41,0.04)",
        "card-hover": "0 6px 24px rgba(7,23,41,0.10), 0 2px 6px rgba(7,23,41,0.05)",
        glow: "0 0 0 3px rgba(0,98,204,0.18)",
        "glow-md": "0 4px 20px rgba(0,98,204,0.28)",
        "glow-teal": "0 4px 20px rgba(0,168,150,0.28)",
        sidebar: "4px 0 32px rgba(7,23,41,0.28)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0062CC 0%, #00A896 100%)",
        "navy-gradient": "linear-gradient(160deg, #071729 0%, #0C2444 60%, #0F3060 100%)",
        "primary-gradient": "linear-gradient(135deg, #0062CC 0%, #0074E8 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out both",
        "float": "float 7s ease-in-out infinite",
        "pulse-dot": "pulseDot 2.2s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(5px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.8)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400% 0" },
          "100%": { backgroundPosition: "400% 0" },
        },
      },
    },
  },
  plugins: [],
};
