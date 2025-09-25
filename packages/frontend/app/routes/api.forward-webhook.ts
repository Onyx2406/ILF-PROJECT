import type { ActionFunctionArgs } from '@remix-run/node'

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const body = await request.json()
    
    console.log('🔄 Forwarding webhook to ABL service:', {
      type: body.type,
      timestamp: new Date().toISOString()
    })

    // Try multiple approaches to reach the host machine
    const urls = [
      'http://172.17.0.1:3004/api/webhooks/receive',  // Docker bridge gateway
      'http://host.docker.internal:3004/api/webhooks/receive',  // Docker desktop
      'http://localhost:3004/api/webhooks/receive'  // Localhost (if host networking)
    ]

    let success = false
    for (const url of urls) {
      try {
        console.log(`Trying URL: ${url}`)
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        })

        if (response.ok) {
          console.log(`✅ Webhook forwarded successfully to ABL service via ${url}`)
          success = true
          break
        } else {
          console.log(`❌ Failed via ${url}: ${response.status}`)
        }
      } catch (error) {
        console.log(`❌ Error with ${url}:`, String(error))
      }
    }

    if (!success) {
      console.error('❌ Failed to forward webhook to ABL service via all URLs')
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (error) {
    console.error('❌ Error forwarding webhook:', error)
    return new Response('Error forwarding webhook', { status: 500 })
  }
}
