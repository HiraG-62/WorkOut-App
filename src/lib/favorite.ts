/** お気に入りを一覧の先頭に固定するための並び順キー（0: お気に入り, 1: それ以外） */
export function favRank(x: { favorite?: boolean }): number {
  return x.favorite ? 0 : 1
}

/** お気に入りボタンの aria-label（状態に応じて追加/解除の文言を切り替える） */
export function favoriteLabel(name: string, favorite?: boolean): string {
  return favorite ? `${name} をお気に入りから外す` : `${name} をお気に入りに追加`
}

/** 編集フォームの「お気に入り」Toggle の文言（フード・種目・メニューで共通） */
export const FAVORITE_TOGGLE_LABEL = 'お気に入り'
export const FAVORITE_TOGGLE_DESCRIPTION = '一覧の上位に固定します'
