import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number = 60 * 60 * 1000
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowMs).toISOString()
  const resetAt = new Date(Date.now() + windowMs)

  const { count, error: countError } = await admin
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', since)

  if (countError) {
    console.error('[rate-limit] count error:', countError)
    return { allowed: true, remaining: limit, limit, resetAt }
  }

  const used = count ?? 0
  if (used >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt }
  }

  const { error: insertError } = await admin
    .from('rate_limit_log')
    .insert({ user_id: userId, endpoint })

  if (insertError) {
    console.error('[rate-limit] insert error:', insertError)
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - used - 1),
    limit,
    resetAt,
  }
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
        'Retry-After': '3600',
      },
    }
  )
}
