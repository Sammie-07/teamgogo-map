import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base — same build works on Vercel root AND GitHub Pages subpath
  base: "./",
});
