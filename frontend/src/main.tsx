import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, CircleHelp, FilePlus2, FileStack, Files, GripVertical, Layers2, Minimize2, RotateCw, Scissors, Trash2, Upload, X } from 'lucide-react'
import './style.css'

type Tool = 'merge' | 'split' | 'compress' | 'rotate' | 'delete' | 'reorder'
const tools = [
  { id: 'merge', label: 'Merge PDFs', icon: Files, eyebrow: 'BRING IT ALL TOGETHER', title: 'A little more together.', description: 'Combine your documents into one beautifully organized PDF.', action: 'Merge PDFs', number: '01' },
  { id: 'split', label: 'Split PDF', icon: Scissors, eyebrow: 'MAKE SOME ROOM', title: 'Give pages their space.', description: 'Separate your PDF into smaller documents, just the way you like.', action: 'Split PDF', number: '02' },
  { id: 'compress', label: 'Compress PDF', icon: Minimize2, eyebrow: 'TRAVEL A LITTLE LIGHTER', title: 'Less weight, same story.', description: 'Make your PDF easier to share without losing what matters.', action: 'Compress PDF', number: '03' },
  { id: 'rotate', label: 'Rotate pages', icon: RotateCw, eyebrow: 'A FRESH PERSPECTIVE', title: 'Turn things around.', description: 'Set your pages straight with a simple rotation.', action: 'Rotate pages', number: '04' },
  { id: 'delete', label: 'Delete pages', icon: Trash2, eyebrow: 'KEEP WHAT MATTERS', title: 'Make a little edit.', description: 'Remove the pages you no longer need from your document.', action: 'Delete pages', number: '05' },
  { id: 'reorder', label: 'Reorder pages', icon: Layers2, eyebrow: 'PUT IT IN ORDER', title: 'A better arrangement.', description: 'Put every page exactly where it belongs.', action: 'Reorder pages', number: '06' },
] as const

