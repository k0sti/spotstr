interface LocationEventParams {
  senderAccount: any
  receiverPublicKey: string | null // null for public events
  geohash: string
  locationName?: string
  accuracy?: number
  expirySeconds?: number
  additionalTags?: string[][]
  isPublic?: boolean
}

interface SigningResult {
  success: boolean
  signedEvent?: any
  error?: string
}

export async function createLocationEvent(params: LocationEventParams) {
  const {
    senderAccount,
    receiverPublicKey,
    geohash,
    locationName,
    accuracy,
    expirySeconds = 3600, // default 1 hour
    additionalTags = [],
    isPublic = false
  } = params

  const currentTime = Math.floor(Date.now() / 1000)

  if (isPublic) {
    // Create public location event (kind: 30472)
    const dTag = locationName || `${Date.now()}`

    const tags: string[][] = [
      ['d', dTag],
      ['g', geohash],
    ]

    if (accuracy && accuracy > 0) {
      tags.push(['accuracy', accuracy.toString()])
    }

    if (locationName) {
      tags.push(['name', locationName])
    }

    if (expirySeconds) {
      tags.push(['expiry', (currentTime + expirySeconds).toString()])
    }

    // Add any additional tags
    tags.push(...additionalTags)

    const unsignedEvent = {
      kind: 30472,
      pubkey: senderAccount.pubkey,
      created_at: currentTime,
      tags,
      content: '',
    }

    return { unsignedEvent, encryptedContent: null }
  } else {
    // Create private location event (kind: 30473)
    if (!receiverPublicKey) {
      throw new Error('Receiver public key required for private events')
    }

    // Prepare location data tags for encryption
    const locationTags: string[][] = [['g', geohash]]

    if (accuracy && accuracy > 0) {
      locationTags.push(['accuracy', accuracy.toString()])
    }

    if (locationName) {
      locationTags.push(['name', locationName])
    }

    // Add additional tags to encrypted content
    locationTags.push(...additionalTags)

    // Encrypt location data
    const encryptedContent = await encryptLocationData(
      senderAccount,
      receiverPublicKey,
      JSON.stringify(locationTags)
    )

    const dTag = locationName || `${Date.now()}`

    const unsignedEvent = {
      kind: 30473,
      pubkey: senderAccount.pubkey,
      created_at: currentTime,
      tags: [
        ['d', dTag],
        ['p', receiverPublicKey],
        ['expiry', (currentTime + expirySeconds).toString()],
      ],
      content: encryptedContent,
    }

    return { unsignedEvent, encryptedContent }
  }
}

async function encryptLocationData(
  senderAccount: any,
  receiverPublicKey: string,
  plaintext: string
): Promise<string> {
  // Use account's signer for encryption
  if (senderAccount.signer.nip44?.encrypt) {
    return await senderAccount.signer.nip44.encrypt(
      receiverPublicKey,
      plaintext
    )
  } else if (senderAccount.type === 'amber-clipboard') {
    // Handle Amber encryption via clipboard
    return await handleAmberEncryption(plaintext, receiverPublicKey)
  } else {
    throw new Error('Account does not support NIP-44 encryption')
  }
}

async function handleAmberEncryption(plaintext: string, receiverPublicKey: string): Promise<string> {
  const intentUrl = `nostrsigner:${encodeURIComponent(plaintext)}?pubkey=${receiverPublicKey}&compressionType=none&returnType=signature&type=nip44_encrypt`

  // Store current clipboard content
  const originalClipboard = await navigator.clipboard.readText().catch(() => '')

  // Open Amber for encryption
  window.location.href = intentUrl

  // Wait for encrypted content to be copied to clipboard
  return new Promise((resolve, reject) => {
    const checkClipboard = async () => {
      const clipboardContent = await navigator.clipboard.readText().catch(() => '')

      if (clipboardContent && clipboardContent !== originalClipboard) {
        resolve(clipboardContent)
      }
    }

    // Check clipboard when page regains focus
    const handleFocus = () => {
      setTimeout(checkClipboard, 500)
    }

    window.addEventListener('focus', handleFocus, { once: true })

    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener('focus', handleFocus)
      reject(new Error('Amber encryption timeout'))
    }, 30000)
  })
}

export async function signAndPublishLocationEvent(
  unsignedEvent: any,
  signer: any,
  relayUrls: string[],
  publishFunction: (event: any, relayUrls: string[], signer: any) => Promise<void>
): Promise<SigningResult> {
  try {
    // Sign and publish the event
    await publishFunction(unsignedEvent, relayUrls, signer)

    return {
      success: true,
      signedEvent: unsignedEvent
    }
  } catch (error) {
    console.error('Failed to sign/publish location event:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Parse human-readable time to seconds
export function parseExpiryTime(input: string): number {
  const match = input.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|weeks)$/i)

  if (!match) {
    throw new Error('Invalid time format. Use: 5min, 1h, 2d, etc.')
  }

  const value = parseInt(match[1])
  const unit = match[2].toLowerCase()

  switch (unit[0]) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    case 'w': return value * 604800
    default: return value * 60 // default to minutes
  }
}