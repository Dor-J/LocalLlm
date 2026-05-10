import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

const markdownComponents: Components = {
  a: (props) => <a {...props} rel="noopener noreferrer" target="_blank" />,
}

export interface MessageMarkdownProps {
  /** Markdown source from the assistant (sanitized before render). */
  content: string
}

/**
 * Renders assistant markdown with GFM support and HTML sanitized via rehype-sanitize.
 */
export function MessageMarkdown({ content }: MessageMarkdownProps) {
  return (
    <div className="message-bubble__body message-bubble__body--md">
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
