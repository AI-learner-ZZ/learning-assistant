export type Sink = (channel: string, data: unknown) => void

const sinks = new Set<Sink>()

export function addSink(sink: Sink): () => void {
  sinks.add(sink)
  return () => sinks.delete(sink)
}

export function busEmit(channel: string, data: unknown): void {
  for (const sink of sinks) {
    try {
      sink(channel, data)
    } catch {  }
  }
}
