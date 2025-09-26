import { useMemo } from 'react'
import { HStack, Avatar, VStack, Text, Editable, EditableInput, EditablePreview } from '@chakra-ui/react'
import { npubEncode } from 'nostr-tools/nip19'

interface IdentityDisplayProps {
  pubkey: string
  metadata?: {
    picture?: string
    name?: string
    display_name?: string
  }
  customName?: string
  onUpdateCustomName?: (name: string) => void
  size?: 'sm' | 'md' | 'lg'
}

export function IdentityDisplay({
  pubkey,
  metadata,
  customName,
  onUpdateCustomName,
  size = 'sm'
}: IdentityDisplayProps) {
  const npub = useMemo(() => {
    try {
      return npubEncode(pubkey)
    } catch {
      return pubkey
    }
  }, [pubkey])

  // Get profile name (metadata.name or display_name)
  const profileName = metadata?.name || metadata?.display_name

  // For avatar: use profile name, custom name, or truncated npub
  const avatarName = profileName || customName || npub.slice(0, 16) + '...'

  const avatarSize = size === 'sm' ? '32px' : size === 'md' ? '40px' : '48px'
  const fontSize = size === 'sm' ? 'sm' : size === 'md' ? 'md' : 'lg'

  return (
    <HStack spacing={2} align="start">
      <Avatar
        src={metadata?.picture}
        name={avatarName}
        size={avatarSize}
        width={avatarSize}
        height={avatarSize}
      />
      <VStack align="start" spacing={0}>
        {profileName && (
          <Text fontWeight="semibold" fontSize={fontSize}>
            {profileName}
          </Text>
        )}
        {onUpdateCustomName ? (
          <Editable
            defaultValue={customName || ''}
            placeholder={profileName ? "Add custom name" : "Add name"}
            fontSize={profileName ? "xs" : fontSize}
            color={customName ? 'blue.600' : 'gray.500'}
            fontWeight={!profileName && customName ? 'semibold' : 'normal'}
            onSubmit={onUpdateCustomName}
          >
            <EditablePreview />
            <EditableInput />
          </Editable>
        ) : customName ? (
          <Text
            fontSize={profileName ? "xs" : fontSize}
            color={profileName ? "blue.600" : "inherit"}
            fontWeight={!profileName ? 'semibold' : 'normal'}
          >
            {customName}
          </Text>
        ) : !profileName ? (
          <Text fontSize={fontSize} color="gray.500">
            {npub.slice(0, 16) + '...'}
          </Text>
        ) : null}
      </VStack>
    </HStack>
  )
}