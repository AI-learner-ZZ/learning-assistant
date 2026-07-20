export type ChannelRoute =
  | { kind: 'stream'; id: string }
  | { kind: 'search'; id: string }
  | { kind: 'broadcast'; name: string }

export function routeChannel(channel: string): ChannelRoute {
  const stream = channel.match(/^chat-stream-(.+)$/)
  if (stream) return { kind: 'stream', id: stream[1] }
  const search = channel.match(/^chat-search-(.+)$/)
  if (search) return { kind: 'search', id: search[1] }
  return { kind: 'broadcast', name: channel }
}
