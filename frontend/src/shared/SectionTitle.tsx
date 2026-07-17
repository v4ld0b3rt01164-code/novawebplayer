interface SectionTitleProps {
  children: React.ReactNode
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <h2 className="px-4 pt-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
      {children}
    </h2>
  )
}
