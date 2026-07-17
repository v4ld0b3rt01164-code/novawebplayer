interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 font-semibold transition active:scale-[0.98] disabled:opacity-60'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-white shadow-lg shadow-accent/20'
      : 'bg-surface text-zinc-100 ring-1 ring-zinc-800'

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}
