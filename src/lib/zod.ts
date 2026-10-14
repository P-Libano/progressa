import { z } from 'zod'

// Mensagens de validação em pt-BR em todo o app (backup e IA).
z.config(z.locales.ptBR())

export { z }
