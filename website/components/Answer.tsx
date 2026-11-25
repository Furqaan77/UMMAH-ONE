import { Fragment } from "react";

// Tiny, safe renderer: paragraphs, "- " bullets, "1. " lists, **bold**. No HTML injection.
// fold: "## " sections become closed headings that open on click (city overview, 25 Nov 2026).

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
  );
}

export default function Answer({ text, fold }: { text: string; fold?: boolean }) {
  const clean = text.replace(/\r/g, "");
  if (fold) {
    // Split at "## " headings: the part before the first heading and the last plain paragraph stay open.
    const parts = clean.split(/\n(?=## )/);
    const head = parts[0].startsWith("## ") ? "" : parts.shift()!;
    const sections = parts.map((p) => {
      const [first, ...rest] = p.split("\n");
      return { title: first.replace(/^##\s+/, ""), body: rest.join("\n").trim() };
    });
    // A trailing plain paragraph after the last list belongs outside the fold.
    const last = sections[sections.length - 1];
    let tail = "";
    if (last) {
      const m = /\n{2,}([^\n-][^\n]*)$/.exec(last.body);
      if (m) {
        tail = m[1];
        last.body = last.body.slice(0, m.index);
      }
    }
    return (
      <>
        {head && <Blocks text={head} />}
        {sections.map((s, i) => (
          <details key={i} className="fold">
            <summary>{s.title}</summary>
            <Blocks text={s.body} />
          </details>
        ))}
        {tail && <Blocks text={tail} />}
      </>
    );
  }
  return <Blocks text={clean} />;
}

function Blocks({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        const isBullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const isNumbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (isBullets)
          return (
            <ul key={bi}>
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>)}
            </ul>
          );
        if (isNumbered)
          return (
            <ol key={bi}>
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}
            </ol>
          );
        const heading = lines.length === 1 && /^#{1,4}\s+/.test(lines[0]);
        if (heading) return <h3 key={bi}>{inline(lines[0].replace(/^#{1,4}\s+/, ""))}</h3>;
        return (
          <p key={bi}>
            {lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
