'use client'
import { Suspense } from 'react'
import { AppProviders } from '@/components/Providers'
import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <div className="shell">
        {/* Truque de checkbox — abre/fecha a gaveta do menu no celular sem
            precisar de estado em React (ver styles/globals.css). */}
        <input type="checkbox" id="sb-toggle" className="sb-toggle-input" />
        <label htmlFor="sb-toggle" className="sb-overlay" aria-hidden="true" />
        <Suspense fallback={<div className="sb" />}>
          <Sidebar />
        </Suspense>
        <div className="main">{children}</div>
      </div>
    </AppProviders>
  )
}
