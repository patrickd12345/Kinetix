import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer
      className="mt-10 border-t border-slate-200/90 pt-6 text-center text-xs text-slate-600 dark:border-white/10 dark:text-slate-400"
      role="contentinfo"
    >
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link className="shell-focus-ring rounded text-cyan-800 underline dark:text-cyan-400" to="/privacy">
          Privacy Policy
        </Link>
        <span aria-hidden className="text-slate-400">
          ·
        </span>
        <Link className="shell-focus-ring rounded text-cyan-800 underline dark:text-cyan-400" to="/terms">
          Terms of Service
        </Link>
        <span aria-hidden className="text-slate-400">
          ·
        </span>
        <Link className="shell-focus-ring rounded text-cyan-800 underline dark:text-cyan-400" to="/contact">
          Contact
        </Link>
      </nav>
      <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-500">Kinetix beta — Bookiji Inc</p>
    </footer>
  )
}
