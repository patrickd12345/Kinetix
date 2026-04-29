import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function Contact() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-10 text-slate-900 dark:from-slate-950 dark:to-black dark:text-slate-100">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/90">
        <h1 className="text-2xl font-bold tracking-tight">Contact</h1>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          For privacy or product inquiries during beta, email:{' '}
          <a className="font-medium text-cyan-800 underline dark:text-cyan-400" href="mailto:support@bookiji.com">
            support@bookiji.com
          </a>
        </p>
        <p className="mt-8">
          <Link className="text-sm font-medium text-cyan-800 underline dark:text-cyan-400" to="/login">
            Back to sign in
          </Link>
        </p>
        <Footer />
      </div>
    </div>
  )
}
