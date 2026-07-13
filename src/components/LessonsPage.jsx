import { useState } from "react";
import StarField from "./StarField";
import { TopNav } from "./ExploreNav";
import SocialBanner from "./SocialBanner";
import LessonPlayer from "./LessonPlayer";
import { LESSONS } from "../data/lessons";
import { loadSetting } from "../utils/storage";

/** Lessons: pick a lesson -> pick a chapter -> LessonPlayer takes over
 *  the board. Same page-not-modal, own-page-with-TopNav pattern as
 *  LeaderboardPage.jsx -- three tiny local states (selected lesson,
 *  selected chapter) rather than lifting any of this into App.jsx,
 *  since nothing here needs to touch the main Play board/engine. */
export default function LessonsPage({ onBack, onToolSelect, activeToolId }) {
  const [lessonId, setLessonId] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(null);
  const pieceSetId = loadSetting("pieceSet", "classic");

  const lesson = LESSONS.find(l => l.id === lessonId) || null;
  const chapter = lesson?.chapters.find(c => c.number === chapterNumber) || null;

  if (lesson && chapter) {
    return (
      <div className="root">
        <StarField />
        <TopNav onSelect={onToolSelect} active={activeToolId} />
        <button
          onClick={() => setChapterNumber(null)}
          className="mb-2 inline-flex items-center gap-1.5 self-start bg-transparent text-sm font-bold text-[#9D8FC4] transition-colors hover:text-[#F4EFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
          {lesson.title}
        </button>
        <div className="hdr" style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 26 }}>Chapter {chapter.number}</h1>
          <div className="sub" style={{ fontSize: 12 }}>{chapter.title}</div>
        </div>
        <LessonPlayer
          key={`${lesson.id}-${chapter.number}`}
          chapter={chapter}
          orientation={lesson.orientation || "white"}
          pieceSetId={pieceSetId}
          onExit={() => setChapterNumber(null)}
        />
      </div>
    );
  }

  return (
    <div className="root">
      <StarField />
      <TopNav onSelect={onToolSelect} active={activeToolId} />

      <button
        onClick={lesson ? () => setLessonId(null) : onBack}
        className="mb-2 inline-flex items-center gap-1.5 self-start bg-transparent text-sm font-bold text-[#9D8FC4] transition-colors hover:text-[#F4EFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
        Back
      </button>

      <div className="hdr">
        <h1 style={{ fontSize: 34 }}>🎓 Lessons</h1>
        <div className="sub">{lesson ? "Pick a chapter" : "Pick a lesson"}</div>
      </div>

      <div className="mt-4 flex w-full max-w-md flex-col gap-3">
        {!lesson ? (
          LESSONS.map(l => (
            <button
              key={l.id}
              onClick={() => setLessonId(l.id)}
              className="rounded-2xl border border-[#8B2FC966] bg-[#1D1038CC] px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#3EE7F566] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5]"
            >
              <div className="font-bold text-[#F4EFFF]">{l.title}</div>
              <div className="mt-1 text-xs text-[#9D8FC4]">{l.desc}</div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#3EE7F5]">{l.chapters.length} chapter{l.chapters.length === 1 ? "" : "s"}</div>
            </button>
          ))
        ) : (
          lesson.chapters.map(c => (
            <button
              key={c.number}
              onClick={() => setChapterNumber(c.number)}
              className="rounded-2xl border border-[#8B2FC966] bg-[#1D1038CC] px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#3EE7F566] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5]"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F5D93E]">Chapter {c.number}</div>
              <div className="mt-1 font-bold text-[#F4EFFF]">{c.title}</div>
              <div className="mt-1 text-xs text-[#9D8FC4]">{c.beats.length} step{c.beats.length === 1 ? "" : "s"}</div>
            </button>
          ))
        )}
      </div>

      <SocialBanner />
    </div>
  );
}
