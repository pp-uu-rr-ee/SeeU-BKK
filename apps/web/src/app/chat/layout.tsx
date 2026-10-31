import { notFound } from 'next/navigation'

// /chat is a developer test page for the agent stream; hide it from production builds
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return children
}
