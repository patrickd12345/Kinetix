import type { ServerResponse } from 'http'
import type { VercelResponse } from '@vercel/node'

/**
 * Minimal VercelResponse shim for raw Node `http.ServerResponse` (Vite dev middleware).
 * Matches the subset used by API routes: `res.status().json()`, `res.redirect()`, `appendHeader`, `status().send()`.
 */
export function adaptNodeResponseToVercel(res: ServerResponse): VercelResponse {
  const chain = {
    status(code: number) {
      res.statusCode = code
      return {
        json(body: unknown) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
          }
          res.end(JSON.stringify(body))
        },
        send(body: string | Buffer) {
          if (!res.headersSent && !res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
          }
          res.end(body)
        },
        end(chunk?: string | Buffer) {
          res.end(chunk)
        },
      }
    },
    appendHeader(name: string, value: string | ReadonlyArray<string>) {
      const values = Array.isArray(value) ? value : [String(value)]
      for (const v of values) {
        res.appendHeader(name, v)
      }
    },
    redirect(status: number, location: string) {
      res.statusCode = status
      res.setHeader('Location', location)
      res.end()
    },
    setHeader(name: string, value: string | number | ReadonlyArray<string>) {
      res.setHeader(name, value as string)
      return chain
    },
    end(chunk?: string | Buffer) {
      res.end(chunk)
    },
  }

  return chain as unknown as VercelResponse
}
