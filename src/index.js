import createLFS from './lfs.js'
import { promises as fs } from 'fs'
import varints from 'varint'

const cache = new Map()
const varint = {
  decode: data => {
    const code = varints.decode(data)
    return [code, varints.decode.bytes]
  },
  encode: int => {
    if (cache.has(int)) return cache.get(int)
    const buff = Uint8Array.from(varints.encode(int))
    cache.set(int, buff)
    return buff
  }
}

const create = async (Block, filepath, url, user, token) => {
  const { decode } = Block.multiformats.multihash
  const { upload, download } = createLFS(Block, url, user, token)
  const fd = await fs.open(filepath, 'a+')
  const stored = new Map()
  const load = async () => {
  }
  const loading = load()
  const put = async block => {
    const cid = await block.cid()
    const [code] = varint.decode(cid.multihash)
    if (code !== 0x12) throw new Error('Can only store SHA2-256 blocks')

    const key = cid.toString()
    await loading
    if (stored.has(key)) return
    stored.set(key, { size: block.encode().length })

    const [[object]] = await upload([block])
    const b = cid.buffer
    const encoded = [0, object.size, b.length].map(i => varint.encode(i))
    const part = Buffer.concat([...encoded, b])
    await fd.write(part)
  }
  const get = async cid => {
    const { code, digest } = decode(cid.multihash)
    if (code !== 0x12) throw new Error('Can only store SHA2-256 blocks')

    await loading
    const key = cid.toString()
    const { size } = stored.get(key)
    if (!size) throw new Error(`No such CID: ${key}`)
    const [[, block]] = await download([{ cid, size }])
    return block
  }
  return { put, get }
}

export default create
