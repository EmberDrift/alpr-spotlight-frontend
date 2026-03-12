# alpr-spotlight-frontend

![ALPR Spotlight Banner](ALPR_Spotlight_Banner.png)

# ALPR Spotlight

A free, open source public records request tool for automated license plate reader (ALPR) surveillance cameras. Search for law enforcement agencies near any location and generate pre-written public records request emails to send directly from your own email client.

## What It Does

- Searches OpenStreetMap data to find law enforcement agencies within a chosen radius of any location
- Automatically looks up public records contact emails for each agency
- Generates formal public records request letters for surveillance camera data including locations, policies, contracts, audit logs, and more
- Opens pre-populated emails directly in your email client -- no data passes through this tool
- Includes a reference guide to open records laws for all 50 states and Washington D.C.

## Privacy

Your name, email, and request content never touch our servers. Location coordinates are sent to a backend service only to identify nearby agencies and are not stored or logged. All email sending happens through your own email client via mailto links.

## Tech Stack

- React + Vite (frontend)
- Cloudflare Pages (hosting)
- Cloudflare Workers (backend agency lookup)
- OpenStreetMap Overpass API (agency data)
- Leaflet.js (map)

## License

MIT -- see [LICENSE] for details.

## Donations

This tool is free to use. If you find it useful, donations are appreciated.

- Bitcoin: bc1qzj27j2yq8dpgv3pj7thgcwxgs5f2mjaqjacc8l
- Ethereum: 0xc45c48d93904468Ad5D0787Af1DDA2dC85539bBC
- Monero: 48kVUoyUjFhFAvhFS6xz9Td7Fv32Tshqf4YYKybKHNrqKsEuo2viVZFU1nmdpSybHzLjXu1NVTzNwemNVdxoj2CR5rhri5Q
- Ko-fi: https://ko-fi.com/emberdrift
