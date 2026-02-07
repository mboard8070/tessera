export function AttributionFooter() {
  const sources = [
    { name: "Semantic Scholar", href: "https://www.semanticscholar.org/" },
    { name: "arXiv", href: "https://arxiv.org/" },
    { name: "OpenAlex", href: "https://openalex.org/" },
    { name: "CrossRef", href: "https://www.crossref.org/" },
    { name: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/" },
  ];

  return (
    <footer className="border-t border-zinc-800 bg-zinc-900/60 px-6 py-2.5 text-[11px] text-zinc-500">
      <span>Data provided by </span>
      {sources.map((s, i) => (
        <span key={s.name}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            {s.name}
          </a>
          {i < sources.length - 1 && <span> · </span>}
        </span>
      ))}
    </footer>
  );
}
