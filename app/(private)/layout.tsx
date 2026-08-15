import { Genos } from 'next/font/google'
import type { Metadata } from 'next'
import '../globals.css'
import AuthProviders from '@/app/providers/AuthProvider'
import NavBar from '@/components/NavBar'

const genos = Genos({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PartySuite',
  description: 'powered by yGa',
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (<AuthProviders>
          <NavBar />
          {children}
        </AuthProviders>)
}
