import Block from '@ipld/block/defaults.js'
import create from './src/index.js'
const url = 'https://github.com/mikeal/test-lfs.git'
const filepath = './blockstore.ipld-lfs'

const run = async () => {
  const { get, put } = await create(Block, filepath, url, 'mikeal', process.env.GHTOKEN)
  const block = Block.encoder({ hello: 'world', r: Math.random() }, 'dag-cbor')
  await put(block)
  const cid = await block.cid()
  console.log(await get(cid))
}
run()
