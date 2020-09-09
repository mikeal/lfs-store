import Block from '@ipld/block/defaults'
import main from '../src/index.js'
import { deepStrictEqual as same } from 'assert'
import { promises as fs } from 'fs'
import tempy from 'tempy'
import getRepo from 'git-remote-origin-url'

const token = process.env.GHTOKEN || process.env.GITHUB_TOKEN

const tmpfile = () => tempy.file({name: 'blockstore.ipld-lfs'})

const getUser = str => {
  str = str.slice(0, str.lastIndexOf('/'))
  return str.slice(str.lastIndexOf('/')+1)
}

const fixture = Block.encoder(Math.random(), 'dag-cbor')

export default async test => {
  const repo = await getRepo()

  const clean = (test, f) => test.cleanup(() => fs.unlink(f))
  const user = process.env.GITHUB_ACTOR || getUser(repo)

  let _resolve
  const exists = new Promise(resolve => { _resolve = resolve })

  test('write twice', async test => {
    const filepath = tmpfile()
    const { put, get, close } = await main(Block, filepath, repo, user, token)
    await put(fixture)
    _resolve()
    await put(fixture)
    const buffer = await fs.readFile(filepath)
    same(buffer.length, 39)

    let block = await get(await fixture.cid())
    same(block.decode(), fixture.decode())
    const reloaded = await main(Block, filepath, repo, user, token)
    block = await reloaded.get(await fixture.cid())
    same(block.decode(), fixture.decode())
    await close()
  })

  test('write twice no local', async test => {
    await exists
    const filepath = tmpfile()
    const { put, get, close } = await main(Block, filepath, repo, user, token)
    await put(fixture)

    const buffer = await fs.readFile(filepath)
    same(buffer.length, 39)
    await close()
  })
}
