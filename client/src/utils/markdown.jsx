export function parseMarkdown(text) {
  const tokens = []
  let remaining = text

  while (remaining.length > 0) {
    let matched = false

    if (remaining.startsWith('```')) {
      const end = remaining.indexOf('```', 3)
      if (end !== -1) {
        const raw = remaining.slice(3, end)
        const firstNewline = raw.indexOf('\n')
        const lang = firstNewline > 0 ? raw.slice(0, firstNewline).trim() : ''
        const code = firstNewline > 0 ? raw.slice(firstNewline + 1) : raw
        tokens.push({ type: 'code-block', lang, content: code })
        remaining = remaining.slice(end + 3)
        matched = true
      }
    }

    if (!matched && remaining.startsWith('||')) {
      const end = remaining.indexOf('||', 2)
      if (end !== -1) {
        tokens.push({ type: 'spoiler', content: remaining.slice(2, end) })
        remaining = remaining.slice(end + 2)
        matched = true
      }
    }

    if (!matched && remaining.startsWith('`')) {
      const end = remaining.indexOf('`', 1)
      if (end !== -1) {
        tokens.push({ type: 'inline-code', content: remaining.slice(1, end) })
        remaining = remaining.slice(end + 1)
        matched = true
      }
    }

    if (!matched && remaining.startsWith('**')) {
      const end = remaining.indexOf('**', 2)
      if (end !== -1) {
        tokens.push({ type: 'bold', content: remaining.slice(2, end) })
        remaining = remaining.slice(end + 2)
        matched = true
      }
    }

    if (!matched && remaining.startsWith('__')) {
      const end = remaining.indexOf('__', 2)
      if (end !== -1) {
        tokens.push({ type: 'underline', content: remaining.slice(2, end) })
        remaining = remaining.slice(end + 2)
        matched = true
      }
    }

    if (!matched && remaining.startsWith('~~')) {
      const end = remaining.indexOf('~~', 2)
      if (end !== -1) {
        tokens.push({ type: 'strikethrough', content: remaining.slice(2, end) })
        remaining = remaining.slice(end + 2)
        matched = true
      }
    }

    if (!matched && remaining.startsWith('*') && !remaining.startsWith('**')) {
      const end = remaining.indexOf('*', 1)
      if (end !== -1 && remaining[end - 1] !== ' ') {
        tokens.push({ type: 'italic', content: remaining.slice(1, end) })
        remaining = remaining.slice(end + 1)
        matched = true
      }
    }

    if (!matched) {
      const last = tokens[tokens.length - 1]
      if (last && last.type === 'text') {
        last.content += remaining[0]
      } else {
        tokens.push({ type: 'text', content: remaining[0] })
      }
      remaining = remaining.slice(1)
    }
  }

  return tokens
}

export function renderMarkdown(text, options = {}) {
  const tokens = parseMarkdown(text)
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'code-block':
        return (
          <pre key={i} className="md-code-block">
            {token.lang && <span className="md-code-lang">{token.lang}</span>}
            <code>{token.content}</code>
          </pre>
        )
      case 'inline-code':
        return <code key={i} className="md-inline-code">{token.content}</code>
      case 'spoiler':
        return (
          <span key={i} className="md-spoiler" onClick={(e) => { e.stopPropagation(); e.currentTarget.classList.toggle('revealed') }}>
            {token.content}
          </span>
        )
      case 'bold':
        return <strong key={i}>{token.content}</strong>
      case 'italic':
        return <em key={i}>{token.content}</em>
      case 'underline':
        return <u key={i}>{token.content}</u>
      case 'strikethrough':
        return <s key={i}>{token.content}</s>
      case 'text':
      default:
        return token.content.split('\n').map((line, j, arr) => (
          <span key={i + '-' + j}>
            {line}{j < arr.length - 1 && <br />}
          </span>
        ))
    }
  })
}
