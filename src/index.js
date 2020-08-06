import createLFS from './lfs.js'
import { promises as fs } from 'fs'

const create = (Block, filepath, url, user, token) => {
  const { upload, download } = createLFS(Block, url, user, token)
  const fd = await fs.open(filepath, 'a+')
  const stored = new Set()
  const append = async object => {
    console.log(object)
  }
  const load = async () => {
  }
  const loading = load()
  const put = async block => {
    const [ result ] = await upload([block])
  }
  const get = cid => {
  }
}
