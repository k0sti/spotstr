# Nostr Location-First Event Specification

Specification for generic location-first Nostr events. Location data is defined with standard Nostr tags (with additional `accuracy` tag). Primary location definiton is geohash, so tag `g` must always be defined, all other tags are optional.
Events are addressable ([NIP-01#kinds](https://github.com/nostr-protocol/nips/blob/master/01.md#kinds)) with two event kinds: one for public (`30472`) and one for private (`30473`) location events.

## Public Locations - Kind 30472

```yaml
{
  "kind": 30472,
  "pubkey": "<32-bytes lowercase hex-encoded public key>",
  "created_at": <unix timestamp in seconds>,
  "tags": [
    ["g", "<geohash of the location, required>"],
    ["d", "<identifier, optional>"],
    ["expiration", <unix timestamp as defined in NIP-40, optional>],
    <optional location tags>
  ],
  // no content field
  "sig": "<64-bytes lowercase hex of the signature>"
}
```

## Private (Encrypted) Locations - Kind 30473

Private events must use recipient key for encryption, but it may be omitted from tags to hide the recipient. Location data tags are in content field and encrypted with [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md).

```yaml
{
  "kind": 30473,
  "pubkey": "<32-bytes lowercase hex-encoded public key>",
  "created_at": <unix timestamp in seconds>,
  "tags": [
    ["p", "<32-bytes lowercase hex of recipient pubkey, optional>"],
    ["d", "<identifier, optional>"],
    ["expiration", <unix timestamp as defined in NIP-40, optional>]
  ],
  "content": ENCRYPTED [
    ["g", "<geohash of the location, required>"],
    <optional location tags>
  ],
  "sig": "<64-bytes lowercase hex of the signature>"
}
```

## Optional Location Tags
- `title` - Name of the location, see [NIP-24](https://github.com/nostr-protocol/nips/blob/master/24.md).
- `t` - Location hashtags, see [NIP-24](https://github.com/nostr-protocol/nips/blob/master/24.md).
- `summary`, `image`, `location` - Additional location information as in [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md).
- `accuracy` - Accuracy of the location in meters with 68% confidence (1σ) from the center of the geohash.
