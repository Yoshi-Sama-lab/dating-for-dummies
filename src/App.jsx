import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import bookContent from './book.md?raw'

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEY_PAGE      = 'dfd_page'
const KEY_BOOKMARKS = 'dfd_bookmarks'
const KEY_FONTSIZE  = 'dfd_fontsize'

// ─── Parse markdown into pages ────────────────────────────────────────────────
function parsePages(raw) {
  const PAGE_BREAK = /^\{(\d+)\}-{3,}$/
  const pages = []
  let currentPageNum = 0
  let buffer = []

  const flush = (num) => {
    const content = buffer
      .filter(line => !/^#+\s+\d+\s*$/.test(line.trim()))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (content) pages.push({ num, content })
    buffer = []
  }

  for (const line of raw.split('\n')) {
    const m = line.trim().match(PAGE_BREAK)
    if (m) { flush(currentPageNum); currentPageNum = parseInt(m[1], 10) }
    else buffer.push(line)
  }
  flush(currentPageNum)
  return pages
}

// ─── Extract first heading from page content ─────────────────────────────────
function extractHeading(content) {
  const m = content.match(/^#{1,3}\s+\*?\*?(.+?)\*?\*?$/m)
  if (!m) return null
  return m[1].replace(/[*_`]/g, '').trim()
}

// ─── Build table of contents from all pages ───────────────────────────────────
function buildTOC(pages) {
  const entries = []
  for (const page of pages) {
    const m = page.content.match(/^(#{1,2})\s+\*?\*?(.+?)\*?\*?$/m)
    if (m) {
      entries.push({
        pageNum: page.num,
        level: m[1].length,
        title: m[2].replace(/[*_`]/g, '').trim()
      })
    }
  }
  return entries
}

// ─── Word count → reading estimate ───────────────────────────────────────────
function readingTime(content) {
  const words = content.trim().split(/\s+/).length
  const mins = Math.ceil(words / 220)
  return mins <= 1 ? '< 1 min' : `${mins} min`
}

// ─── Callout detection ────────────────────────────────────────────────────────
const CALLOUT_MAP = {
  remember: { icon: '📌', label: 'Remember', cls: 'callout--remember' },
  note:     { icon: '📝', label: 'Note',     cls: 'callout--note'     },
  tip:      { icon: '💡', label: 'Tip',      cls: 'callout--tip'      },
  warning:  { icon: '⚠️', label: 'Warning',  cls: 'callout--warning'  },
  caution:  { icon: '⚠️', label: 'Caution',  cls: 'callout--warning'  },
}

function Paragraph({ children, node }) {
  const firstChild = node?.children?.[0]
  if (firstChild?.type === 'element' && firstChild.tagName === 'strong') {
    const text = (firstChild.children?.[0]?.value ?? '').replace(/:$/, '').trim().toLowerCase()
    const match = CALLOUT_MAP[text]
    if (match) {
      return (
        <aside className={`callout ${match.cls}`}>
          <span className="callout__badge">
            <span className="callout__icon" aria-hidden="true">{match.icon}</span>
            {match.label}
          </span>
          <div className="callout__body">{children}</div>
        </aside>
      )
    }
  }
  return <p>{children}</p>
}

const MD_COMPONENTS = {
  p: Paragraph,
  table: ({ children }) => <div className="table-wrapper"><table>{children}</table></div>,
  h1: ({ children, id }) => <h1 id={id}><a className="heading-anchor" href={`#${id}`}>{children}</a></h1>,
  h2: ({ children, id }) => <h2 id={id}><a className="heading-anchor" href={`#${id}`}>{children}</a></h2>,
  h3: ({ children, id }) => <h3 id={id}><a className="heading-anchor" href={`#${id}`}>{children}</a></h3>,
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
      {children}
    </a>
  ),
}

// ─── Highlight search terms in text ──────────────────────────────────────────
function highlight(text, query) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="search-highlight">{part}</mark>
      : part
  )
}

