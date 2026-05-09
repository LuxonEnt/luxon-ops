export function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`rounded-xl bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}
