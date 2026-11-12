import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, LayoutDashboard } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-lg overflow-hidden text-center">
        <div className="bg-[linear-gradient(135deg,#FFF0E8,#FAF7F2)] px-6 py-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary shadow-soft">
            <Compass size={30} />
          </div>
          <p className="mt-5 font-display text-[56px] font-extrabold leading-none tracking-[-0.06em] text-ink">404</p>
          <h1 className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink">This page is off the menu</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">The page you are looking for does not exist, or it moved to another part of the workspace.</p>
        </div>
        <div className="flex flex-col justify-center gap-2 p-5 sm:flex-row">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary"><ArrowLeft size={15} /> Go back</button>
          <Link to="/dashboard" className="btn-primary"><LayoutDashboard size={15} /> Back to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
