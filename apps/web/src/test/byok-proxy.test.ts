import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import chatHandler from '../../api/ai-chat'

const executeAIMock = vi.fn(async () => ({ text: 'ok', raw: {} }))

vi.mock('@bookiji/ai-core', () => ({
  executeAI: executeAIMock,
}))

type MockRes = VercelResponse & { body?: any; headers: Record<string, any>; statusCode?: number }

function createRes(): MockRes {
  const res: Partial<MockRes> = {
    headers: {},
    status(code: number) {
      this.statusCode = code
      return this as any
    },
    setHeader(name: string, value: any) {
      this.headers[name.toLowerCase()] = value
    },
    json(payload: any) {
      this.body = payload
      return this as any
    },
    end() {
      return this as any
    },
  }
  return res as MockRes
}

function createReq(overrides: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as VercelRequest
}

describe('Gemini proxy BYOK enforcement', () => {
  beforeEach(() => {
    executeAIMock.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('rejects requests with BYOK header', async () => {
    const req = createReq({
      headers: { 'x-openai-key': 'sk-test-12345678901234567890' },
      body: { systemInstruction: 'sys', contents: [] },
    })
    const res = createRes()

    await chatHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error || '')).toMatch(/BYOK/i)
    expect(executeAIMock).not.toHaveBeenCalled()
  })

  it('uses server key without placing it in the URL', async () => {
    const req = createReq({
      headers: {},
      body: { systemInstruction: 'sys', contents: [] },
    })
    const res = createRes()

    await chatHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(executeAIMock).toHaveBeenCalled()
    const callArgs = executeAIMock.mock.calls[0][0]
    expect(callArgs.byokKey).toBeNull()
  })
})
