'use client'
import { AdminAuthProvider } from '@/contexts/AuthContext'
import { AdminProviders }    from '@/components/Providers'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviders>
      <AdminAuthProvider>
        {children}
      </AdminAuthProvider>
    </AdminProviders>
  )
}
