import { useState, useEffect } from 'react'
import { Box, Text, Button, VStack, HStack, Badge, useToast } from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'

interface EventLogEntry {
  id: string
  type: 'sent' | 'received'
  eventType: string
  message: string
  timestamp: number
  details?: any
}

export function EventLogPage() {
  const { locationEvents } = useNostr()
  const toast = useToast()
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([])

  useEffect(() => {
    // Convert location events to log entries
    const logEntries: EventLogEntry[] = locationEvents.map(event => ({
      id: event.id,
      type: 'sent',
      eventType: 'Location (30473)',
      message: `Location event from ${event.senderNpub.slice(0, 8)}... to ${event.receiverNpub.slice(0, 8)}...`,
      timestamp: event.created_at,
      details: {
        geohash: event.geohash,
        dTag: event.dTag,
        eventId: event.eventId
      }
    }))
    
    setEventLog(logEntries.sort((a, b) => b.timestamp - a.timestamp))
  }, [locationEvents])

  const clearLog = () => {
    setEventLog([])
    toast({
      title: 'Log cleared',
      description: 'Event log has been cleared',
      status: 'info',
      duration: 2000,
    })
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleTimeString()
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" mb={4} color="gray.800">Event Log</Text>
        <Button size="sm" onClick={clearLog} colorScheme="red" variant="outline">
          Clear Log
        </Button>
      </HStack>
      
      <VStack spacing={2} align="stretch">
        {eventLog.length === 0 ? (
          <Text fontSize="sm" color="gray.500">No events yet</Text>
        ) : (
          eventLog.map((entry) => (
            <Box 
              key={entry.id} 
              p={3} 
              borderWidth="1px" 
              borderRadius="md"
              bg={entry.type === 'sent' ? 'blue.50' : 'green.50'}
            >
              <HStack justify="space-between" mb={1}>
                <HStack>
                  <Badge colorScheme={entry.type === 'sent' ? 'blue' : 'green'}>
                    {entry.type}
                  </Badge>
                  <Text fontSize="sm" fontWeight="bold">{entry.eventType}</Text>
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  {formatTimestamp(entry.timestamp)}
                </Text>
              </HStack>
              <Text fontSize="sm">{entry.message}</Text>
              {entry.details && (
                <Box mt={2} p={2} bg="gray.50" borderRadius="sm">
                  <Text fontSize="xs" fontFamily="mono" color="gray.600">
                    {JSON.stringify(entry.details, null, 2)}
                  </Text>
                </Box>
              )}
            </Box>
          ))
        )}
      </VStack>
    </Box>
  )
}