import Block from '@ipld/block/defaults.js'
import bent from 'bent'

const getBuffer = bent('buffer')

const btoa = s => Buffer.from(s).toString('base64')
const hex = b => Buffer.from(b).toString('hex').toLowerCase()

const userAgent = 'mikeal/gitlfs-store/v0.0.0'

const create = (Block, url, user, token) => {
  if (!url.endsWith('.git')) url += '.git'
  url += '/info/lfs/objects/batch'
  const mime = 'application/vnd.git-lfs+json'
  const authorization = 'Basic ' + btoa(user + ':' + token)
  const headers = { accept: mime, 'content-type': mime }

  const { decode } = Block.multiformats.multihash
  const post = bent('POST', 'json', { ...headers, authorization })
  const put = bent('PUT', { 'content-type': 'application/octet-stream' })

  const upload = async blocks => {
    const blockMap = new Map()
    const _map = async block => ([await block.cid(), block.encodeUnsafe().length, block])
    const entries = await Promise.all(blocks.map(_map))
    const objects = entries.map(([cid, size, block]) => {
      const { digest, code } = decode(cid.multihash)
      const oid = hex(digest)
      blockMap.set(oid, block)
      if (code !== 0x12) throw new Error('Can only store SHA2-256 blocks')
      return { oid, size }
    })
    const op =
      {
        operation: 'upload',
        transfers: ['basic'],
        ref: { name: 'refs/heads/master' },
        objects
      }
    const resp = await post(url, op)
    const _put = async object => {
      const block = blockMap.get(object.oid)
      if (!object.actions) return [object, block]
      const { href, header } = object.actions.upload
      const r = await put(href, block.encodeUnsafe(), header)
      if (object.actions.verify) {
        const { href, header } = object.actions.verify
        const headers = { 'content-type': mime, 'user-agent': userAgent, ...header }
        const post = bent('POST')
        const body = { oid: object.oid, size: object.size }
        await post(href, body, headers)
      }
      return [{ ...object, actions: undefined }, block]
    }
    return Promise.all(resp.objects.map(_put))
  }

  const get = async objects => {
    const cidMap = new Map()
    objects.forEach(o => {
      cidMap.set(o.oid, o.cid)
      delete o.cid
    })
    const op =
      {
        operation: 'download',
        transfers: ['basic'],
        ref: { name: 'refs/heads/master' },
        objects
      }
    const resp = await post(url, op)
    const _get = async object => {
      const { href, header } = object.actions.download
      delete object.actions
      const data = await getBuffer(href, null, header)
      return [object, Block.create(data, cidMap.get(object.oid))]
    }
    return Promise.all(resp.objects.map(_get))
  }

  return { upload, get }
}

/*
const url = 'https://github.com/mikeal/test-lfs.git'
const { upload, get } = create(Block, url, 'mikeal', process.env.GHTOKEN)

const run = async () => {
  const block = Block.encoder({hello: 'world', r: Math.random()}, 'dag-cbor')
  const [ [ object ] ] = await upload([block])
  object.cid = await block.cid()
  console.log(await get([object]))
}
run()
*/
