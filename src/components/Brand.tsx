import wordmark from '../assets/brand/wordmark.svg?raw'

/** Marca "Carga": barra, três anilhas crescendo e a trava. Cor = `currentColor` (use `text-accent`). */
export function BrandMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden>
      <rect x="6" y="46.5" width="88" height="7" rx="3.5" />
      <rect x="20" y="30" width="13" height="40" rx="4" />
      <rect x="37" y="22" width="13" height="56" rx="4" />
      <rect x="54" y="14" width="13" height="72" rx="4" />
      <rect x="71" y="41" width="6" height="18" rx="2" />
    </svg>
  )
}

/** Assinatura horizontal: marca em latão + "progressa" na cor do texto. Altura pelo `className` (ex.: h-7). */
export function BrandLockup({ className = 'h-7' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] ${className}`} role="img" aria-label="Progressa">
      <BrandMark className="h-full w-auto text-accent" />
      <span className="h-[52%] [&>svg]:h-full [&>svg]:w-auto" dangerouslySetInnerHTML={{ __html: wordmark }} />
    </span>
  )
}
