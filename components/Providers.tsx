'use client'
// src/components/Providers.tsx
// Wrapper com React Query + Auth — envolve o layout raiz

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools }  from '@tanstack/react-query-devtools'
import { AppAuthProvider }     from '@/contexts/AuthContext'
import { getQueryClient }      from '@/lib/query-client'
import { Toaster }             from 'sonner'   // npm install sonner

export function AppProviders({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient()

  return (
    <QueryClientProvider client={qc}>
      <AppAuthProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--s2)',
              border:     '0.5px solid var(--bs)',
              color:      'var(--tp)',
              fontSize:   '12px',
            },
          }}
        />
      </AppAuthProvider>
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

export function AdminProviders({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient()

  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster position="bottom-right" />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
