import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JoePAI - Your AI Companion',
  description: 'AI chat and image generation powered by Zhipu AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  )
}
