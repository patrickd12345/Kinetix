import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-10 text-slate-900 dark:from-slate-950 dark:to-black dark:text-slate-100">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/90">
        <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Last updated for Kinetix beta.</p>
        <div className="prose prose-slate mt-6 max-w-none text-sm dark:prose-invert">
          <h2 className="text-lg font-semibold">Data we collect</h2>
          <p>
            Kinetix processes fitness and activity data you choose to connect or log (for example runs, weight, and
            related metrics), account identifiers, and authentication data needed to operate the service.
          </p>
          <h2 className="mt-4 text-lg font-semibold">Third parties</h2>
          <p>
            We use Supabase for authentication and data storage. Where enabled, Google services may be used for sign-in
            or advertising (for example Google AdSense). Those providers process data under their own policies.
          </p>
          <h2 className="mt-4 text-lg font-semibold">Cookies and storage</h2>
          <p>
            The app may use cookies, local storage, and similar technologies for session management, preferences, and
            analytics or ads where configured. You can control cookies through your browser and our cookie notice where
            shown.
          </p>
          <h2 className="mt-4 text-lg font-semibold">Contact</h2>
          <p>
            Questions: use the{' '}
            <Link className="text-cyan-700 underline dark:text-cyan-400" to="/contact">
              Contact
            </Link>{' '}
            page.
          </p>
        </div>
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
