import './globals.css'

export const metadata = {
  title: 'ABL Internet Banking',
  description: 'Secure Internet Banking Portal for ABL Customers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