function App() {
  const [tool, setTool] = useState<Tool>('merge')
  const [files, setFiles] = useState<File[]>([])
  const [pages, setPages] = useState('')
  const [angle, setAngle] = useState('90')
  const [level, setLevel] = useState('balanced')
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const current = tools.find(t => t.id === tool)!

  function resetResult() { setDownload(old => { if (old) URL.revokeObjectURL(old.url); return null }); setStatus('idle'); setMessage('') }
  function chooseTool(id: Tool) { resetResult(); setTool(id); setFiles([]); setPages(''); if (input.current) input.current.value = '' }
  function addFiles(incoming: File[]) {
    resetResult()
    const pdfs = incoming.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length !== incoming.length) { setStatus('error'); setMessage('Please choose PDF files only.') }
    if (pdfs.length) setFiles(old => tool === 'merge' ? [...old, ...pdfs] : [pdfs[0]])
    if (input.current) input.current.value = ''
  }
  function move(index: number, direction: number) {
    const next = [...files]; const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setFiles(next); resetResult()
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)) }
  async function submit(event: FormEvent) {
    event.preventDefault(); resetResult()
    if (!files.length || (tool === 'merge' && files.length < 2)) { setStatus('error'); setMessage(tool === 'merge' ? 'Please add at least two PDFs to merge.' : 'Please add a PDF to continue.'); return }
    const data = new FormData()
    if (tool === 'merge') files.forEach(file => data.append('files', file))
    else data.append('file', files[0])
    if (tool === 'split') data.append('ranges', pages)
    if (tool === 'rotate' || tool === 'delete' || tool === 'reorder') data.append('pages', pages)
    if (tool === 'rotate') data.append('angle', angle)
    if (tool === 'compress') data.append('level', level)
    setStatus('working')
    try {
      const response = await fetch(`/api/${tool}`, { method: 'POST', body: data })
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not process your PDF. Please check your inputs.') }
      const blob = await response.blob()
      const name = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || (tool === 'split' ? 'yourpdf.zip' : 'yourpdf.pdf')
      setDownload({ url: URL.createObjectURL(blob), name }); setStatus('done')
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.') }
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><FileStack size={20}/></div><div><strong>your<span>pdf</span></strong><small>A LITTLE DOCUMENT STUDIO</small></div></div>
      <div className="sidebar-label">YOUR TOOLBOX <span>✳</span></div>
      <nav aria-label="PDF tools">{tools.map(({ id, label, icon: Icon, number }) => <button key={id} className={`nav-item ${tool === id ? 'active' : ''}`} onClick={() => chooseTool(id)} aria-current={tool === id ? 'page' : undefined}><Icon size={17}/><span>{label}</span><em>{number}</em></button>)}</nav>
      <div className="sidebar-bottom"><div className="little-star">✳</div><p>Good work deserves<br/><i>good tools.</i></p><span>MADE FOR YOUR EVERYDAY</span></div>
      <div className="sidebar-footer"><span>YOURPDF © 2026</span><span>V 1.0</span></div>
    </aside>
    <main className="main"><header className="topbar"><div><span>YOUR WORKSPACE</span><ChevronRight size={13}/><b>{current.label}</b></div><div className="local-badge"><span/> YOUR LOCAL STUDIO</div></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> {current.eyebrow}</div><h1>{current.title}</h1><p>{current.description}</p></div><div className="heading-stamp"><span>THE PDF<br/>TOOLKIT</span><i>✳</i><small>EST. 2026</small></div></div>
        <div className="workspace"><div className="workspace-header"><div><span className="step-number">01</span><div><h2>{current.label}</h2><p>{tool === 'merge' ? 'Select the files you would like to bring together.' : 'Select a document to get started.'}</p></div></div><span className="workspace-note">A SIMPLE LITTLE PROCESS <span>↗</span></span></div>
          <form onSubmit={submit}>
            <div className="dropzone" onDragOver={event => event.preventDefault()} onDrop={drop}>
              <div className="upload-icon"><Upload size={23}/></div><h3>Drop your {tool === 'merge' ? 'PDFs' : 'PDF'} here</h3><p>or choose {tool === 'merge' ? 'files' : 'a file'} from your computer</p><button type="button" className="browse" onClick={() => input.current?.click()}><FilePlus2 size={16}/> Browse files</button><input ref={input} type="file" accept="application/pdf,.pdf" multiple={tool === 'merge'} hidden onChange={event => addFiles(Array.from(event.target.files || []))}/><span className="drop-hint">PDF FILES ONLY <span>·</span> PROCESSED LOCALLY</span>
            </div>
            {files.length > 0 && <div className="file-list"><div className="section-label">YOUR {files.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'} <span>{String(files.length).padStart(2, '0')}</span></div>{files.map((file, index) => <div className="file-row" key={`${file.name}-${file.lastModified}-${index}`}><GripVertical size={15} className="grip"/><div className="file-icon"><FileStack size={17}/></div><div className="file-info"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div>{tool === 'merge' && <><button type="button" className="icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${file.name} up`}><ArrowUp size={16}/></button><button type="button" className="icon-button" onClick={() => move(index, 1)} disabled={index === files.length - 1} aria-label={`Move ${file.name} down`}><ArrowDown size={16}/></button></>}<button type="button" className="icon-button" onClick={() => { setFiles(files.filter((_, i) => i !== index)); resetResult() }} aria-label={`Remove ${file.name}`}><X size={16}/></button></div>)}</div>}
            {tool !== 'merge' && tool !== 'compress' && <div className="options"><label htmlFor="pages">{tool === 'split' ? 'Page ranges' : tool === 'reorder' ? 'New page order' : 'Pages'}</label><input id="pages" value={pages} onChange={event => { setPages(event.target.value); resetResult() }} placeholder={tool === 'reorder' ? 'e.g. 3, 1, 2' : 'e.g. 1, 3-5'} required/><p>{tool === 'split' ? 'Separate ranges with commas. Each range becomes a PDF in a ZIP.' : tool === 'reorder' ? 'List every page once in the order you want.' : 'Enter page numbers or ranges, separated by commas.'}</p></div>}
            {tool === 'rotate' && <div className="options"><label htmlFor="angle">Rotation</label><select id="angle" value={angle} onChange={e => { setAngle(e.target.value); resetResult() }}><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">90° counterclockwise</option></select></div>}
            {tool === 'compress' && <div className="options"><label htmlFor="level">Compression level</label><select id="level" value={level} onChange={e => { setLevel(e.target.value); resetResult() }}><option value="light">Light — higher quality</option><option value="balanced">Balanced</option><option value="strong">Strong — smaller files</option></select><p>Compression can reduce image quality and may not make every PDF smaller.</p></div>}
            <div className="form-bottom"><div className="privacy"><span>✳</span><p><strong>Just between us.</strong><br/>Your files are processed locally.</p></div><button className="primary" type="submit" disabled={status === 'working'}>{status === 'working' ? 'Working on it…' : current.action}<ArrowRight size={17}/></button></div>
            <div aria-live="polite">{status === 'error' && <div className="notice error">{message}</div>}{status === 'done' && download && <div className="notice success"><div><Check size={18}/><span><strong>All done.</strong> Your document is ready.</span></div><a href={download.url} download={download.name}>Download <ArrowDownToLine size={16}/></a></div>}</div>
          </form>
        </div>
        <div className="under-card"><span><CircleHelp size={15}/> A LITTLE TIP</span><p>{tool === 'merge' ? 'Use the arrows to arrange your files before merging.' : 'Page numbers start at 1, just like a printed document.'}</p><span>TAKE YOUR TIME <i>✳</i></span></div>
      </div><footer className="main-footer"><span>MADE WITH CARE FOR YOUR DOCUMENTS</span><span>AN EASIER WAY TO PDF <span>✳</span></span></footer>
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
