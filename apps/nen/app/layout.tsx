import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import './globals.css'
export const metadata: Metadata = {
  title: 'Nzila Economic Network | Black business. Built to last.',
  description: 'Discover Black enterprises, win work together, and build lasting ownership across Africa and the diaspora.',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>
}
