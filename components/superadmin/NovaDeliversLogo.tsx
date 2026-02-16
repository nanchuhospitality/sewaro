import { useId } from 'react'

type Props = {
  className?: string
}

export default function NovaDeliversLogo({ className = 'h-8 w-8' }: Props) {
  const gradientId = useId().replace(/:/g, '')

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Nova Delivers enabled"
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#4c1dff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="12" fill={`url(#${gradientId})`} />
      <circle cx="32" cy="14" r="3.5" fill="white" />
      <path d="M11 35c1-11 9-19 21-19s20 8 21 19H11z" fill="white" />
      <path d="M50.5 27.5c2.2 2.6 3.5 5.7 3.9 9.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="10" y1="39.5" x2="54" y2="39.5" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M25 45h14a7 7 0 0 1-14 0z" fill="white" />
    </svg>
  )
}
