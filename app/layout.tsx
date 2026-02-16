import './globals.css'
import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import AppHeader from '@/components/layout/AppHeader'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Sewaro',
  description: 'Sewaro by Nanchu Hospitality',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <div className="min-h-screen">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  )
}
