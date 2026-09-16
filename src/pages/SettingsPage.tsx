import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, Download, Eye, EyeOff, Sparkles, Trash2, Upload } from 'lucide-react'
import { db } from '../db/db'
import { getLatestWeight, updateSettings } from '../db/repo'
import { calcTargets } from '../lib/nutrition'
import { createAiClient, AiError, isAiConfigured } from '../lib/ai'
import { exportBackup, importBackup, saveTextFile } from '../lib/backup'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, Section } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Segmented, SelectField, TextField } from '../components/ui/Field'
import { Stepper } from '../components/ui/Stepper'
import { Toggle } from '../components/ui/Toggle'
import { Sheet } from '../components/ui/Sheet'
import { useToast } from '../components/ui/Toast'
import {
  ACTIVITY_LEVELS,
  AI_PROVIDERS,
  GOALS,
  SEX,
  type ActivityLevel,
  type AiConfig,
  type AiProvider,
  type Goal,
  type Profile,
  type Settings,
  type Sex,
  type TargetSuggestion,
  type Targets,
} from '../types'
import './SettingsPage.css'

const REST_STEP = 5
const REST_MIN = 10
const REST_MAX = 600
const KCAL_STEP = 50
const KCAL_MIN = 800
const KCAL_MAX = 6000
const G_STEP = 5
const PROTEIN_MAX = 400
const FAT_MAX = 300
const CARBS_MAX = 800
const SAVE_DEBOUNCE_MS = 400
const FALLBACK_WEIGHT_KG = 60
const VIBRATION_SUPPORTED = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

export function SettingsPage() {
  const settings = useLiveQuery(async () => (await db.settings.get('app')) ?? null, [])
  const [formKey, setFormKey] = useState(0)
  const remountPending = useRef(false)

  // 復元後は liveQuery が新しい設定を出してから key でフォームを作り直す（古い値で初期化しないため）
  useEffect(() => {
    if (!remountPending.current || !settings) return
    remountPending.current = false
    setFormKey((k) => k + 1)
  }, [settings])

  if (!settings) {
    return (
      <div className="page st" aria-busy="true">
        <div className="skeleton skeleton--header" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
    )
  }
  return (
    <SettingsForm
      key={formKey}
      initial={settings}
      onImported={() => {
        remountPending.current = true
      }}
    />
  )
}

interface SettingsFormProps {
  initial: Settings
  onImported: () => void
}

