// v2.2 premium renderer loader — source is stored gzip-compressed to keep the Pages commit compact.
const sourceUrl=new URL('./v22-art.js.gz?v=2.2.0',import.meta.url)
const response=await fetch(sourceUrl)
if(!response.ok)throw new Error(`Abyssal v2.2 renderer payload failed: ${response.status}`)
if(typeof DecompressionStream!=='function')throw new Error('Abyssal v2.2 requires a browser with DecompressionStream support')
const stream=response.body.pipeThrough(new DecompressionStream('gzip'))
const source=await new Response(stream).text()
;(0,eval)(`${source}\n//# sourceURL=v22-art.runtime.js`)
if(!window.__abyssalV22)throw new Error('Abyssal v2.2 renderer did not initialize')
