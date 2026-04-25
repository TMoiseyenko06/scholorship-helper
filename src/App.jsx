// Gemma 4 26B via OpenRouter — free tier, strong instruction-following performance,
// cost-effective for scholarship analysis and essay outline generation

import { useState, useCallback, useEffect } from 'react'

const SYSTEM_PROMPT = `You are a scholarship advisor helping a specific student evaluate and apply for scholarships.

STUDENT PROFILE:
- Engineering student at Bucks County Community College (BCCC), Newtown, PA
- Background in skilled trades: CNC machining, sign fabrication, large-format printing
- Technical skills: SolidWorks CAD, Python programming, basic electronics, hardware building
- Builds machines and electronic devices independently as a hobby
- First-generation American — parents immigrated to the US for their children's future
- PA resident, eligible for PHEAA state aid
- Bridges physical fabrication with software/digital engineering
- Works full-time in fabrication while pursuing an engineering degree

Strongest application angles:
1. First-generation American / immigrant family narrative
2. Trades-to-engineering pathway
3. Hands-on maker/builder identity with real projects
4. Community college to 4-year engineering transfer
5. STEM + vocational skills combination
6. Pennsylvania state residency`

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL   = 'google/gemma-4-26b-a4b-it'

// Strip <think>...</think> blocks; also removes unclosed <think> tails during streaming
function stripThinkTags(text) {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const idx = cleaned.indexOf('<think>')
  if (idx !== -1) cleaned = cleaned.slice(0, idx)
  return cleaned.trim()
}

async function streamOpenRouter(apiKey, messages, onChunk) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'ScholarshipAssistant',
    },
    body: JSON.stringify({ model: MODEL, stream: true, messages }),
  })
  if (!res.ok) {
    let msg = `API error ${res.status}`
    try { const e = await res.json(); msg = e.error?.message || msg } catch {}
    throw new Error(msg)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const delta  = parsed?.choices?.[0]?.delta?.content || ''
        if (delta) { accumulated += delta; onChunk(accumulated) }
      } catch {}
    }
  }
  return accumulated
}

const C = {
  bg:           '#0d1117',
  card:         '#161b27',
  border:       '#2d3748',
  borderLight:  '#3d4a5c',
  accent:       '#3b82f6',
  accentDim:    'rgba(59,130,246,0.35)',
  text:         '#e2e8f0',
  textMuted:    '#94a3b8',
  textDim:      '#64748b',
  green:        '#22c55e',
  greenBg:      'rgba(34,197,94,0.12)',
  greenBorder:  'rgba(34,197,94,0.3)',
  yellow:       '#eab308',
  yellowBg:     'rgba(234,179,8,0.12)',
  yellowBorder: 'rgba(234,179,8,0.3)',
  red:          '#ef4444',
  redBg:        'rgba(239,68,68,0.12)',
  redBorder:    'rgba(239,68,68,0.3)',
}

