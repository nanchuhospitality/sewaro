'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AutoRefresh({ everyMs = 4000 }: { everyMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh()
    }, everyMs)
    return () => clearInterval(timer)
  }, [router, everyMs])

  return null
}
