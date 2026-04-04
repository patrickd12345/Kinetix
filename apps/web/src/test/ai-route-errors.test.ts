import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import chatHandler from '@api/ai-chat'
import coachHandler from '@api/ai-coach'

const handleAiChatRequestMock = vi.hoisted(() => vi.fn())
const handleAiCoachRequestMock = vi.hoisted(() => vi.fn())

vi.mock('@api/_lib/ai/requestHandlers', () => ({
  handleAiChatRequest: handleAiChatRequestMock,
  handleAiCoachRequest: handleAiCoachRequestMock,
}))

type MockRes = VercelResponse & { body?: unknown; headers: Record<string, unknown>; statusCode?: number }

function createRes(): MockRes {
  const res: Partial<MockRes> = {
    headers: {},
    status(code: number) {
      this.statusCode = code
      return this as VercelResponse
    },
    setHeader(name: string, value: unknown) {
      this.headers[name.toLowerCase()] = value
    },
    json(payload: unknown) {
      this.body = payload
      return this as VercelResponse
    },
    end() {
      return this as VercelResponse
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

describe('AI route error contract adoption', () => {
  beforeEach(() => {
    handleAiChatRequestMock.mockReset()
    handleAiCoachRequestMock.mockReset()
  })

  it('serializes ai-chat handler errors with requestId', async () => {
    handleAiChatRequestMock.mockResolvedValue({
      code: 'invalid_request',
      message: 'systemInstruction and contents are required.',
      requestId: 'req_chat',
      status: 400,
    })

    const res = createRes()
    await chatHandler(createReq({ body: {} }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      code: 'invalid_request',
      message: 'systemInstruction and contents are required.',
      requestId: 'req_chat',
    })
  })

  it('serializes ai-coach handler errors with requestId', async () => {
    handleAiCoachRequestMock.mockResolvedValue({
      code: 'unauthorized',
      message: 'Authorization header is required.',
      requestId: 'req_coach',
      status: 401,
    })

    const res = createRes()
    await coachHandler(createReq({ body: {} }), res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({
      code: 'unauthorized',
      message: 'Authorization header is required.',
      requestId: 'req_coach',
    })
  })

  it('preserves ai-chat catch response shape while honoring thrown status', async () => {
    handleAiChatRequestMock.mockRejectedValue(Object.assign(new Error('boom'), { status: 502 }))

    const res = createRes()
    await chatHandler(createReq({ body: {} }), res)

    expect(res.statusCode).toBe(502)
    expect(res.body).toMatchObject({
      code: 'ai_execution_failed',
      message: 'boom',
    })
    expect(typeof (res.body as { requestId?: unknown }).requestId).toBe('string')
  })
})
