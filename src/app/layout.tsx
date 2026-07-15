import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kite | Atividades pedagógicas",
  description: "POC para geração e revisão rastreável de atividades do projeto Fonemas.",
  icons: {
    icon: "/brand/kite-symbol.svg",
  },
};

// Mantém as Server Actions de geração alinhadas ao timeout de 5 minutos da IA.
export const maxDuration = 300;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
