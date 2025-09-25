import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Input,
  Text,
  useDisclosure,
  IconButton,
  useToast,
  Tooltip,
  Divider
} from '@chakra-ui/react'
import { useGroups } from '../hooks/useGroups'

// Group Row Component
function GroupRow({ group, onDelete, onCopy, onShare }: {
  group: any
  onDelete: (group: any) => void
  onCopy: (text: string, label: string) => void
  onShare: (group: any) => void
}) {
  const npubFull = group.npub
  const npubShort = useMemo(() => {
    if (npubFull.startsWith('npub')) {
      const withoutPrefix = npubFull.slice(4)
      return `${withoutPrefix.slice(0, 5)}..${withoutPrefix.slice(-5)}`
    }
    return group.npub.slice(0, 8) + '...'
  }, [npubFull, group.npub])

  const nsecShort = useMemo(() => {
    if (group.nsec.startsWith('nsec')) {
      const withoutPrefix = group.nsec.slice(4)
      return `${withoutPrefix.slice(0, 5)}..${withoutPrefix.slice(-5)}`
    }
    return 'Hidden'
  }, [group.nsec])

  return (
    <Tr>
      <Td>
        <HStack spacing={2}>
          {group.metadata?.picture && (
            <Box
              width="24px"
              height="24px"
              borderRadius="full"
              overflow="hidden"
              flexShrink={0}
            >
              <img
                src={group.metadata.picture}
                alt={group.name || 'Group'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </Box>
          )}
          <Text fontSize="sm" fontWeight="medium">
            {group.name}
          </Text>
        </HStack>
      </Td>
      <Td>
        <VStack align="start" spacing={0}>
          <HStack spacing={1}>
            <Text fontSize="xs" color="gray.600">npub</Text>
            <Tooltip label="Copy npub">
              <IconButton
                size="xs"
                aria-label="Copy npub"
                icon={<span>📋</span>}
                variant="ghost"
                onClick={() => onCopy(npubFull, 'Group public key')}
              />
            </Tooltip>
          </HStack>
          <Text fontSize="xs" fontFamily="mono" color="gray.700">
            {npubShort}
          </Text>
        </VStack>
      </Td>
      <Td>
        <VStack align="start" spacing={0}>
          <HStack spacing={1}>
            <Text fontSize="xs" color="gray.600">nsec</Text>
            <Tooltip label="Copy nsec (sensitive!)">
              <IconButton
                size="xs"
                aria-label="Copy nsec"
                icon={<span>🔐</span>}
                variant="ghost"
                colorScheme="red"
                onClick={() => onCopy(group.nsec, 'Group private key (keep this secret!)')}
              />
            </Tooltip>
          </HStack>
          <Text fontSize="xs" fontFamily="mono" color="gray.700">
            {nsecShort}
          </Text>
        </VStack>
      </Td>
      <Td>
        <HStack spacing={1}>
          <Tooltip label="Share group">
            <IconButton
              size="xs"
              aria-label="Share group"
              icon={<span>🔗</span>}
              colorScheme="blue"
              variant="ghost"
              onClick={() => onShare(group)}
            />
          </Tooltip>
          <IconButton
            size="xs"
            aria-label="Delete group"
            icon={<span>🗑️</span>}
            colorScheme="red"
            variant="ghost"
            onClick={() => onDelete(group)}
          />
        </HStack>
      </Td>
    </Tr>
  )
}

export function GroupsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isShareOpen, onOpen: onShareOpen, onClose: onShareClose } = useDisclosure()
  const {
    groups,
    generateGroup,
    importFromNsec,
    deleteGroup,
    generateShareUrl
  } = useGroups()
  const toast = useToast()
  const [nameInput, setNameInput] = useState('')
  const [nsecInput, setNsecInput] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<any>(null)

  // Generate new group
  const handleGenerateGroup = () => {
    const group = generateGroup(nameInput || 'New Group')

    toast({
      title: 'Group created',
      description: `Group "${group.name}" has been created`,
      status: 'success',
      duration: 3000,
    })

    setNameInput('')
    onClose()
  }

  // Import from nsec
  const handleImportNsec = () => {
    if (!nsecInput.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Please enter an nsec key',
        status: 'error',
        duration: 3000,
      })
      return
    }

    const group = importFromNsec(nameInput || 'Imported Group', nsecInput.trim())

    if (group) {
      toast({
        title: 'Group imported',
        description: `Group "${group.name}" has been imported`,
        status: 'success',
        duration: 3000,
      })
      setNameInput('')
      setNsecInput('')
      onClose()
    } else {
      toast({
        title: 'Import failed',
        description: 'Invalid nsec or group already exists',
        status: 'error',
        duration: 3000,
      })
    }
  }

  // Delete group
  const handleDeleteGroup = (group: any) => {
    deleteGroup(group.id)
    toast({
      title: 'Group deleted',
      description: `Group "${group.name}" has been removed`,
      status: 'info',
      duration: 3000,
    })
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: `${type} copied`,
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Copy failed',
        status: 'error',
        duration: 2000,
      })
    }
  }

  // Handle share group
  const handleShareGroup = (group: any) => {
    const url = generateShareUrl(group)
    setShareUrl(url)
    setSelectedGroup(group)
    onShareOpen()
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Groups</Text>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Create Group +</Button>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Public Key</Th>
            <Th>Private Key</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onDelete={handleDeleteGroup}
              onCopy={copyToClipboard}
              onShare={handleShareGroup}
            />
          ))}
        </Tbody>
      </Table>

      {groups.length === 0 && (
        <Box p={8} textAlign="center">
          <Text color="gray.600" mb={4}>No groups yet</Text>
          <Button onClick={onOpen} size="sm" colorScheme="blue">
            Create your first group
          </Button>
        </Box>
      )}

      <Divider my={6} />

      <Box p={4} bg="gray.50" borderRadius="md">
        <Text fontSize="sm" fontWeight="bold" mb={2}>About Groups</Text>
        <Text fontSize="xs" color="gray.600" mb={2}>
          Groups are Nostr identities managed by the app. They have their own keys (nsec/npub) that can be used to share locations with multiple contacts.
        </Text>
        <Text fontSize="xs" color="gray.600">
          • Generate new keys for a fresh group identity
          • Import existing nsec keys to use an existing identity
          • Share groups via URL for easy setup on other devices
        </Text>
      </Box>

      {/* Create Group Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              {/* Name input (always first) */}
              <Input
                placeholder="Group name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
              />

              {/* Generate new keys */}
              <Button onClick={handleGenerateGroup} colorScheme="green" w="full">
                Generate New Group
              </Button>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                — OR —
              </Text>

              {/* Import from nsec */}
              <VStack spacing={2}>
                <Input
                  placeholder="Paste nsec key"
                  value={nsecInput}
                  onChange={(e) => setNsecInput(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                  type="password"
                />
                <Button
                  onClick={handleImportNsec}
                  disabled={!nsecInput}
                  size="sm"
                  colorScheme="blue"
                  w="full"
                >
                  Import from nsec
                </Button>
              </VStack>

              <Text fontSize="xs" color="gray.500" textAlign="center" mt={2}>
                Groups can also be imported via URL parameters
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Share Group Modal */}
      <Modal isOpen={isShareOpen} onClose={onShareClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Share Group: {selectedGroup?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Share this URL to import the group on another device:
              </Text>

              <Box
                p={3}
                bg="gray.100"
                borderRadius="md"
                fontSize="xs"
                fontFamily="mono"
                wordBreak="break-all"
              >
                {shareUrl}
              </Box>

              <Button
                onClick={() => copyToClipboard(shareUrl, 'Share URL')}
                colorScheme="blue"
                leftIcon={<span>📋</span>}
              >
                Copy URL
              </Button>

              <Divider />

              <Box>
                <Text fontSize="sm" fontWeight="bold" color="red.600" mb={2}>
                  ⚠️ Security Warning
                </Text>
                <Text fontSize="xs" color="gray.600">
                  This URL contains the group's private key (nsec). Anyone with this URL will have full control of the group. Only share with trusted parties and use secure communication channels.
                </Text>
              </Box>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}