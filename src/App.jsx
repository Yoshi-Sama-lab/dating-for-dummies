import { useEffect, useRef, useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import bookContent from './book.md?raw'

// ─── Strip Marker artifacts ───────────────────────────────────────────────────
// Marker produces lines like:  {0}------------------------------------------------
// Also lone page-number headings like:  # 34   # 116
function cleanMarkdown(raw) {
  return raw
    .split('\n')
    .filter(line => {
      if (/^\{\d+\}-{3,}$/.test(line.trim())) return false   // {N}----
      if (/^#+\s+\d+\s*$/.test(line.trim())) return false    // # 34
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')  // collapse excess blank lines
}

const cleanedContent = cleanMarkdown(bookContent)

// ─── Scroll Memory ────────────────────────────────────────────────────────────
const SCROLL_KEY = 'book_scroll_y'

function useScrollMemory() {
  const ticking = useRef(false)
  const saveTimeout = useRef(null)

  // Restore position on mount
  useEffect(() => {
    const saved = localStorage.getItem(SCROLL_KEY)
    if (saved !== null) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' })
      })
    }
  }, [])

  // Debounced save
  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      ticking.current = true
      requestAnimationFrame(() => {
        clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
          localStorage.setItem(SCROLL_KEY, String(Math.round(window.scrollY)))
        }, 300)
        ticking.current = false
      })
    }
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(saveTimeout.current)
    }
  }, [handleScroll])
}

// ─── Reading Progress ─────────────────────────────────────────────────────────
function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0)
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return (
    <div className="progress-track" aria-hidden="true">
      <div className="progress-fill" style={{ width: `${progress}%` }} />
    </div>
  )
}

// ─── Callout Paragraph ────────────────────────────────────────────────────────
// In this book, Marker rendered "Tip/Warning/Remember" callouts as plain
// paragraphs starting with **Keyword:** — NOT as blockquotes.
// We detect the leading bold keyword and convert the whole paragraph to a callout box.
const CALLOUT_MAP = {
  remember: { icon: '📌', label: 'Remember', cls: 'callout--remember' },
  note:     { icon: '📝', label: 'Note',     cls: 'callout--note'     },
  tip:      { icon: '💡', label: 'Tip',      cls: 'callout--tip'      },
  warning:  { icon: '⚠️', label: 'Warning',  cls: 'callout--warning'  },
  caution:  { icon: '⚠️', label: 'Caution',  cls: 'callout--warning'  },
}

function Paragraph({ children, node }) {
  const firstChild = node?.children?.[0]
  let calloutType = null

  // First child is a <strong> whose text is a bare keyword like "Remember"
  if (firstChild?.type === 'element' && firstChild.tagName === 'strong') {
    const text = (firstChild.children?.[0]?.value ?? '').replace(/:$/, '').trim().toLowerCase()
    if (CALLOUT_MAP[text]) calloutType = text
  }

  if (calloutType) {
    const { icon, label, cls } = CALLOUT_MAP[calloutType]
    return (
      <aside className={`callout ${cls}`}>
        <span className="callout__badge">
          <span className="callout__icon" aria-hidden="true">{icon}</span>
          {label}
        </span>
        <div className="callout__body">{children}</div>
      </aside>
    )
  }

  return <p>{children}</p>
}

// ─── Custom renderers ─────────────────────────────────────────────────────────
const components = {
  p: Paragraph,

  // Wrap tables for horizontal scroll on mobile
  table: ({ children }) => (
    <div className="table-wrapper"><table>{children}</table></div>
  ),

  // Heading anchor links
  h1: ({ children, id }) => (
    <h1 id={id}><a className="heading-anchor" href={`#${id}`}>{children}</a></h1>
  ),
  h2: ({ children, id }) => (
    <h2 id={id}><a className="heading-anchor" href={`#${id}`}>{children}</a></h2>
  ),
  h3: ({ children, id }) => (
    <h3 id={id}><a className="heading-anchor" href={`#${id}`}>{children}</a></h3>
  ),

  // External links → new tab
  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  useScrollMemory()

  return (
    <>
      <ReadingProgress />

      <header className="site-header">
        <div className="site-header__inner">
          <span className="site-header__eyebrow">Reading</span>
          <p className="site-header__title">Dating for Dummies</p>
        </div>
      </header>

      <main className="reader">
        <article className="prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
            components={components}
          >
            {cleanedContent}
          </ReactMarkdown>
        </article>
      </main>

      <footer className="site-footer">
        <p>End of document · Scroll position auto-saved</p>
      </footer>
    </>
  )
}