import type { Metadata, Viewport } from 'next'
import '../globals.css'
import AuthProviders from '@/app/providers/AuthProvider'
import NavBar from '@/components/NavBar'
import UpdatePasswordModal from '@/components/prefabs/UpdatePasswordModal'

export const metadata: Metadata = {
  title: 'PartySuite',
  description: 'powered by yGa',
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#380E6B',
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (<AuthProviders>
          <UpdatePasswordModal />
          <NavBar />
          {children}
        </AuthProviders>)
}
