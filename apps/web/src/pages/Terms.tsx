import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-10 text-slate-900 dark:from-slate-950 dark:to-black dark:text-slate-100">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/90">
        <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Last updated for Kinetix beta.</p>
        <div className="prose prose-slate mt-6 max-w-none text-sm dark:prose-invert">
          <h2 className="text-lg font-semibold">Use of the service</h2>
          <p>
            Kinetix is provided as-is during beta. Features may change or be interrupted. Do not misuse the service or
            attempt to access data or systems you are not authorized to use.
          </p>
          <h2 className="mt-4 text-lg font-semibold">Not medical advice</h2>
          <p>
            Kinetix is not a medical device and does not provide medical advice, diagnosis, or treatment. Always consult a
            qualified professional for health decisions.
          </p>
          <h2 className="mt-4 text-lg font-semibold">Liability</h2>
          <p>
            To the extent permitted by law, Kinetix and its operators disclaim liability arising from use of the
            service. You use the app at your own risk.
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
