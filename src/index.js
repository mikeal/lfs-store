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
  const { CID } = Block
  const { decode } = Block.multiformats.multihash
  const { upload, download } = createLFS(Block, url, user, token)
  const fd = await fs.open(filepath, 'a+')
  const stored = new Map()
  const load = async () => {
    const fileSize = (await fd.stat()).size
    let offset = 0
    let readLength = 39
    while (offset < fileSize) {
      let buffer = Buffer.alloc(readLength)
      await fd.read(buffer, 0, readLength, offset)
      let header = 0
      const [ version, l0 ] = varint.decode(buffer)
      if (version !== 0) throw new Error('Unsupported version')
      header += l0
      buffer = buffer.subarray(l0)
      const [ size, l1 ] = varint.decode(buffer)
      header += l1
      buffer = buffer.subarray(l1)
      const [ cidSize, l2 ] = varint.decode(buffer)
      header += l2
      if (cidSize > (readLength - header)) {
        readLength = cidSize + header
        buffer = Buffer.alloc(cidSize)
        await fd.read(buffer, 0, cidSize, offset + header)
      } else {
        buffer = buffer.subarray(l2, l2+cidSize)
      }
      const cid = CID.from(buffer)
      stored.set(cid.toString(), { size })
      offset += header + cidSize
    }
  }
  const loading = load()
  const put = async block => {
    const cid = await block.cid()
    const [code] = varint.decode(cid.multihash)
    if (code !== 0x12) throw new Error('Can only store SHA2-256 blocks')

    const key = cid.toString()
    await loading
    if (stored.has(key)) return
    stored.set(key, { size: block.encode().byteLength })

    const [[object]] = await upload([block])
    const b = cid.bytes
    const encoded = [0, object.size, b.byteLength].map(i => varint.encode(i))
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
  const close = () => fd.close()
  return { put, get, close }
}

export default create
