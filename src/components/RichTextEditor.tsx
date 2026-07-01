'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Heading3, Pilcrow } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ancien contenu (textarea brut) : pas de balises HTML — on convertit les
// retours à la ligne en <br> / paragraphes pour préserver la mise en page
// existante quand ce texte est chargé dans l'éditeur riche.
function toEditorHTML(value: string): string {
  if (!value) return ''
  if (/<[a-z][\s\S]*>/i.test(value)) return value
  return value
    .split(/\n{2,}/)
    .map(block => `<p>${block
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')}</p>`)
    .join('')
}

interface Props {
  content: string
  onChange?: (html: string) => void
  placeholder?: string
  editable?: boolean
  minHeight?: string
  className?: string
}

export default function RichTextEditor({
  content, onChange, placeholder, editable = true, minHeight, className,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: toEditorHTML(content),
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none text-sm text-gray-800',
      },
    },
    immediatelyRender: false,
  })

  if (!editor) return null

  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden bg-white', !editable && 'border-gray-100', className)}>
      {editable && <Toolbar editor={editor} />}
      <div className="px-3 py-2" style={minHeight ? { minHeight } : undefined}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const items: { icon: typeof Bold; label: string; action: () => void; active: boolean }[] = [
    { icon: Bold,          label: 'Gras',            action: () => editor.chain().focus().toggleBold().run(),               active: editor.isActive('bold') },
    { icon: Italic,        label: 'Italique',        action: () => editor.chain().focus().toggleItalic().run(),             active: editor.isActive('italic') },
    { icon: UnderlineIcon, label: 'Souligné',        action: () => editor.chain().focus().toggleUnderline().run(),          active: editor.isActive('underline') },
    { icon: Heading1,      label: 'Titre 1',         action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
    { icon: Heading2,      label: 'Titre 2',         action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { icon: Heading3,      label: 'Titre 3',         action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { icon: List,          label: 'Liste à puces',   action: () => editor.chain().focus().toggleBulletList().run(),         active: editor.isActive('bulletList') },
    { icon: ListOrdered,   label: 'Liste numérotée', action: () => editor.chain().focus().toggleOrderedList().run(),        active: editor.isActive('orderedList') },
    { icon: Pilcrow,       label: 'Texte normal',    action: () => editor.chain().focus().setParagraph().run(),             active: editor.isActive('paragraph') },
  ]

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/70 flex-wrap sticky top-0 z-10">
      {items.map(({ icon: Icon, label, action, active }) => (
        <button
          key={label}
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={action}
          title={label}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            active ? 'bg-auchu-100 text-auchu-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}
