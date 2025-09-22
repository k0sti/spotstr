# Spotstr

A privacy-focused location sharing application built on the Nostr protocol, enabling secure and encrypted location sharing between users.

## Overview

Spotstr allows users to share their location with specific individuals or groups using end-to-end encryption. Built on Nostr's decentralized architecture, it ensures privacy and user control over their location data without relying on centralized servers.

### Key Features

- **Encrypted Location Sharing**: Share locations privately with specific users using NIP-44 encryption
- **Addressable Events**: Efficient location updates using replaceable events (no location history clutter)
- **Multiple Identities**: Manage multiple Nostr identities for different sharing contexts
- **Real-time Updates**: Subscribe to location events from connected relays
- **Interactive Map**: Visual representation of shared locations using Leaflet
- **Privacy-First**: Locations are encrypted and only accessible to intended recipients

## Location Event Specification

Location events use [location-first Nostr event specification](https://github.com/k0sti/nostr-location.git).
Currently only encrypted `kind:30473` events are supported.

## Installation

```bash
# Clone the repository
git clone https://github.com/k0sti/spotstr.git
cd spotstr

# Install dependencies
bun install

# Start development server
bun run dev
```

## Development

```bash
# Development server
bun run dev

# Build for production
bun run build

# Run tests
bun test

# Preview production build
bun run preview
```

## Contributing

Contributions are welcome! The project is in active development, particularly around:
- Improving the NIP-location specification
- Enhancing the user interface
- Supporting additional location sharing patterns

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Security Considerations

- Location data is sensitive - always verify recipient identities
- Use ephemeral keys for anonymous sharing
- Consider using time-limited sharing with expiration tags
- Be mindful of geohash precision levels for privacy

## Links

- [NIP-location Specification](https://github.com/k0sti/nostr-location/blob/main/NIP-location.md)
- [Nostr Protocol](https://nostr.com/)
- [NIPs Repository](https://github.com/nostr-protocol/nips)