function SettingsForm({ initial, onImported }: SettingsFormProps) {
  const toast = useToast()
  const latestWeight = useLiveQuery(async () => (await getLatestWeight()) ?? null, [])
  const [profile, setProfile] = useState<Profile>(initial.profile)
  const [targets, setTargets] = useState<Targets>(initial.targets)
  const [ai, setAi] = useState<AiConfig>(initial.ai)
  const [showKey, setShowKey] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [suggestion, setSuggestion] = useState<TargetSuggestion | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // 変更を自動保存（初期値と同じ内容なら書かない）
  useEffect(() => {
    const unchanged =
      JSON.stringify(profile) === JSON.stringify(initial.profile) &&
      JSON.stringify(targets) === JSON.stringify(initial.targets) &&
      JSON.stringify(ai) === JSON.stringify(initial.ai)
    if (unchanged) return
    const id = window.setTimeout(() => {
      void updateSettings({ profile, targets, ai, onboarded: true })
    }, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [profile, targets, ai, initial])

  const weightKg = latestWeight?.kg ?? FALLBACK_WEIGHT_KG
  const aiReady = isAiConfigured(ai)

  const autoCalc = () => {
    setTargets(calcTargets(profile, weightKg))
    toast.show('体重・プロフィールから目標を計算しました', 'success')
  }

  const askAi = async () => {
    const client = await createAiClient(ai)
    if (!client) {
      toast.show('AI の API キーを設定してください', 'error')
      return
    }
    setAiBusy(true)
    try {
      setSuggestion(await client.suggestTargets({ profile, weightKg, currentTargets: targets }))
    } catch (e) {
      toast.show(e instanceof AiError ? e.message : 'AI の呼び出しに失敗しました', 'error')
    } finally {
      setAiBusy(false)
    }
  }

  const applySuggestion = () => {
    if (!suggestion) return
    setTargets({
      kcal: Math.round(suggestion.kcal),
      protein: Math.round(suggestion.protein),
      fat: Math.round(suggestion.fat),
      carbs: Math.round(suggestion.carbs),
    })
    setSuggestion(null)
    toast.show('目標に反映しました', 'success')
  }

  const doExport = async () => {
    await saveTextFile(`workout-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup())
  }

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { settingsRestored } = await importBackup(await file.text())
      toast.show('復元しました', 'success')
      if (settingsRestored) onImported()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '復元に失敗しました', 'error')
    }
  }

  const resetAll = async () => {
    await db.delete()
    window.location.reload()
  }

  const provider = ai.provider
  const setKey = (v: string) => setAi((s) => ({ ...s, keys: { ...s.keys, [provider]: v } }))
  const setModel = (v: string) => setAi((s) => ({ ...s, models: { ...s.models, [provider]: v } }))
  const toNumber = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0)

  return (
    <div className="page st">
      <PageHeader title="設定" back />

      <Section title="プロフィール">
        <Card className="stack">
          <div className="field">
            <span className="field__label">性別</span>
            <Segmented value={profile.sex} onChange={(sex: Sex) => setProfile({ ...profile, sex })} options={(Object.keys(SEX) as Sex[]).map((k) => ({ value: k, label: SEX[k] }))} label="性別" />
          </div>
          <div className="st__two">
            <TextField label="年齢" type="number" inputMode="numeric" value={profile.age || ''} onChange={(e) => setProfile({ ...profile, age: toNumber(e.target.value) })} suffix="歳" />
            <TextField label="身長" type="number" inputMode="decimal" value={profile.heightCm || ''} onChange={(e) => setProfile({ ...profile, heightCm: toNumber(e.target.value) })} suffix="cm" />
          </div>
          <SelectField label="活動量" value={profile.activity} onChange={(e) => setProfile({ ...profile, activity: e.target.value as ActivityLevel })} options={(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LEVELS[k].label }))} />
          <div className="field">
            <span className="field__label">目的</span>
            <Segmented value={profile.goal} onChange={(goal: Goal) => setProfile({ ...profile, goal })} options={(Object.keys(GOALS) as Goal[]).map((k) => ({ value: k, label: GOALS[k].label }))} label="目的" />
          </div>
          <p className="faint st__note">
            {latestWeight ? `体重は「記録」タブの値（${weightKg.toFixed(1)}kg）を使います` : `体重が未記録のため ${FALLBACK_WEIGHT_KG}kg で計算します。ホームで体重を入れると精度が上がります`}
          </p>
        </Card>
      </Section>

      <Section title="1日の目標">
        <Card className="stack">
          <div className="row st__calc">
            <Button block icon={<Calculator size={18} aria-hidden />} onClick={autoCalc}>
              自動計算
            </Button>
            <Button block variant="accent-soft" icon={<Sparkles size={18} aria-hidden />} onClick={() => void askAi()} loading={aiBusy} disabled={!aiReady}>
              AIに相談
            </Button>
          </div>
          {!aiReady && <p className="faint st__note">AI の API キーを設定すると「AIに相談」が使えます</p>}
          <div className="st__targets">
            <Stepper label="カロリー" value={targets.kcal} onChange={(kcal) => setTargets({ ...targets, kcal })} step={KCAL_STEP} min={KCAL_MIN} max={KCAL_MAX} unit="kcal" />
            <Stepper label="タンパク質" value={targets.protein} onChange={(protein) => setTargets({ ...targets, protein })} step={G_STEP} min={0} max={PROTEIN_MAX} unit="g" />
            <Stepper label="脂質" value={targets.fat} onChange={(fat) => setTargets({ ...targets, fat })} step={G_STEP} min={0} max={FAT_MAX} unit="g" />
            <Stepper label="炭水化物" value={targets.carbs} onChange={(carbs) => setTargets({ ...targets, carbs })} step={G_STEP} min={0} max={CARBS_MAX} unit="g" />
          </div>
        </Card>
      </Section>

      <Section title="休憩タイマー">
        <Card className="stack">
          <Stepper label="セット間の休憩" value={initial.defaultRestSec} onChange={(defaultRestSec) => void updateSettings({ defaultRestSec })} step={REST_STEP} min={REST_MIN} max={REST_MAX} unit="秒" />
          <Toggle checked={initial.sound} onChange={(sound) => void updateSettings({ sound })} label="終了音" description="残り3秒からカウントダウン音も鳴ります" />
          {VIBRATION_SUPPORTED && <Toggle checked={initial.vibration} onChange={(vibration) => void updateSettings({ vibration })} label="バイブレーション" />}
        </Card>
      </Section>

      <Section title="AI">
        <Card className="stack">
          <p className="muted st__note">写真からの推定と目標の相談に使います。キーは端末内にだけ保存され、バックアップにも含まれません。</p>
          <div className="field">
            <span className="field__label">プロバイダ</span>
            <Segmented value={provider} onChange={(p: AiProvider) => setAi({ ...ai, provider: p })} options={(Object.keys(AI_PROVIDERS) as AiProvider[]).map((k) => ({ value: k, label: AI_PROVIDERS[k].label }))} label="AIプロバイダ" />
          </div>
          <div className="st__key">
            <TextField label={`${AI_PROVIDERS[provider].vendor} API キー`} type={showKey ? 'text' : 'password'} value={ai.keys[provider]} onChange={(e) => setKey(e.target.value)} placeholder="未設定" autoComplete="off" autoCapitalize="off" spellCheck={false} />
            <button type="button" className="st__eye" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'キーを隠す' : 'キーを表示'}>
              {showKey ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
          <TextField label="モデル" value={ai.models[provider]} onChange={(e) => setModel(e.target.value)} hint={`空欄なら既定値 ${AI_PROVIDERS[provider].defaultModel}`} placeholder={AI_PROVIDERS[provider].defaultModel} autoCapitalize="off" spellCheck={false} />
        </Card>
      </Section>

      <Section title="データ">
        <Card className="stack">
          <Button block icon={<Download size={18} aria-hidden />} onClick={() => void doExport()}>
            バックアップを書き出す
          </Button>
          <Button block icon={<Upload size={18} aria-hidden />} onClick={() => fileRef.current?.click()}>
            バックアップから復元
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="sr-only" onChange={(e) => void doImport(e)} aria-label="バックアップファイル" />
          <Button block variant="danger" icon={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmReset(true)}>
            すべてのデータを削除
          </Button>
        </Card>
      </Section>

      <Sheet
        open={suggestion !== null}
        onClose={() => setSuggestion(null)}
        title="AIの提案"
        footer={
          <div className="row">
            <Button block onClick={() => setSuggestion(null)}>
              やめる
            </Button>
            <Button block variant="primary" onClick={applySuggestion}>
              この値にする
            </Button>
          </div>
        }
      >
        {suggestion && (
          <div className="stack">
            <div className="st__suggest">
              <span>
                <span className="display st__suggest-num" style={{ color: 'var(--kcal)' }}>{Math.round(suggestion.kcal)}</span>kcal
              </span>
              <span>
                <span className="display st__suggest-num" style={{ color: 'var(--protein)' }}>{Math.round(suggestion.protein)}</span>P
              </span>
              <span>
                <span className="display st__suggest-num" style={{ color: 'var(--fat)' }}>{Math.round(suggestion.fat)}</span>F
              </span>
              <span>
                <span className="display st__suggest-num" style={{ color: 'var(--carbs)' }}>{Math.round(suggestion.carbs)}</span>C
              </span>
            </div>
            <p className="st__rationale">{suggestion.rationale}</p>
          </div>
        )}
      </Sheet>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="すべて削除"
        footer={
          <div className="row">
            <Button block onClick={() => setConfirmReset(false)}>
              やめる
            </Button>
            <Button block variant="danger" onClick={() => void resetAll()}>
              削除する
            </Button>
          </div>
        }
      >
        <p className="muted">トレーニング・食事・体重・設定のすべてが消えます。先にバックアップを書き出すことをおすすめします。</p>
      </Sheet>
    </div>
  )
}