// ─── Search Modal ─────────────────────────────────────────────────────────────
function SearchModal({ pages, onJump, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return pages
      .filter(p => p.content.toLowerCase().includes(q))
      .slice(0, 30)
      .map(p => {
        const idx = p.content.toLowerCase().indexOf(q)
        const start = Math.max(0, idx - 60)
        const snippet = (start > 0 ? '…' : '') + p.content.slice(start, idx + q.length + 80).replace(/[#*_`]/g, '') + '…'
        return { pageNum: p.num, snippet }
      })
  }, [query, pages])

  return (
    <div className="bm-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onClose() }}
              placeholder="Search the book…"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
            )}
          </div>
          <button className="bm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="search-body">
          {query.length < 2 && (
            <p className="bm-empty">Type at least 2 characters to search.</p>
          )}
          {query.length >= 2 && results.length === 0 && (
            <p className="bm-empty">No results for <strong>"{query}"</strong>.</p>
          )}
          {results.length > 0 && (
            <>
              <p className="search-count">{results.length} result{results.length !== 1 ? 's' : ''}</p>
              <ul className="bm-list">
                {results.map(r => (
                  <li key={r.pageNum} className="bm-item">
                    <button className="bm-jump" onClick={() => { onJump(r.pageNum); onClose() }}>
                      <span className="bm-page-num">p.{r.pageNum}</span>
                      <span className="bm-preview search-snippet">{highlight(r.snippet, query.trim())}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Table of Contents panel ──────────────────────────────────────────────────
function TOCPanel({ toc, currentPageNum, onJump, onClose }) {
  const activeRef = useRef(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [])

  return (
    <div className="bm-overlay" onClick={onClose}>
      <div className="bm-panel toc-panel" onClick={e => e.stopPropagation()}>
        <div className="bm-header">
          <span className="bm-title">Contents</span>
          <button className="bm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ul className="toc-list">
          {toc.map(entry => {
            const isActive = entry.pageNum === currentPageNum
            return (
              <li key={entry.pageNum} ref={isActive ? activeRef : null}
                  className={`toc-item toc-level-${entry.level} ${isActive ? 'toc-active' : ''}`}>
                <button className="toc-btn" onClick={() => { onJump(entry.pageNum); onClose() }}>
                  <span className="toc-title">{entry.title}</span>
                  <span className="toc-page">p.{entry.pageNum}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ─── Bookmark panel ───────────────────────────────────────────────────────────
function BookmarkPanel({ bookmarks, currentPage, pages, onJump, onDelete, onClose }) {
  return (
    <div className="bm-overlay" onClick={onClose}>
      <div className="bm-panel" onClick={e => e.stopPropagation()}>
        <div className="bm-header">
          <span className="bm-title">Bookmarks</span>
          <button className="bm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {bookmarks.length === 0 ? (
          <p className="bm-empty">No bookmarks yet.<br />Tap 🏷 on any page to save it.</p>
        ) : (
          <ul className="bm-list">
            {bookmarks.map(b => {
              const page = pages.find(p => p.num === b.pageNum)
              const preview = page?.content.replace(/[#*_`]/g, '').trim().slice(0, 80) || ''
              return (
                <li key={b.pageNum} className="bm-item">
                  <button className="bm-jump" onClick={() => { onJump(b.pageNum); onClose() }}>
                    <span className="bm-page-num">p.{b.pageNum}</span>
                    <span className="bm-preview">{preview}…</span>
                    <span className="bm-date">{b.savedAt}</span>
                  </button>
                  <button
                    className="bm-delete"
                    onClick={() => onDelete(b.pageNum)}
                    aria-label={`Remove bookmark for page ${b.pageNum}`}
                  >✕</button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Go-to-page modal ─────────────────────────────────────────────────────────
function GoToModal({ totalPages, onJump, onClose }) {
  const [val, setVal] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 0 && n < totalPages) { onJump(n); onClose() }
  }

  return (
    <div className="bm-overlay" onClick={onClose}>
      <div className="goto-modal" onClick={e => e.stopPropagation()}>
        <p className="goto-label">Jump to page <span>(0 – {totalPages - 1})</span></p>
        <input
          ref={inputRef}
          className="goto-input"
          type="number" min={0} max={totalPages - 1}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          placeholder="Page number…"
        />
        <div className="goto-actions">
          <button className="goto-btn goto-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="goto-btn goto-btn--go" onClick={submit}>Go</button>
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
const FONT_SIZES = ['font-sm', 'font-md', 'font-lg']
const FONT_LABELS = ['A−', 'A', 'A+']

export default function App() {
  const pages = useMemo(() => parsePages(bookContent), [])
  const toc    = useMemo(() => buildTOC(pages), [pages])
  const totalPages = pages.length

  // ── State ──
  const [pageIndex, setPageIndex] = useState(() => {
    const saved = localStorage.getItem(KEY_PAGE)
    if (saved !== null) {
      const idx = pages.findIndex(p => p.num === parseInt(saved, 10))
      return idx >= 0 ? idx : 0
    }
    return 0
  })
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_BOOKMARKS) || '[]') }
    catch { return [] }
  })
  const [fontSizeIdx, setFontSizeIdx] = useState(() => {
    const saved = localStorage.getItem(KEY_FONTSIZE)
    return saved !== null ? parseInt(saved, 10) : 1
  })

  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showTOC,       setShowTOC]       = useState(false)
  const [showSearch,    setShowSearch]    = useState(false)
  const [showGoto,      setShowGoto]      = useState(false)
  const [pageDir,       setPageDir]       = useState('forward') // for animation
  const articleRef = useRef(null)

  const currentPage  = pages[pageIndex]
  const isBookmarked = bookmarks.some(b => b.pageNum === currentPage?.num)
  const pageHeading  = currentPage ? extractHeading(currentPage.content) : null
  const pageReadTime = currentPage ? readingTime(currentPage.content) : ''

  // ── Persist ──
  useEffect(() => {
    if (currentPage) localStorage.setItem(KEY_PAGE, String(currentPage.num))
  }, [currentPage])
  useEffect(() => { localStorage.setItem(KEY_BOOKMARKS, JSON.stringify(bookmarks)) }, [bookmarks])
  useEffect(() => { localStorage.setItem(KEY_FONTSIZE, String(fontSizeIdx)) }, [fontSizeIdx])

  // ── Scroll to top on page change ──
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pageIndex])

  // ── Navigation ──
  const goTo = useCallback((pageNum) => {
    const idx = pages.findIndex(p => p.num === pageNum)
    if (idx >= 0) {
      setPageDir(idx > pageIndex ? 'forward' : 'backward')
      setPageIndex(idx)
    }
  }, [pages, pageIndex])

  const prev = useCallback(() => {
    setPageDir('backward')
    setPageIndex(i => Math.max(0, i - 1))
  }, [])

  const next = useCallback(() => {
    setPageDir('forward')
    setPageIndex(i => Math.min(totalPages - 1, i + 1))
  }, [totalPages])

  // ── Keyboard nav ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev()
      if (e.key === 'b' || e.key === 'B') setShowBookmarks(v => !v)
      if (e.key === 't' || e.key === 'T') setShowTOC(v => !v)
      if (e.key === '/' || e.key === 'f' || e.key === 'F') { e.preventDefault(); setShowSearch(v => !v) }
      if (e.key === 'g' || e.key === 'G') setShowGoto(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev])

  // ── Bookmark actions ──
  const toggleBookmark = useCallback(() => {
    const num = currentPage?.num
    if (num == null) return
    setBookmarks(prev =>
      prev.some(b => b.pageNum === num)
        ? prev.filter(b => b.pageNum !== num)
        : [...prev, {
            pageNum: num,
            savedAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          }].sort((a, b) => a.pageNum - b.pageNum)
    )
  }, [currentPage])

  const deleteBookmark = useCallback((pageNum) => {
    setBookmarks(prev => prev.filter(b => b.pageNum !== pageNum))
  }, [])

  // ── Swipe ──
  const touchStartX = useRef(null)
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev() }
    touchStartX.current = null
  }

  const progress = totalPages > 1 ? (pageIndex / (totalPages - 1)) * 100 : 0

  if (!currentPage) return <div className="error">No pages found in book.md</div>

  return (
    <div className={FONT_SIZES[fontSizeIdx]} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* ── Progress bar ── */}
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Header ── */}
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__left">
            <div className="site-header__meta">
              <span className="site-header__eyebrow">Dating for Dummies</span>
              {pageHeading && (
                <span className="site-header__chapter" title={pageHeading}>
                  {pageHeading}
                </span>
              )}
            </div>
          </div>

          <div className="site-header__right">
            {/* Font size controls */}
            <div className="font-controls" aria-label="Font size">
              {FONT_SIZES.map((_, i) => (
                <button
                  key={i}
                  className={`font-btn ${fontSizeIdx === i ? 'is-active' : ''}`}
                  onClick={() => setFontSizeIdx(i)}
                  aria-label={`Font size ${FONT_LABELS[i]}`}
                  aria-pressed={fontSizeIdx === i}
                >
                  {FONT_LABELS[i]}
                </button>
              ))}
            </div>

            <button
              className="icon-btn"
              onClick={() => setShowSearch(true)}
              title="Search (/ or F)"
              aria-label="Search"
            >🔍</button>

            <button
              className="icon-btn"
              onClick={() => setShowTOC(true)}
              title="Contents (T)"
              aria-label="Table of contents"
            >📖</button>

            <button
              className={`icon-btn bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}`}
              onClick={toggleBookmark}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            >{isBookmarked ? '🔖' : '🏷'}</button>

            <button
              className={`icon-btn ${showBookmarks ? 'is-active' : ''}`}
              onClick={() => setShowBookmarks(v => !v)}
              title="Bookmarks (B)"
              aria-label="Open bookmarks"
            >☰</button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="reader">
        <article
          className={`prose page-enter page-enter--${pageDir}`}
          ref={articleRef}
          key={pageIndex}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
            components={MD_COMPONENTS}
          >
            {currentPage.content}
          </ReactMarkdown>
        </article>
      </main>

      {/* ── Bottom navigation ── */}
      <nav className="page-nav" aria-label="Page navigation">
        <button
          className="nav-btn nav-btn--prev"
          onClick={prev}
          disabled={pageIndex === 0}
          aria-label="Previous page"
        >
          <span className="nav-arrow">←</span>
          <span className="nav-label">Prev</span>
        </button>

        <div className="nav-center">
          <button className="nav-page-btn" onClick={() => setShowGoto(true)} title="Jump to page (G)">
            <span className="nav-page-current">{currentPage.num}</span>
            <span className="nav-page-sep">·</span>
            <span className="nav-page-total">{pages[totalPages - 1].num}</span>
          </button>
          <span className="nav-read-time">{pageReadTime}</span>
        </div>

        <button
          className="nav-btn nav-btn--next"
          onClick={next}
          disabled={pageIndex === totalPages - 1}
          aria-label="Next page"
        >
          <span className="nav-label">Next</span>
          <span className="nav-arrow">→</span>
        </button>
      </nav>

      {/* ── Modals ── */}
      {showSearch && (
        <SearchModal pages={pages} onJump={goTo} onClose={() => setShowSearch(false)} />
      )}

      {showTOC && (
        <TOCPanel toc={toc} currentPageNum={currentPage.num} onJump={goTo} onClose={() => setShowTOC(false)} />
      )}

      {showBookmarks && (
        <BookmarkPanel
          bookmarks={bookmarks}
          currentPage={currentPage}
          pages={pages}
          onJump={goTo}
          onDelete={deleteBookmark}
          onClose={() => setShowBookmarks(false)}
        />
      )}

      {showGoto && (
        <GoToModal totalPages={totalPages} onJump={goTo} onClose={() => setShowGoto(false)} />
      )}
    </div>
  )
}
