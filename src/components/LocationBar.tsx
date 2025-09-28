import { HStack, IconButton, Input, Button, Tooltip, Badge, Box, useColorModeValue } from '@chakra-ui/react'
import { FaLocationArrow, FaShareAlt, FaStop } from 'react-icons/fa'
import { ContinuousSharingState } from '../services/continuousSharingService'

interface LocationBarProps {
  geohashInput: string
  onGeohashChange: (value: string) => void
  onGeohashSubmit: () => void
  onToggleLocation: () => void
  onShareLocation: () => void
  onStopSharing: () => void
  isQueryingLocation: boolean
  locationButtonColor: 'gray' | 'blue' | 'red' | 'yellow'
  continuousSharingState: ContinuousSharingState
}

export function LocationBar({
  geohashInput,
  onGeohashChange,
  onGeohashSubmit,
  onToggleLocation,
  onShareLocation,
  onStopSharing,
  isQueryingLocation,
  locationButtonColor,
  continuousSharingState
}: LocationBarProps) {
  const bgColor = useColorModeValue('rgba(255, 255, 255, 0.9)', 'rgba(26, 32, 44, 0.85)')
  const borderColor = useColorModeValue('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)')
  const inputBg = useColorModeValue('white', 'gray.700')
  const inputColor = useColorModeValue('gray.800', 'white')

  const getLocationButtonColor = () => {
    switch (locationButtonColor) {
      case 'blue': return 'blue.500'
      case 'red': return 'red.500'
      case 'yellow': return 'yellow.400'
      default: return 'gray.500'
    }
  }

  return (
    <Box
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      zIndex={999}
      paddingBottom="var(--safe-area-inset-bottom)"
      bg={bgColor}
      backdropFilter="blur(10px)"
      borderTop={`1px solid ${borderColor}`}
      boxShadow="0 -2px 10px rgba(0, 0, 0, 0.3)"
      px={4}
      py={3}
    >
      <HStack spacing={2} align="center">
        <Input
          placeholder="Enter geohash or click location button"
          value={geohashInput}
          onChange={(e) => onGeohashChange(e.target.value)}
          bg={inputBg}
          color={inputColor}
          borderColor={borderColor}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              onGeohashSubmit()
            }
          }}
          size="sm"
          _placeholder={{ color: 'gray.400' }}
          _hover={{ borderColor: useColorModeValue('gray.400', 'rgba(255, 255, 255, 0.3)') }}
          _focus={{ borderColor: 'blue.400', bg: useColorModeValue('gray.50', 'rgba(255, 255, 255, 0.15)') }}
          flex={1}
        />

        <Tooltip
          label={isQueryingLocation ? "Stop GPS tracking" : "Get current location"}
          placement="top"
        >
          <IconButton
            aria-label="Toggle location"
            icon={<FaLocationArrow />}
            onClick={onToggleLocation}
            size="sm"
            bg={getLocationButtonColor()}
            color="white"
            _hover={{ opacity: 0.8 }}
            isActive={isQueryingLocation}
            animation={isQueryingLocation ? 'pulse 2s infinite' : undefined}
          />
        </Tooltip>

        <Button
          leftIcon={<FaShareAlt />}
          onClick={onShareLocation}
          size="sm"
          colorScheme="green"
          variant="solid"
        >
          Share
        </Button>

        {continuousSharingState.isSharing && (
          <>
            <Badge
              colorScheme="green"
              variant="solid"
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
            >
              Sharing: {continuousSharingState.eventCount} sent
            </Badge>

            <Tooltip label="Stop continuous sharing" placement="top">
              <IconButton
                aria-label="Stop sharing"
                icon={<FaStop />}
                onClick={onStopSharing}
                size="sm"
                colorScheme="red"
                variant="solid"
              />
            </Tooltip>
          </>
        )}
      </HStack>
    </Box>
  )
}