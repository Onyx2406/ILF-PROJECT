import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Demo Sender - Rafiki Payment Demo',
  description: 'Demo interface for sending Rafiki payments to ABL',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
