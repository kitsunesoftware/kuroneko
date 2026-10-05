export default defineEventHandler(() => {
  return {
    ok: true as const,
    ts: Date.now(),
  }
})
