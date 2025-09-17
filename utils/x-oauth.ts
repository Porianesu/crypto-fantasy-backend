import OAuth from 'oauth-1.0a'
import crypto from 'crypto'

export const getOAuth = () =>
  new OAuth({
    consumer: {
      key: process.env.X_API_KEY!,
      secret: process.env.X_API_KEY_SECRET!,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64')
    },
  })
