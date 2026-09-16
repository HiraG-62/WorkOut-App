import { useCallback, useRef } from 'react'

/**
 * OS の写真選択（カメラ / ライブラリ）をボタン1タップで開くための隠しファイル入力。
 * シートを開いてから input.click() すると iOS/Android ではユーザー操作外として無視されるため、
 * ボタンの onClick で同期的に click() し、選ばれてからシートを開く。
 */
export interface PhotoPicker {
  /** input 要素に渡すコールバック ref */
  attach: (el: HTMLInputElement | null) => void
  open: () => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function usePhotoPicker(onPick: (file: File) => void): PhotoPicker {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const attach = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el
  }, [])
  const open = useCallback(() => inputRef.current?.click(), [])
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) onPick(file)
    },
    [onPick],
  )
  return { attach, open, onChange }
}

interface PhotoPickersProps {
  photo?: PhotoPicker
  label?: PhotoPicker
}

export function PhotoPickers({ photo, label }: PhotoPickersProps) {
  return (
    <>
      {photo && <input ref={photo.attach} type="file" accept="image/*" className="sr-only" onChange={photo.onChange} aria-label="食事の写真を選ぶ" tabIndex={-1} />}
      {label && <input ref={label.attach} type="file" accept="image/*" className="sr-only" onChange={label.onChange} aria-label="成分表・原材料の写真を選ぶ" tabIndex={-1} />}
    </>
  )
}
