import { NavLink, Navigate, Route, Routes } from 'react-router'
import { Button, Icon, Screen } from './components/ui'
import { useCatalogBootstrap } from './lib/useCatalog'
import Catalog from './pages/Catalog'
import ExerciseDetail from './pages/ExerciseDetail'
import Onboarding from './pages/Onboarding'
import RoutinePage from './pages/RoutinePage'
import SessionPage from './pages/SessionPage'

const TABS = [
  { to: '/treino', label: 'Treino', icon: 'dumbbell' },
  { to: '/exercicios', label: 'Exercícios', icon: 'list' },
  { to: '/historico', label: 'Histórico', icon: 'chart' },
  { to: '/config', label: 'Ajustes', icon: 'gear' },
]

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              <Icon name={t.icon} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Soon({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <p className="text-muted">Em construção.</p>
    </Screen>
  )
}

export default function App() {
  const { status, retry } = useCatalogBootstrap()

  if (status.state !== 'ready') {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            progress<span className="text-accent">a</span>
          </p>
          {status.state === 'loading' ? (
            <p className="mt-3 text-sm text-muted">Preparando a base de exercícios…</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-danger">{status.message}</p>
              <p className="mt-1 text-xs text-muted">O primeiro acesso precisa de internet (~1,5 MB).</p>
              <Button className="mt-4" onClick={retry}>
                Tentar de novo
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/treino" replace />} />
        <Route path="/treino" element={<RoutinePage />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/sessao/:id" element={<SessionPage />} />
        <Route path="/exercicios" element={<Catalog />} />
        <Route path="/exercicio/:id" element={<ExerciseDetail />} />
        <Route path="/historico" element={<Soon title="Histórico" />} />
        <Route path="/config" element={<Soon title="Ajustes" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}
