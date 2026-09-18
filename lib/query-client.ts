// src/lib/query-client.ts
// Configuração global do React Query

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Não faz retry em erros 4xx — são erros do usuário, não de rede
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false
          return failureCount < 2
        },
        // Revalida ao focar a janela (ex: usuário volta de outra aba)
        refetchOnWindowFocus: true,
        // Não refaz requisição se os dados têm menos de 30s
        staleTime: 30_000,
      },
      mutations: {
        // Mutações não fazem retry por padrão
        retry: false,
      },
    },
  })
}

// Singleton no cliente
let clientQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: sempre cria novo
    return makeQueryClient()
  }
  // Client: reutiliza o mesmo
  if (!clientQueryClient) clientQueryClient = makeQueryClient()
  return clientQueryClient
}
