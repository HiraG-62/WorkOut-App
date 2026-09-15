import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '../db/db'
import type { Settings } from '../types'

/** 設定をリアクティブに購読する。読み込み前はデフォルト値を返す */
export function useSettings(): Settings {
  const settings = useLiveQuery(() => db.settings.get('app'), [])
  return settings ?? DEFAULT_SETTINGS
}
