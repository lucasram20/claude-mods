// Entry point for the detached background refresh spawned by quote.ts.
import { refreshQuote } from './quote.ts'

await refreshQuote()
