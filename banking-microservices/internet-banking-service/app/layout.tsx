import './globals.css'

export const metadata = {
  title: 'ABL Internet Banking - Allied Bank Limited',
  description: 'Secure Digital Banking Portal for Allied Bank Limited Customers - Access your accounts, transfer funds, and manage payments online.',
  keywords: 'Allied Bank, ABL, Internet Banking, Digital Banking, Pakistan, Online Banking',
  author: 'Allied Bank Limited',
  robots: 'index, follow',
  viewport: 'width=device-width, initial-scale=1.0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F97316" />
        <meta name="msapplication-TileColor" content="#F97316" />
        <link rel="icon" href="/A.png" type="image/png" />
        <link rel="apple-touch-icon" href="/A.png" />
      </head>
      <body className="bg-gradient-to-br from-orange-50 via-white to-blue-50 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
