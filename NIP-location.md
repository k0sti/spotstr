NIP-location
======

Encrypted Location Sharing
--------------------------

`draft` `optional`

This NIP defines an addressable event type for sharing geographic location information in an encrypted format.

Motivation for the specification is to have a simple but generic and extensible way to share location data. Geohash is used as the base unit for location because of its simplicity and good Nostr adoption. An optional accuracy field is added to indicate the confidence radius of the shared location, in cases where the length of the geohash is not sufficient.
Additional metadata can be added in public tags or in encrypted tags inside the content field.
The event is suitable for sharing fixed locations or continuous/real-time location updates.
The combination of sender pubkeys (known or ephemeral), receiver pubkeys (known or ephemeral), and the optional p-tag enables different privacy models ranging from direct peer-to-peer sharing to anonymous broadcasts.

## Event format

Location sharing uses addressable event of `kind:30473`, which has the following format:

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
  "content": "<encrypted-location>",
  "sig": "<64-bytes lowercase hex of the signature>"
}
```

### Tags

- The `d` tag, used as an identifier:
  - `["d", ""] or omitted` for a single location per pubkey
  - `["d", "<name>"]` for a named location (e.g., "home", "office")

- The `p` tag, used to specify the recipient:
  - **When present**: direct message to specified pubkey
  - **When omitted**: anonymous recipient message, receivers must attempt decryption

### Content

The `content` field contains encrypted location data structured as a JSON array of tags:

```json
[
  ["g", "<geohash>"],
  ["accuracy", "<optional, accuracy radius in meters at 68% confidence level>"],
  // ...
]
```

The `g` tag is required and contains a geohash string representing the location. Geohash format is same as 'g' tag in [NIP-52](52.md).
Accuracy tag is optional and defines accuracy of the location in meters with 68% confidence (1σ) from the center of the geohash. This means there is approximately 68% probability that the true location lies within this radius from the center.
Array may contain other tags. All tags except `g` are optional. This JSON array MUST be encrypted as a string using [NIP-44](44.md) encryption.

## Example use cases

### Single location sharing

Share current location with a specific user:

```json
{
  "kind": 30473,
  "pubkey": "<sender pubkey>",
  "tags": [
    ["p", "<recipient pubkey>"],
    ["d", ""],
    ["expiration", "1735689600"]
  ],
  "content": "<encrypted location array>"
}
```

### Named location sharing with a group

Share a named location with a group.
Group key is generated and shared out-of-band with recipients.

```json
{
  "kind": 30473,
  "pubkey": "<sender-pubkey>",
  "tags": [
    ["p", "<group-pubkey>"],
    ["d", "home"]
  ],
  "content": "<location array, encrypted with group key>"
}
```

### Anonymous location sharing

Share location with ephemeral pubkey without revealing recipient.
Sender pubkey is shared out-of-band with recipient.

```json
{
  "kind": 30473,
  "pubkey": "<ephemeral pubkey>",
  "tags": [
    ["expiration", "1735689600"]
  ],
  "content": "<location array, encrypted with recipient key>"
}
```
