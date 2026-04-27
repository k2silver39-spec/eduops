import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!process.env.VAPID_SUBJECT || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const admin = createAdminClient()

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    console.error('[push] fetch subscriptions error:', error)
    return
  }

  if (!subs || subs.length === 0) return

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('[push] sendNotification error:', err)
        }
      }
    })
  )
}
