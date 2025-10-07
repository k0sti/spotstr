import { BehaviorSubject, Subscription } from 'rxjs'
import { LocationService } from './locationService'
import { generateGeohash } from '../utils/crypto'
import { getRelayService } from './relayService'

export interface ContinuousSharingState {
  isSharing: boolean
  senderPubkey: string | null
  receiverId: string | null  // 'group:id' or 'contact:id'
  currentGeohash: string | null
  lastSentGeohash: string | null
  watchId: string | null
  intervalId: number | null
  eventCount: number
}

class ContinuousSharingService {
  public state$ = new BehaviorSubject<ContinuousSharingState>({
    isSharing: false,
    senderPubkey: null,
    receiverId: null,
    currentGeohash: null,
    lastSentGeohash: null,
    watchId: null,
    intervalId: null,
    eventCount: 0
  })

  private onGeohashChange: ((geohash: string) => Promise<void>) | null = null
  private onStopSharing: (() => void) | null = null
  private relaySubscription: Subscription | null = null
  private locationCallback: ((position: any) => Promise<void>) | null = null

  getState() {
    return this.state$.asObservable()
  }

  getCurrentState() {
    return this.state$.value
  }

  async startContinuousSharing(
    senderPubkey: string,
    receiverId: string,
    onGeohashChange: (geohash: string) => Promise<void>,
    onStopSharing: () => void
  ) {
    // Stop any existing sharing first
    await this.stopContinuousSharing()

    this.onGeohashChange = onGeohashChange
    this.onStopSharing = onStopSharing

    console.log('[ContinuousSharingService] Starting continuous location sharing...')

    // Create and store location callback
    this.locationCallback = async (position) => {
      if (!position) {
        console.error('[ContinuousSharingService] Failed to get position')
        return
      }
      const geohash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)

      const currentState = this.state$.value

      // Update current geohash
      this.state$.next({
        ...currentState,
        currentGeohash: geohash
      })

      // Send location if geohash changed
      if (geohash !== currentState.lastSentGeohash) {
        console.log('[ContinuousSharingService] Geohash changed:', geohash)

        try {
          await this.onGeohashChange?.(geohash)

          // Update state after successful send
          this.state$.next({
            ...this.state$.value,
            lastSentGeohash: geohash,
            eventCount: this.state$.value.eventCount + 1
          })
        } catch (error) {
          console.error('[ContinuousSharingService] Failed to send location:', error)
        }
      }
    }

    // Start watching position
    await LocationService.startWatching(this.locationCallback)

    // Get initial position
    const initialPosition = await LocationService.getCurrentPosition()
    if (initialPosition) {
      const geohash = generateGeohash(initialPosition.coords.latitude, initialPosition.coords.longitude, 8)

      this.state$.next({
        ...this.state$.value,
        currentGeohash: geohash
      })

      // Send initial location
      try {
        await this.onGeohashChange?.(geohash)
        this.state$.next({
          ...this.state$.value,
          lastSentGeohash: geohash,
          eventCount: 1
        })
      } catch (error) {
        console.error('[ContinuousSharingService] Failed to send initial location:', error)
      }
    } else {
      console.error('[ContinuousSharingService] Failed to get initial location')
    }

    // Also set up periodic sending (every 30 seconds) in case geohash doesn't change
    const intervalId = window.setInterval(async () => {
      const currentState = this.state$.value
      if (currentState.currentGeohash && currentState.isSharing) {
        try {
          await this.onGeohashChange?.(currentState.currentGeohash)
          this.state$.next({
            ...currentState,
            lastSentGeohash: currentState.currentGeohash,
            eventCount: currentState.eventCount + 1
          })
        } catch (error) {
          console.error('[ContinuousSharingService] Failed to send periodic location:', error)
        }
      }
    }, 1000)

    // Monitor relay connections and stop sharing if location relays disconnect
    const relayService = getRelayService()
    this.relaySubscription = relayService.relayStatus$.subscribe(() => {
      const connectedLocationRelays = relayService.getConnectedRelays('location')
      if (connectedLocationRelays.length === 0 && this.state$.value.isSharing) {
        console.log('[ContinuousSharingService] No location relays connected, stopping sharing')
        this.stopContinuousSharing()
      }
    })

    // Update state
    this.state$.next({
      isSharing: true,
      senderPubkey,
      receiverId,
      currentGeohash: null,
      lastSentGeohash: null,
      watchId: 'watching',
      intervalId,
      eventCount: 0
    })

    return true
  }

  async stopContinuousSharing() {
    const currentState = this.state$.value

    if (currentState.watchId !== null && this.locationCallback) {
      await LocationService.stopWatching(this.locationCallback)
      this.locationCallback = null
    }

    if (currentState.intervalId !== null) {
      window.clearInterval(currentState.intervalId)
    }

    // Unsubscribe from relay monitoring
    if (this.relaySubscription) {
      this.relaySubscription.unsubscribe()
      this.relaySubscription = null
    }

    // Reset state
    this.state$.next({
      isSharing: false,
      senderPubkey: null,
      receiverId: null,
      currentGeohash: null,
      lastSentGeohash: null,
      watchId: null,
      intervalId: null,
      eventCount: 0
    })

    // Call stop callback
    this.onStopSharing?.()
    this.onGeohashChange = null
    this.onStopSharing = null
    this.locationCallback = null
  }

  resetEventCount() {
    this.state$.next({
      ...this.state$.value,
      eventCount: 0
    })
  }
}

export const continuousSharingService = new ContinuousSharingService()