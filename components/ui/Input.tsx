import clsx from 'clsx'
import { InputHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx('w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900', props.className)}
    />
  )
}
