import { useState } from 'react'
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
  ModalFooter,
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
import { QRCodeCanvas } from 'qrcode.react'
import { useGroups } from '../hooks/useGroups'
import { useGroupCustomNames } from '../hooks/useGroupCustomNames'
import { IdentityDisplay } from './shared/IdentityDisplay'
import { KeyDisplay } from './shared/KeyDisplay'
import { npubToHex } from '../utils/crypto'

// Group Row Component
function GroupRow({ group, onDelete, onShare, onCopyShareUrl, customName, onUpdateCustomName }: {
  group: any
  onDelete: (group: any) => void
  onShare: (group: any) => void
  onCopyShareUrl: (group: any) => void
  customName?: string
  onUpdateCustomName: (groupId: string, name: string) => void
}) {
  const pubkey = npubToHex(group.npub)

  return (
    <Tr>
      <Td py={1} px={2}>
        <IdentityDisplay
          pubkey={pubkey}
          metadata={{ picture: group.metadata?.picture }}
          customName={customName || group.name}
          onUpdateCustomName={(name) => onUpdateCustomName(group.id, name)}
        />
      </Td>
      <Td py={1} px={2}>
        <KeyDisplay pubkey={pubkey} secretKey={group.nsec} />
      </Td>
      <Td py={1} px={2}>
        <HStack spacing={1}>
          <Tooltip label="Copy share URL">
            <IconButton
              size="xs"
              aria-label="Copy share URL"
              icon={<span>🔗</span>}
              colorScheme="blue"
              variant="ghost"
              onClick={() => onCopyShareUrl(group)}
            />
          </Tooltip>
          <Tooltip label="Show QR code">
            <IconButton
              size="xs"
              aria-label="Show QR code"
              icon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 0h7v7H0V0zm2 2v3h3V2H2zm7-2h7v7H9V0zm2 2v3h3V2h-3zM0 9h7v7H0V9zm2 2v3h3v-3H2z"/>
                  <rect x="9" y="9" width="2" height="2"/>
                  <rect x="12" y="9" width="2" height="2"/>
                  <rect x="9" y="12" width="2" height="2"/>
                  <rect x="12" y="12" width="2" height="2"/>
                  <rect x="11" y="10" width="2" height="2"/>
                  <rect x="10" y="11" width="2" height="2"/>
                </svg>
              }
              colorScheme="purple"
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
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure()
  const {
    groups,
    generateGroup,
    importFromNsec,
    deleteGroup,
    generateShareUrl
  } = useGroups()
  const { customNames, setCustomName } = useGroupCustomNames()
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

  // Handle copy share URL
  const handleCopyShareUrl = (group: any) => {
    const url = generateShareUrl(group)
    copyToClipboard(url, 'Share URL')
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <HStack spacing={2}>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Groups</Text>
          <Text fontSize="sm" color="gray.600">({groups.length})</Text>
        </HStack>
        <HStack spacing={2}>
          <Tooltip label="Create Group" placement="bottom">
            <IconButton
              aria-label="Create Group"
              icon={<span style={{ fontSize: '2rem' }}>+</span>}
              size="sm"
              colorScheme="blue"
              onClick={onOpen}
            />
          </Tooltip>
          <Tooltip label="About Groups" placement="bottom">
            <IconButton
              aria-label="Help"
              icon={<span style={{ fontSize: '1.5rem' }}>?</span>}
              size="sm"
              colorScheme="blue"
              onClick={onHelpOpen}
            />
          </Tooltip>
        </HStack>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th py={1} px={2}>Profile</Th>
            <Th py={1} px={2}>Key</Th>
            <Th py={1} px={2}>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onDelete={handleDeleteGroup}
              onShare={handleShareGroup}
              onCopyShareUrl={handleCopyShareUrl}
              customName={customNames[group.id]}
              onUpdateCustomName={setCustomName}
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

              {/* QR Code */}
              <Box display="flex" justifyContent="center" p={4} bg="white" borderRadius="md">
                {shareUrl && (
                  <QRCodeCanvas
                    value={shareUrl}
                    size={200}
                    level="M"
                    marginSize={1}
                  />
                )}
              </Box>

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

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={onHelpClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>About Groups</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Groups are Nostr identities managed by the app. They have their own keys (nsec/npub)
                that can be used to share locations with multiple contacts.
              </Text>

              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">Key Features:</Text>
                <Text fontSize="sm">• Generate new keys for a fresh group identity</Text>
                <Text fontSize="sm">• Import existing nsec keys to use an existing identity</Text>
                <Text fontSize="sm">• Share groups via URL or QR code for easy setup on other devices</Text>
              </VStack>

              <Text fontSize="sm" color="gray.600">
                Groups are perfect for sharing locations with family members, teams, or any trusted group
                of people. Each group member can decrypt and view shared locations.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onHelpClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}