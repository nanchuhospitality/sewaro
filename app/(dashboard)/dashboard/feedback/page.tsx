import { requireRole } from '@/lib/auth/requireRole'
import { formatRoomLabel } from '@/lib/utils/rooms'

const ratingLabel: Record<number, string> = {
  1: 'Very Bad',
  2: 'Bad',
  3: 'Average',
  4: 'Good',
  5: 'Loved it',
}

export default async function DashboardFeedbackPage() {
  const { profile, supabase } = await requireRole('BUSINESS_ADMIN')
  if (!profile.business_id) {
    return <p className="text-sm text-slate-600">No business linked to this account yet.</p>
  }

  const { data: feedbacks, error } = await supabase
    .from('feedback_submissions')
    .select('id,rating,room,factors,comment,created_at')
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return <p className="text-sm text-red-600">Could not load feedback. Run migration 0004_add_feedback_submissions.sql.</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Feedback</h1>
        <p className="mt-1 text-sm text-slate-600">Latest customer feedback submissions.</p>
      </div>

      {(feedbacks || []).length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">No feedback submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(feedbacks || []).map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.rating}/5 · {ratingLabel[item.rating] || 'Rating'}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>

              {item.room && <p className="mt-1 text-xs font-medium text-slate-600">Room: {formatRoomLabel(item.room)}</p>}

              {(item.factors || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(item.factors || []).map((factor: string) => (
                    <span key={factor} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {factor}
                    </span>
                  ))}
                </div>
              )}

              {item.comment && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {item.comment}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
