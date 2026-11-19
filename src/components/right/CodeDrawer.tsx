import { Check, Copy, X } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { useEffect, useState } from 'react';
import { SNIPPETS } from '../../data/snippets';

interface Props {
  open: boolean;
  snippetId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function CodeDrawer({ open, snippetId, onSelect, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const snippet = SNIPPETS.find((s) => s.id === snippetId) ?? SNIPPETS[0];

  useEffect(() => setCopied(false), [snippetId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-[min(960px,70vw)] bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="w-60 shrink-0 border-r border-slate-800 p-4">
          <div className="mb-3 text-sm font-semibold">How it's built</div>
          {SNIPPETS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm ${
                s.id === snippet.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900'
              }`}
            >
              <div className="text-[10px] font-semibold tracking-widest text-slate-500">{s.where}</div>
              {s.title}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-accent">{snippet.where}</div>
              <h2 className="text-lg font-semibold">{snippet.title}</h2>
              <div className="font-mono text-xs text-slate-500">{snippet.file}</div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{snippet.explanation}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto p-5">
            <button
              onClick={copy}
              className="absolute right-7 top-7 flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <Highlight theme={themes.nightOwl} code={snippet.code} language="tsx">
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre className="rounded-xl p-4 text-[13px] leading-relaxed" style={style}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </div>
        </div>
      </aside>
    </div>
  );
}