function Spinner({ size = 16, color = '#fff' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(255,255,255,0.1)`,
      borderTopColor: color,
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ─── ApiKeyInput ──────────────────────────────────────────────────────────────

function ApiKeyInput({ apiKey, setApiKey }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{ fontSize: 13, color: C.textMuted, whiteSpace: 'nowrap', fontWeight: 500 }}>
        OpenRouter API Key
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-or-..."
          style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '7px 38px 7px 12px', color: C.text, fontSize: 13,
            width: 260, fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        <button
          onClick={() => setShow(s => !s)}
          title={show ? 'Hide key' : 'Show key'}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: C.textDim,
            cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1,
          }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  )
}

// ─── ScoreBadge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const color  = score >= 8 ? C.green  : score >= 6 ? C.yellow  : C.red
  const bg     = score >= 8 ? C.greenBg  : score >= 6 ? C.yellowBg  : C.redBg
  const border = score >= 8 ? C.greenBorder : score >= 6 ? C.yellowBorder : C.redBorder
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
      letterSpacing: '0.02em',
    }}>
      {score}/10
    </span>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, onClick }) {
  const map = {
    'Not Started': { color: C.textMuted, bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
    'In Progress': { color: C.yellow,    bg: C.yellowBg,              border: C.yellowBorder },
    'Submitted':   { color: C.green,     bg: C.greenBg,               border: C.greenBorder },
  }
  const s = map[status] || map['Not Started']
  return (
    <button
      onClick={onClick}
      title="Click to cycle status"
      style={{
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap',
      }}
    >
      {status}
    </button>
  )
}

// ─── ScholarshipCard ─────────────────────────────────────────────────────────

function ScholarshipCard({ scholarship, onGenerateOutline, disabled }) {
  const [reqOpen, setReqOpen] = useState(false)

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 20, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <ScoreBadge score={scholarship.fitScore} />
            {scholarship.source && scholarship.source !== 'Unknown' && (
              <span style={{
                fontSize: 11, color: C.textDim,
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '1px 8px',
              }}>
                {scholarship.source}
              </span>
            )}
          </div>

          {/* Name */}
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
            {scholarship.name}
          </h3>

          {/* Amount + deadline */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{scholarship.amount}</span>
            <span style={{ fontSize: 14, color: C.textMuted }}>Due: {scholarship.deadline}</span>
          </div>

          {/* Fit reason */}
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
            {scholarship.fitReason}
          </p>
        </div>

        {/* Generate outline button */}
        <button
          onClick={() => onGenerateOutline(scholarship)}
          disabled={disabled}
          style={{
            background: disabled ? C.accentDim : C.accent,
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Outfit', sans-serif",
            whiteSpace: 'nowrap', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          {disabled ? <><Spinner size={13} /> Generating…</> : 'Generate Outline'}
        </button>
      </div>

      {/* Requirements accordion */}
      {scholarship.requirements?.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={() => setReqOpen(o => !o)}
            style={{
              background: 'none', border: 'none', color: C.textMuted,
              cursor: 'pointer', fontSize: 13, padding: 0,
              fontFamily: "'Outfit', sans-serif",
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              display: 'inline-block', fontSize: 10,
              transform: reqOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s',
            }}>▶</span>
            Requirements ({scholarship.requirements.length})
          </button>
          {reqOpen && (
            <ul style={{
              margin: '10px 0 0 0', padding: '0 0 0 18px',
              color: C.textMuted, fontSize: 13, lineHeight: 1.85,
            }}>
              {scholarship.requirements.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── OutlineCard ─────────────────────────────────────────────────────────────

const STATUS_CYCLE = { 'Not Started': 'In Progress', 'In Progress': 'Submitted', 'Submitted': 'Not Started' }

function OutlineCard({ outline, onStatusChange, onDelete, onRewrite, onExpandDraft, genLoading }) {
  const [open, setOpen]           = useState(true)
  const [draftOpen, setDraftOpen] = useState(true)

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, marginBottom: 12, overflow: 'hidden',
    }}>
      {/* ── Card header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? `1px solid ${C.border}` : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ color: C.textDim, fontSize: 10 }}>{open ? '▼' : '▶'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 600, fontSize: 15, color: C.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {outline.scholarshipName}
            </div>
            <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
              {outline.scholarshipAmount}
            </div>
          </div>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <StatusBadge
            status={outline.status}
            onClick={() => onStatusChange(outline.id, STATUS_CYCLE[outline.status])}
          />
          <button
            onClick={() => onDelete(outline.id)}
            style={{
              background: 'none', border: `1px solid ${C.border}`,
              color: C.textDim, borderRadius: 6,
              padding: '3px 10px', cursor: 'pointer', fontSize: 12,
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* ── Outline body ── */}
      {open && (
        <>
          <div style={{ padding: '18px 20px 12px', overflowX: 'auto' }}>
            <pre style={{
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13, lineHeight: 1.75, color: C.text,
            }}>
              {outline.outline}
            </pre>
          </div>

          {/* ── Action buttons ── */}
          <div style={{
            display: 'flex', gap: 8, padding: '12px 20px 16px',
            borderTop: `1px solid ${C.border}`,
          }}>
            <button
              onClick={() => onRewrite(outline)}
              disabled={genLoading}
              style={{
                background: 'transparent',
                color: genLoading ? C.textDim : C.textMuted,
                border: `1px solid ${C.border}`,
                borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 500,
                cursor: genLoading ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              ↺ Rewrite Outline
            </button>
            <button
              onClick={() => onExpandDraft(outline)}
              disabled={genLoading}
              style={{
                background: genLoading ? C.accentDim : 'rgba(59,130,246,0.12)',
                color: genLoading ? C.textDim : C.accent,
                border: `1px solid ${genLoading ? C.border : 'rgba(59,130,246,0.35)'}`,
                borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                cursor: genLoading ? 'not-allowed' : 'pointer',
                fontFamily: "'Outfit', sans-serif",
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {genLoading ? <><Spinner size={12} color={C.textDim} /> Working…</> : '✦ Expand to Draft'}
            </button>
          </div>

          {/* ── Saved draft ── */}
          {outline.draft && (
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              <div
                onClick={() => setDraftOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 20px', cursor: 'pointer', userSelect: 'none',
                  background: 'rgba(59,130,246,0.05)',
                }}
              >
                <span style={{ color: C.textDim, fontSize: 10 }}>{draftOpen ? '▼' : '▶'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Full Draft</span>
              </div>
              {draftOpen && (
                <div style={{ padding: '16px 20px 20px' }}>
                  <pre style={{
                    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 13, lineHeight: 1.8, color: C.text,
                  }}>
                    {outline.draft}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [apiKey, setApiKey]               = useState(import.meta.env.VITE_OPENROUTER_KEY || '')
  const [pasteText, setPasteText]         = useState('')
  const [scholarships, setScholarships]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_scholarships') || '[]') } catch { return [] }
  })
  const [sortMode, setSortMode]           = useState('score')
  const [streamPreview, setStreamPreview] = useState('')
  const [analyzing, setAnalyzing]         = useState(false)
  const [analyzeError, setAnalyzeError]   = useState('')
  const [activeTab, setActiveTab]         = useState('analyze')
  const [genLoading, setGenLoading]       = useState(false)
  const [genType, setGenType]             = useState('outline') // 'outline' | 'draft'
  const [outlineStream, setOutlineStream] = useState('')
  const [outlineError, setOutlineError]   = useState('')
  const [activeScholarship, setActiveScholarship] = useState(null)
  const [savedOutlines, setSavedOutlines] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_outlines') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('sa_scholarships', JSON.stringify(scholarships)) }, [scholarships])
  useEffect(() => { localStorage.setItem('sa_outlines',     JSON.stringify(savedOutlines)) }, [savedOutlines])

  const sorted = [...scholarships].sort((a, b) =>
    sortMode === 'score' ? b.fitScore - a.fitScore : a.name.localeCompare(b.name)
  )

  const error     = analyzeError || outlineError
  const clearErrors = () => { setAnalyzeError(''); setOutlineError('') }

  // ── Analyze ────────────────────────────────────────────────────────────────
  const analyzeScholarships = useCallback(async () => {
    if (!apiKey.trim()) { setAnalyzeError('Enter your OpenRouter API key in the header.'); return }
    if (!pasteText.trim()) { setAnalyzeError('Paste some scholarship listings first.'); return }
    setAnalyzing(true); setAnalyzeError(''); setStreamPreview(''); setScholarships([])
    try {
      const prompt =
        'Parse the scholarship listings below. Return ONLY a raw JSON array — no markdown, no code fences, no <think> tags.\n' +
        'Each object must have: { "id": string, "name": string, "amount": string, "deadline": string,\n' +
        '"requirements": string[], "fitScore": number 1-10, "fitReason": string (2-3 sentences), "source": string }\n' +
        'Sort by fitScore descending.\n\n' +
        'Scoring rules — evaluate fit using the FULL student profile, not just the STEM/engineering parts:\n' +
        '- Technical/STEM scholarships: score on engineering, trades, SolidWorks, Python, maker background\n' +
        '- Community/social issue scholarships: score on first-gen American background, immigrant family story, perseverance, community ties — these are strong angles regardless of the scholarship topic\n' +
        '- Need-based or general merit scholarships: score on financial need implied by working full-time while studying at a community college\n' +
        '- Do NOT give a low score just because a scholarship topic (e.g. elder care, law, social justice) is outside the student\'s technical field — ask whether any part of the student\'s background gives them a genuine, personal reason to apply\n' +
        '- A scholarship is only a poor fit if the student is categorically ineligible (e.g. wrong state, wrong major, specific demographic they don\'t belong to)\n\n' +
        'Scholarship listings:\n' + pasteText

      const full = await streamOpenRouter(
        apiKey,
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        chunk => setStreamPreview(stripThinkTags(chunk))
      )
      const cleaned = stripThinkTags(full)
      const match   = cleaned.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array found in response. Try pasting more detailed listing text.')
      const parsed = JSON.parse(match[0])
      if (!Array.isArray(parsed) || parsed.length === 0)
        throw new Error('No scholarships detected in the pasted text.')
      setScholarships(parsed)
    } catch (e) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false); setStreamPreview('')
    }
  }, [apiKey, pasteText])

  // ── Generate outline ───────────────────────────────────────────────────────
  const generateOutline = useCallback(async scholarship => {
    if (!apiKey.trim()) { setOutlineError('Enter your OpenRouter API key in the header.'); return }
    setGenLoading(true); setGenType('outline'); setOutlineError(''); setOutlineStream('')
    setActiveScholarship(scholarship); setActiveTab('outlines')
    try {
      const prompt =
        'Write a brief planning outline for a scholarship essay — ' +
        'the kind of notes a writing coach would hand a student before they start drafting.\n\n' +
        `Scholarship: ${scholarship.name}\n` +
        `What it funds / who it targets: ${scholarship.requirements?.join(', ') || 'Not specified'}\n` +
        `Why this student is a good fit: ${scholarship.fitReason}\n\n` +
        'Guidelines:\n' +
        '- Let what THIS scholarship values drive the structure and emphasis. Different scholarships should produce meaningfully different outlines.\n' +
        '- Each bullet tells the student what to address and what category of experience to draw on — not what to say.\n' +
        '- Keep bullets short and directional (e.g. "open with a moment of transition", "establish the family context that motivates the goal").\n' +
        '- Do not write essay sentences, example lines, or quote the student profile directly.\n' +
        '- 2–4 bullets per section is enough.\n\n' +
        'Sections: Hook / Background / Skills & Experience / Goals / Why This Scholarship'

      const full = await streamOpenRouter(
        apiKey,
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        chunk => setOutlineStream(stripThinkTags(chunk))
      )
      const cleaned = stripThinkTags(full)
      setOutlineStream(cleaned)

      setSavedOutlines(prev => {
        const entry = {
          id:               `${scholarship.id}-${Date.now()}`,
          scholarshipId:    scholarship.id,
          scholarshipName:  scholarship.name,
          scholarshipAmount: scholarship.amount,
          scholarshipData:  scholarship,
          outline:          cleaned,
          draft:            null,
          status:           'Not Started',
        }
        const idx = prev.findIndex(o => o.scholarshipId === scholarship.id)
        if (idx >= 0) {
          const next = [...prev]; next[idx] = { ...next[idx], outline: cleaned, draft: null }; return next
        }
        return [...prev, entry]
      })
    } catch (e) {
      setOutlineError(e.message)
    } finally {
      setGenLoading(false)
    }
  }, [apiKey])

  // ── Rewrite outline (called from OutlineCard) ──────────────────────────────
  const rewriteOutline = useCallback(outline => {
    const scholarship = outline.scholarshipData || {
      id: outline.scholarshipId, name: outline.scholarshipName,
      amount: outline.scholarshipAmount, deadline: 'Unknown',
      requirements: [], fitReason: '',
    }
    generateOutline(scholarship)
  }, [generateOutline])

  // ── Expand to draft ────────────────────────────────────────────────────────
  const generateDraft = useCallback(async outline => {
    if (!apiKey.trim()) { setOutlineError('Enter your OpenRouter API key in the header.'); return }
    setGenLoading(true); setGenType('draft'); setOutlineError(''); setOutlineStream('')
    setActiveScholarship({ name: outline.scholarshipName, amount: outline.scholarshipAmount })
    setActiveTab('outlines')
    try {
      const prompt =
        `Write a full first-person scholarship essay draft based on the outline below.\n\n` +
        `Scholarship: ${outline.scholarshipName}\n` +
        `Amount: ${outline.scholarshipAmount}\n\n` +
        `Outline:\n${outline.outline}\n\n` +
        'Write 4–6 paragraphs. Use the student profile from your system prompt as raw material — ' +
        'weave in relevant experiences naturally where they support the argument. ' +
        'Do not list credentials. Tell a story. ' +
        'Tone: genuine, grounded, and specific to this student — not generic scholarship-essay language.'

      const full = await streamOpenRouter(
        apiKey,
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        chunk => setOutlineStream(stripThinkTags(chunk))
      )
      const cleaned = stripThinkTags(full)
      setOutlineStream(cleaned)
      setSavedOutlines(prev => prev.map(o => o.id === outline.id ? { ...o, draft: cleaned } : o))
    } catch (e) {
      setOutlineError(e.message)
    } finally {
      setGenLoading(false)
    }
  }, [apiKey])

  const updateStatus  = useCallback((id, status) =>
    setSavedOutlines(prev => prev.map(o => o.id === id ? { ...o, status } : o)), [])

  const deleteOutline = useCallback(id =>
    setSavedOutlines(prev => prev.filter(o => o.id !== id)), [])

  const statusCounts = savedOutlines.reduce(
    (acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {}
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,17,23,0.96)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>
            Scholarship Assistant
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: C.textDim, marginTop: 2 }}>
            Gemma 4 · OpenRouter · Built for BCCC Engineering
          </p>
        </div>
        <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />
      </header>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', borderBottom: `1px solid rgba(239,68,68,0.22)`,
          color: C.red, padding: '10px 24px', fontSize: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠ {error}</span>
          <button
            onClick={clearErrors}
            style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>
      )}

      {/* ── Tab nav ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
        {[
          { id: 'analyze',  label: scholarships.length > 0 ? `Analyze (${scholarships.length})` : 'Analyze' },
          { id: 'outlines', label: savedOutlines.length > 0 ? `Outlines (${savedOutlines.length})` : 'Outlines' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              color: activeTab === t.id ? C.text : C.textMuted,
              padding: '12px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

        {/* ════ ANALYZE TAB ════ */}
        {activeTab === 'analyze' && (
          <div>
            <label style={{
              display: 'block', fontSize: 13, color: C.textMuted,
              marginBottom: 8, fontWeight: 500,
            }}>
              Paste raw scholarship listings from Fastweb, Bold.org, ScholarshipOwl, BCCC, or anywhere else.
            </label>

            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste scholarship listings here — names, amounts, deadlines, requirements. Any format works."
              rows={10}
              style={{
                width: '100%',
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                color: C.text, padding: 16, fontSize: 14, lineHeight: 1.65,
                resize: 'vertical', fontFamily: "'Outfit', sans-serif", marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
              <button
                onClick={analyzeScholarships}
                disabled={analyzing}
                style={{
                  background: analyzing ? C.accentDim : C.accent,
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 26px', fontSize: 15, fontWeight: 600,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  display: 'flex', alignItems: 'center', gap: 9,
                }}
              >
                {analyzing ? <><Spinner size={15} /> Analyzing…</> : 'Analyze Scholarships'}
              </button>
              {scholarships.length > 0 && !analyzing && (
                <span style={{ fontSize: 13, color: C.textDim }}>
                  {scholarships.length} scholarships ranked — re-paste to refresh
                </span>
              )}
            </div>

            {/* Live streaming preview */}
            {streamPreview && (
              <div style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: 16, marginBottom: 24,
              }}>
                <div style={{
                  fontSize: 11, color: C.textDim, fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Spinner size={11} color={C.textDim} /> Live preview
                </div>
                <pre style={{
                  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12, lineHeight: 1.6, color: C.textMuted,
                  maxHeight: 280, overflow: 'auto',
                }}>
                  {streamPreview}
                </pre>
              </div>
            )}

            {/* Sort controls + scholarship cards */}
            {scholarships.length > 0 && (
              <>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 14,
                }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    {scholarships.length} Scholarships Ranked
                  </h2>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['score', 'Best Match'], ['alpha', 'A–Z']].map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setSortMode(mode)}
                        style={{
                          background: sortMode === mode ? C.accent : 'transparent',
                          color: sortMode === mode ? '#fff' : C.textMuted,
                          border: `1px solid ${sortMode === mode ? C.accent : C.border}`,
                          borderRadius: 6, padding: '4px 14px', fontSize: 13,
                          cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {sorted.map(s => (
                  <ScholarshipCard
                    key={s.id}
                    scholarship={s}
                    onGenerateOutline={generateOutline}
                    disabled={genLoading}
                  />
                ))}
              </>
            )}

            {/* Empty state */}
            {!analyzing && scholarships.length === 0 && !streamPreview && (
              <div style={{
                textAlign: 'center', padding: '64px 24px',
                border: `1px dashed ${C.border}`, borderRadius: 12, color: C.textDim,
              }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
                  No scholarships analyzed yet
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                  Paste listings from Fastweb, Bold.org, ScholarshipOwl, BCCC, or anywhere<br />
                  then click <strong>Analyze Scholarships</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ OUTLINES TAB ════ */}
        {activeTab === 'outlines' && (
          <div>
            {/* Status count summary */}
            {savedOutlines.length > 0 && (
              <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                {Object.entries(statusCounts).map(([status, count]) => (
                  <span key={status} style={{ fontSize: 13, color: C.textMuted }}>
                    <strong style={{ color: C.text }}>{count}</strong> {status}
                  </span>
                ))}
              </div>
            )}

            {/* Live streaming / completed outline preview panel */}
            {(genLoading || outlineStream) && activeScholarship && (
              <div style={{
                background: C.card,
                border: `1px solid ${genLoading ? C.borderLight : C.border}`,
                borderRadius: 12, marginBottom: 24, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '13px 20px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3,
                      color: genLoading ? C.accent : C.green,
                    }}>
                      {genLoading
                        ? (genType === 'draft' ? 'Expanding to Draft…' : 'Generating Outline…')
                        : (genType === 'draft' ? 'Draft Complete — saved below ↓' : 'Outline Complete — saved below ↓')}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{activeScholarship.name}</div>
                  </div>
                  {genLoading && <Spinner />}
                </div>
                <div style={{ padding: '18px 20px', maxHeight: 520, overflow: 'auto' }}>
                  <pre style={{
                    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 13, lineHeight: 1.75,
                    color: genLoading ? C.textMuted : C.text,
                  }}>
                    {outlineStream || ' '}
                  </pre>
                </div>
              </div>
            )}

            {/* Saved outline cards */}
            {savedOutlines.length > 0
              ? savedOutlines.map(o => (
                  <OutlineCard
                    key={o.id}
                    outline={o}
                    onStatusChange={updateStatus}
                    onDelete={deleteOutline}
                    onRewrite={rewriteOutline}
                    onExpandDraft={generateDraft}
                    genLoading={genLoading}
                  />
                ))
              : !genLoading && (
                  <div style={{
                    textAlign: 'center', padding: '64px 24px',
                    border: `1px dashed ${C.border}`, borderRadius: 12, color: C.textDim,
                  }}>
                    <div style={{ fontSize: 44, marginBottom: 14 }}>✍️</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
                      No outlines saved yet
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                      Analyze scholarships, then click <strong>Generate Outline</strong> on any card
                    </div>
                  </div>
                )
            }
          </div>
        )}

      </main>
    </div>
  )
}
