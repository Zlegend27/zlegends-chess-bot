/* Guides (/guides) and each guide (/guides/<slug>): articles that answer
   what people search for and lead into the site's tools. The text lives in
   src/data/guides.js. Drafts show only on the dev server, marked "Draft". */
import { useEffect } from "react";
import SubPage from "./SubPage";
import { getUiTheme } from "../utils/uiTheme";
import { GUIDES, guidePath, guideForPath } from "../data/guides";

const visible = () => GUIDES.filter((g) => !g.draft || import.meta.env.DEV);

export default function GuidesPage({ onBack, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const guide = guideForPath(window.location.pathname);
  const shown = guide && (!guide.draft || import.meta.env.DEV) ? guide : null;
  useEffect(() => {
    document.title = shown ? `${shown.heading} · Zlegend2700` : "Guides · Zlegend2700";
  }, [shown]);
  const link = `font-bold underline underline-offset-4 ${T.interactiveText}`;
  const Draft = () => <span className="ml-2 rounded-full bg-yellow/20 px-2 py-0.5 text-[11px] font-bold text-yellow">Draft</span>;

  if (shown) {
    return (
      <SubPage onBack={onBack} sweetheart={sweetheart}>
        <a href="/guides" className={`self-start text-sm ${link}`}>All guides</a>
        <article className="flex flex-col gap-3">
          <h1 className="boxHead m-0">{shown.heading}{shown.draft && <Draft />}</h1>
          <p className={"m-0 text-xs " + T.dimText}>{shown.minutes} min read · updated {shown.updated}</p>
          {shown.body.map((b, i) => (
            b.h2 ? <h2 key={i} className={`m-0 mt-2 text-lg ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>{b.h2}</h2>
            : b.ul ? <ul key={i} className={`m-0 flex flex-col gap-1.5 pl-5 text-[15px] leading-relaxed ${T.ink}`}>{b.ul.map((it) => <li key={it}>{it}</li>)}</ul>
            : b.cta ? <a key={i} href={b.href} className="btn gold mt-2 self-start no-underline">{b.cta}</a>
            : b.video ? (
              <div key={i} className="aspect-video w-full overflow-hidden rounded-xl">
                <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${b.video}`} title="Video guide" loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            )
            : <p key={i} className={`m-0 text-[15px] leading-relaxed ${T.ink}`}>{b.p}</p>
          ))}
        </article>
      </SubPage>
    );
  }

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <h1 className="boxHead m-0">Guides</h1>
      <p className={"m-0 text-sm " + T.dimText}>Short, practical guides to getting better at chess, and how to use the site's free tools to do it.</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {visible().map((g) => (
          <li key={g.slug}>
            <a href={guidePath(g.slug)} className={`block rounded-2xl border p-4 no-underline ${T.cardBorder} ${T.panelBg} hover:border-cyan`}>
              <span className={`block text-base font-bold ${T.ink}`}>{g.heading}{g.draft && <Draft />}</span>
              <span className={`mt-1 block text-sm leading-relaxed ${T.dimText}`}>{g.description}</span>
              <span className={`mt-1 block text-xs ${T.dimText}`}>{g.minutes} min read</span>
            </a>
          </li>
        ))}
      </ul>
    </SubPage>
  );
}
