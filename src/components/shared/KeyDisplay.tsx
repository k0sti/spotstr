import { useMemo, ReactNode } from 'react'
import { HStack, VStack, Text, IconButton, Tooltip, useToast } from '@chakra-ui/react'
import { npubEncode, nsecEncode } from 'nostr-tools/nip19'

interface KeyDisplayProps {
  pubkey: string
  secretKey?: string | Uint8Array
  showPrivateKey?: boolean
  badge?: ReactNode
}

export function KeyDisplay({ pubkey, secretKey, showPrivateKey = true, badge }: KeyDisplayProps) {
  const toast = useToast()

  const npubFull = useMemo(() => {
    try {
      return npubEncode(pubkey)
    } catch {
      return pubkey
    }
  }, [pubkey])

  const npubShort = useMemo(() => {
    if (npubFull.startsWith('npub')) {
      return `${npubFull.slice(4, 10)}...${npubFull.slice(-6)}`
    }
    return `${npubFull.slice(0, 8)}...`
  }, [npubFull])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: `${label} copied`,
        status: 'success',
        duration: 2000,
      })
    } catch {
      toast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
      })
    }
  }

  return (
    <VStack align="start" spacing={1}>
      <HStack spacing={1}>
        <Text fontSize="xs" color="gray.600">npub</Text>
        <Tooltip label="Copy npub">
          <IconButton
            size="xs"
            aria-label="Copy npub"
            icon={<span>📋</span>}
            variant="ghost"
            onClick={() => copyToClipboard(npubFull, 'Public key')}
          />
        </Tooltip>
        {badge && badge}
        {showPrivateKey && secretKey && (
          <>
            <Tooltip label="Copy nsec (sensitive!)">
              <IconButton
                size="xs"
                aria-label="Copy nsec"
                icon={<span>🔐</span>}
                variant="ghost"
                colorScheme="red"
                onClick={() => {
                  try {
                    // Handle both string (already encoded nsec) and Uint8Array
                    const nsec = typeof secretKey === 'string' && secretKey.startsWith('nsec')
                      ? secretKey
                      : nsecEncode(secretKey as Uint8Array)
                    copyToClipboard(nsec, 'Private key (keep this secret!)')
                  } catch (error) {
                    console.error('Failed to encode nsec:', error)
                  }
                }}
              />
            </Tooltip>
          </>
        )}
      </HStack>
      <Text fontSize="xs" fontFamily="mono" color="gray.700">
        {npubShort}
      </Text>
    </VStack>
  )
}