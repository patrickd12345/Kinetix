import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get the authorization header from the request
  const authHeader = req.headers.authorization || req.headers.Authorization

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' })
  }

  // Extract the path from the query string (everything after /api/strava/)
  // The rewrite rule passes the path as a query parameter
  const path = (req.query.path as string) || 'athlete/activities'
  const queryParams = new URLSearchParams()
  
  // Forward query parameters (excluding 'path' which is our internal routing param)
  Object.keys(req.query).forEach((key) => {
    if (key !== 'path' && req.query[key]) {
      const value = req.query[key]
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v))
      } else {
        queryParams.append(key, value as string)
      }
    }
  })

  const stravaUrl = `https://www.strava.com/api/v3/${path}${queryParams.toString() ? '?' + queryParams.toString() : ''}`

  try {
    const response = await fetch(stravaUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    // Forward the status code and data
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Strava API proxy error:', error)
    res.status(500).json({ 
      error: 'Failed to proxy request to Strava API',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
