import { requireRole } from '@/lib/auth/requireRole'
import SuperadminNavbar from '@/components/superadmin/SuperadminNavbar'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('SUPERADMIN')

  return (
    <div className="min-h-screen bg-slate-50">
      <SuperadminNavbar />
      <div>{children}</div>
    </div>
  )
}
