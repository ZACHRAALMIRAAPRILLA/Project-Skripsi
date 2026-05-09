# Perbaiki: Website tidak tampil + Hilangkan Prettier dari ESLint

## Masalah yang ditemukan

1. **Website blank** — `index.html` me-load `/src/routes/index.tsx` langsung sebagai script, padahal file itu cuma definisi route TanStack Router, bukan entry React. Tidak ada `main.tsx` yang melakukan `createRoot(...).render(<RouterProvider/>)`. Jadi React tidak pernah ter-mount.
2. **Vite config kehilangan plugin penting** — `vite.config.ts` saat ini hanya berisi `react()`. Project ini pakai **Tailwind v4** (`@import "tailwindcss"` di `src/styles.css`) yang butuh `@tailwindcss/vite`, dan TanStack Router juga butuh plugin route-tree generator. Tanpa itu styling & routing tidak jalan walaupun React di-mount.
3. **Semua kode merah** — `eslint.config.js` mengaktifkan `eslint-plugin-prettier` (`eslint-plugin-prettier/recommended`). Setiap perbedaan format (bahkan CRLF vs LF) jadi error ESLint seperti pesan `Replace ␍⏎··· prettier/prettier` yang Anda lihat.

## Rencana perbaikan

### 1. Hilangkan Prettier dari ESLint (sesuai permintaan: "jangan pakai prettier")
- Edit `eslint.config.js`: hapus `import eslintPluginPrettier from "eslint-plugin-prettier/recommended"` dan hapus dari array `tseslint.config(...)`.
- Hapus `.prettierrc` dan `.prettierignore` agar tidak ada konfigurasi yang menyesatkan.
- Hapus dependency `prettier`, `eslint-plugin-prettier`, `eslint-config-prettier` dari `package.json`.

Hasil: tidak ada lagi error/warning `prettier/prettier` di seluruh file.

### 2. Buat entry React standar (`src/main.tsx`) supaya website tampil
Buat file baru `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
```

Update `index.html`:
- Ganti `<script src="/src/routes/index.tsx">` menjadi `<script src="/src/main.tsx">`.
- Tambah `<title>` & meta description sesuai project (klasifikasi foto).

### 3. Sederhanakan `__root.tsx` agar cocok dengan SPA biasa
`__root.tsx` saat ini pakai `shellComponent` + `<html>/<body>` ala TanStack Start (SSR). Untuk Vite SPA biasa, `shellComponent`-nya tidak dipakai dan `Scripts/HeadContent` tidak diperlukan. Sederhanakan jadi `component: RootComponent` saja, hapus `shellComponent`, hapus import `HeadContent`/`Scripts`, dan pindahkan judul/meta ke `index.html`.

### 4. Perbaiki `vite.config.ts` (React + Vite biasa, tetap pakai TanStack Router)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts" }),
    react(),
    tailwindcss(),
  ],
  server: { port: 8080 },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Plugin router otomatis regen `routeTree.gen.ts`, plugin tailwind menjalankan Tailwind v4.

### 5. Bersihkan dependency yang tidak dipakai
Hapus dari `package.json`:
- `@tanstack/react-start` (SSR framework, tidak dipakai di SPA)
- `@cloudflare/vite-plugin` (deploy adapter, tidak dipakai)
- `vite-tsconfig-paths` (sudah pakai `resolve.alias`)
- `wrangler.jsonc` (file Cloudflare, hapus)

### 6. Verifikasi
- Jalankan dev server, cek log Vite bersih.
- Buka preview, pastikan halaman utama (Dropzone) tampil.
- Cek tidak ada lagi squiggle merah `prettier/prettier` di editor.

## Hal yang TIDAK saya ubah
- Logika klasifikasi foto, komponen UI, file di `src/components/classifier/*`, `src/lib/*`.
- Routing/route tree (selain regenerasi otomatis oleh plugin).
- Tema warna & desain.
