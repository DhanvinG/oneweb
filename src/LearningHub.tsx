import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  GraduationCap,
  Lightbulb,
  Lock,
  LayoutGrid,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { allLessons, courseModules, finalQuestionLessonIds, type CourseModule, type Lesson, type QuizQuestion } from './learningHubData';
import './learning-hub.css';

const STORAGE_KEY = 'oneweb-learning-hub-progress-v1';

type StoredProgress = {
  completedLessonIds: string[];
  moduleScores: Record<string, number>;
  finalScore: number | null;
};

const emptyProgress: StoredProgress = {
  completedLessonIds: [],
  moduleScores: {},
  finalScore: null,
};

function loadProgress(): StoredProgress {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyProgress;
    const parsed = JSON.parse(saved) as Partial<StoredProgress>;
    return {
      completedLessonIds: Array.isArray(parsed.completedLessonIds) ? parsed.completedLessonIds : [],
      moduleScores: parsed.moduleScores && typeof parsed.moduleScores === 'object' ? parsed.moduleScores : {},
      finalScore: typeof parsed.finalScore === 'number' ? parsed.finalScore : null,
    };
  } catch {
    return emptyProgress;
  }
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="hub-progress" aria-label={`${label}: ${value}%`}>
      <div className="hub-progress-track" aria-hidden="true">
        <span style={{ width: `${value}%` }} />
      </div>
      <span className="hub-progress-value">{value}%</span>
    </div>
  );
}

function QuestionBlock({
  question,
  number,
  selected,
  submitted,
  onSelect,
}: {
  key?: React.Key;
  question: QuizQuestion;
  number: number;
  selected: number | undefined;
  submitted: boolean;
  onSelect: (option: number) => void;
}) {
  return (
    <fieldset className="hub-question">
      <legend><span>{String(number).padStart(2, '0')}</span>{question.prompt}</legend>
      <div className="hub-question-options">
        {question.options.map((option, optionIndex) => {
          const isCorrect = submitted && optionIndex === question.answer;
          const isIncorrect = submitted && selected === optionIndex && optionIndex !== question.answer;
          return (
            <label
              className={`hub-option${selected === optionIndex ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isIncorrect ? ' is-incorrect' : ''}`}
              key={option}
            >
              <input
                type="radio"
                name={`question-${number}`}
                value={optionIndex}
                checked={selected === optionIndex}
                onChange={() => onSelect(optionIndex)}
                disabled={submitted}
              />
              <span className="hub-option-marker" aria-hidden="true">{isCorrect ? <Check size={17} /> : String.fromCharCode(65 + optionIndex)}</span>
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      {submitted && (
        <p className="hub-answer-explanation">
          <strong>{selected === question.answer ? 'Correct.' : 'The answer:'}</strong> {question.explanation}
        </p>
      )}
    </fieldset>
  );
}

function QuizPanel({
  module,
  savedScore,
  onSaveScore,
  onContinue,
}: {
  key?: React.Key;
  module: CourseModule;
  savedScore?: number;
  onSaveScore: (score: number) => void;
  onContinue: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(savedScore ?? null);
  const questions = module.lessons.map((lesson) => lesson.quiz);
  const isComplete = Object.keys(answers).length === questions.length;
  const passed = result !== null && result >= 4;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isComplete) return;
    const score = questions.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0);
    setResult(score);
    onSaveScore(score);
  };

  const retake = () => {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="hub-assessment" aria-labelledby={`module-${module.id}-quiz-title`}>
      <header className="hub-assessment-header" style={{ '--module-color': module.color } as React.CSSProperties}>
        <div>
          <p>Module {module.id} checkpoint</p>
          <div className="hub-assessment-title-row">
            <span className="hub-assessment-icon"><Target aria-hidden="true" /></span>
            <h2 id={`module-${module.id}-quiz-title`}>{module.title}</h2>
          </div>
          <span>Five questions · Pass with 4 out of 5</span>
        </div>
      </header>

      {result !== null && (
        <div className={`hub-result-banner ${passed ? 'is-passed' : 'needs-review'}`} role="status">
          <strong>{passed ? 'Checkpoint passed' : 'Review and try again'}</strong>
          <span>You scored {result} out of {questions.length}.</span>
        </div>
      )}

      <form onSubmit={submit} className="hub-quiz-form">
        {questions.map((question, index) => (
          <QuestionBlock
            key={question.prompt}
            question={question}
            number={index + 1}
            selected={answers[index]}
            submitted={result !== null}
            onSelect={(option) => setAnswers((current) => ({ ...current, [index]: option }))}
          />
        ))}

        <div className="hub-quiz-actions">
          {result === null ? (
            <button className="hub-primary-button" type="submit" disabled={!isComplete}>
              Check my answers <ArrowRight size={19} aria-hidden="true" />
            </button>
          ) : (
            <>
              <button className="hub-secondary-button" type="button" onClick={retake}>
                <RotateCcw size={17} aria-hidden="true" /> Retake checkpoint
              </button>
              {passed && (
                <button className="hub-primary-button hub-continue-button" type="button" onClick={onContinue}>
                  Continue course <ArrowRight size={19} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </section>
  );
}

function FinalAssessment({
  savedScore,
  completedCount,
  passedModuleCount,
  onSaveScore,
}: {
  savedScore: number | null;
  completedCount: number;
  passedModuleCount: number;
  onSaveScore: (score: number) => void;
}) {
  const questions = finalQuestionLessonIds
    .map((lessonId) => allLessons.find((lesson) => lesson.id === lessonId)?.quiz)
    .filter((question): question is QuizQuestion => Boolean(question));
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(savedScore);
  const passingScore = Math.ceil(questions.length * 0.8);
  const passed = result !== null && result >= passingScore;
  const perfectScore = result === questions.length;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (Object.keys(answers).length !== questions.length) return;
    const score = questions.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0);
    setResult(score);
    onSaveScore(score);
  };

  const retake = () => {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="hub-assessment hub-final" aria-labelledby="final-assessment-title">
      <header className="hub-assessment-header" style={{ '--module-color': '#ccff00' } as React.CSSProperties}>
        <div>
          <p>Course finale</p>
          <div className="hub-assessment-title-row">
            <span className="hub-assessment-icon"><GraduationCap aria-hidden="true" /></span>
            <h2 id="final-assessment-title">Final assessment</h2>
          </div>
          <span>{questions.length} questions · Pass with 80%</span>
        </div>
      </header>

      <div className="hub-readiness-grid" aria-label="Course completion status">
        <div className={completedCount === allLessons.length ? 'is-ready' : ''}>
          <span>{completedCount}/{allLessons.length}</span>
          <p>Lessons complete</p>
        </div>
        <div className={passedModuleCount === courseModules.length ? 'is-ready' : ''}>
          <span>{passedModuleCount}/{courseModules.length}</span>
          <p>Checkpoints passed</p>
        </div>
      </div>

      {result !== null && (
        <div className={`hub-result-banner ${passed ? 'is-passed' : 'needs-review'}${perfectScore ? ' is-perfect' : ''}`} role="status">
          <strong>{perfectScore ? 'Perfect score!' : passed ? 'Assessment passed' : 'Keep learning'}</strong>
          <span>{perfectScore ? `You got all ${questions.length} questions correct.` : `You scored ${result} out of ${questions.length}.`}</span>
        </div>
      )}

      <form onSubmit={submit} className="hub-quiz-form">
        {questions.map((question, index) => (
          <QuestionBlock
            key={question.prompt}
            question={question}
            number={index + 1}
            selected={answers[index]}
            submitted={result !== null}
            onSelect={(option) => setAnswers((current) => ({ ...current, [index]: option }))}
          />
        ))}
        <div className="hub-quiz-actions">
          {result === null ? (
            <button className="hub-primary-button" type="submit" disabled={Object.keys(answers).length !== questions.length}>
              Finish assessment <ArrowRight size={19} aria-hidden="true" />
            </button>
          ) : (
            <button className="hub-secondary-button" type="button" onClick={retake}>
              <RotateCcw size={17} aria-hidden="true" /> Retake assessment
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function CourseRail({
  activeLessonId,
  completedLessonIds,
  activeScreen,
  quizModuleId,
  moduleScores,
  openModules,
  isOpen,
  onToggleModule,
  onSelectLesson,
  onSelectQuiz,
  onSelectFinal,
  finalUnlocked,
  onClose,
  onPointerLeave,
  mode = 'drawer',
}: {
  activeLessonId: string;
  completedLessonIds: Set<string>;
  activeScreen: 'lesson' | 'quiz' | 'final';
  quizModuleId: number;
  moduleScores: Record<string, number>;
  openModules: Set<number>;
  isOpen: boolean;
  onToggleModule: (moduleId: number) => void;
  onSelectLesson: (lesson: Lesson) => void;
  onSelectQuiz: (moduleId: number) => void;
  onSelectFinal: () => void;
  finalUnlocked: boolean;
  onClose: () => void;
  onPointerLeave: () => void;
  mode?: 'drawer' | 'embedded';
}) {
  const isHidden = !isOpen;

  return (
    <aside
      id="hub-course-contents"
      className={`hub-course-rail${isOpen ? ' is-open' : ''}${mode === 'embedded' ? ' is-embedded' : ''}`}
      aria-label="Course contents"
      aria-hidden={isHidden}
      inert={isHidden}
      onMouseLeave={onPointerLeave}
    >
      <div className="hub-rail-heading">
        <div>
          <span>Course contents</span>
          <strong>6 modules · 30 lessons</strong>
        </div>
        <button type="button" onClick={onClose} className="hub-rail-close" aria-label="Close course contents"><X /></button>
      </div>

      <nav className="hub-module-list" aria-label="Digital Accessibility Fundamentals curriculum">
        {courseModules.map((module) => {
          const isExpanded = openModules.has(module.id);
          const completeInModule = module.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
          const quizPassed = (moduleScores[String(module.id)] ?? 0) >= 4;
          return (
            <section className="hub-module" key={module.id} style={{ '--module-color': module.color } as React.CSSProperties}>
              <button className="hub-module-toggle" type="button" aria-expanded={isExpanded} onClick={() => onToggleModule(module.id)}>
                <span className="hub-module-number">{String(module.id).padStart(2, '0')}</span>
                <span className="hub-module-name">{module.title}<small>{completeInModule}/5 lessons</small></span>
                <ChevronDown className={isExpanded ? 'is-rotated' : ''} size={19} aria-hidden="true" />
              </button>
              {isExpanded && (
                <div className="hub-module-lessons">
                  {module.lessons.map((lesson) => {
                    const isActive = activeScreen === 'lesson' && activeLessonId === lesson.id;
                    const isComplete = completedLessonIds.has(lesson.id);
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => onSelectLesson(lesson)}
                        className={`hub-lesson-link${isActive ? ' is-active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span aria-hidden="true">{isComplete ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
                        <span>{lesson.title}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`hub-quiz-link${activeScreen === 'quiz' && quizModuleId === module.id ? ' is-active' : ''}`}
                    onClick={() => onSelectQuiz(module.id)}
                  >
                    <Target size={18} aria-hidden="true" /> Module checkpoint
                    {quizPassed && <Check size={17} aria-label="Passed" />}
                  </button>
                </div>
              )}
            </section>
          );
        })}

        <button
          type="button"
          className={`hub-final-link${activeScreen === 'final' ? ' is-active' : ''}${finalUnlocked ? '' : ' is-locked'}`}
          onClick={onSelectFinal}
          disabled={!finalUnlocked}
        >
          {finalUnlocked ? <GraduationCap aria-hidden="true" /> : <Lock aria-hidden="true" />}
          <span>Final assessment<small>{finalUnlocked ? 'Ready to begin' : 'Complete all lessons and checkpoints'}</small></span>
          {finalUnlocked ? <ArrowRight size={18} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}
        </button>
      </nav>
    </aside>
  );
}

function playLessonCompleteSound() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, now);
    oscillator.frequency.setValueAtTime(659.25, now + 0.1);
    oscillator.frequency.setValueAtTime(783.99, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.44);
    oscillator.addEventListener('ended', () => void audioContext.close(), { once: true });
  } catch {
    // Audio feedback is optional; lesson progression should never be blocked.
  }
}

function CourseOverview({
  completedLessonIds,
  moduleScores,
  finalScore,
  finalUnlocked,
  onSelectLesson,
  onSelectQuiz,
  onSelectFinal,
}: {
  completedLessonIds: Set<string>;
  moduleScores: Record<string, number>;
  finalScore: number | null;
  finalUnlocked: boolean;
  onSelectLesson: (lesson: Lesson) => void;
  onSelectQuiz: (moduleId: number) => void;
  onSelectFinal: () => void;
}) {
  return (
    <main id="learning-hub-main" className="hub-overview">
      <div className="hub-module-calendar">
        {courseModules.map((module) => {
          const checkpointPassed = (moduleScores[String(module.id)] ?? 0) >= 4;
          return (
            <section className="hub-calendar-module" key={module.id} style={{ '--module-color': module.color } as React.CSSProperties}>
              <header className="hub-calendar-module-heading">
                <span>{String(module.id).padStart(2, '0')}</span>
                <div className="hub-calendar-module-copy">
                  <h3>{module.title}</h3>
                  <small>{module.goal}</small>
                </div>
                <button type="button" onClick={() => onSelectQuiz(module.id)} className={checkpointPassed ? 'is-complete' : ''}>
                  <Target size={18} aria-hidden="true" />
                  <span>Checkpoint</span>
                  {checkpointPassed && <Check size={17} aria-label="Passed" />}
                </button>
              </header>

              <div className="hub-calendar-lessons">
                {module.lessons.map((lesson) => {
                  const isComplete = completedLessonIds.has(lesson.id);
                  return (
                    <button
                      type="button"
                      className={`hub-calendar-card${isComplete ? ' is-complete' : ''}`}
                      key={lesson.id}
                      onClick={() => onSelectLesson(lesson)}
                      aria-label={`Lesson ${lesson.number}: ${lesson.title}${isComplete ? ', completed' : ''}`}
                    >
                      <span className="hub-calendar-card-image">
                        <img
                          src={`/learning-hub/lessons/${lesson.sourceFolder}/1.png`}
                          alt=""
                          loading="lazy"
                        />
                        {isComplete && (
                          <span className="hub-calendar-complete-badge" aria-hidden="true">
                            <img src="/learning-hub/completed-badge.png" alt="" />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <button
        type="button"
        className={`hub-final-calendar-card${finalScore !== null ? ' has-score' : ''}${finalUnlocked ? '' : ' is-locked'}`}
        onClick={onSelectFinal}
        disabled={!finalUnlocked}
      >
        <span>{finalUnlocked ? <GraduationCap aria-hidden="true" /> : <Lock aria-hidden="true" />}</span>
        <div>
          <small>Course finale</small>
          <strong>Final assessment</strong>
          <p>{finalUnlocked ? 'Bring all six modules together in one final assessment.' : 'Complete all 30 lessons and pass all six module checkpoints to unlock.'}</p>
        </div>
        <span>{finalUnlocked ? (finalScore === null ? 'Start' : `Best score: ${finalScore}`) : 'Locked'} {finalUnlocked ? <ArrowRight aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}</span>
      </button>
    </main>
  );
}

export default function LearningHub({ header }: { header: React.ReactNode }) {
  const isLocalPreview = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const isAdminPreview = isLocalPreview && new URLSearchParams(window.location.search).get('admin') === '1';
  const initialProgress = useMemo(loadProgress, []);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(initialProgress.completedLessonIds);
  const [moduleScores, setModuleScores] = useState<Record<string, number>>(initialProgress.moduleScores);
  const [finalScore, setFinalScore] = useState<number | null>(initialProgress.finalScore);
  const [activeLessonId, setActiveLessonId] = useState(allLessons[0].id);
  const [screen, setScreen] = useState<'overview' | 'lesson' | 'quiz' | 'final'>(isAdminPreview ? 'final' : 'overview');
  const [quizModuleId, setQuizModuleId] = useState(1);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openModules, setOpenModules] = useState<Set<number>>(new Set([1]));
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const [isTakeawaysOpen, setIsTakeawaysOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.matchMedia('(max-width: 960px)').matches);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);

  const activeLesson = allLessons.find((lesson) => lesson.id === activeLessonId) ?? allLessons[0];
  const activeLessonIndex = allLessons.findIndex((lesson) => lesson.id === activeLesson.id);
  const activeModule = courseModules.find((module) => module.lessons.some((lesson) => lesson.id === activeLesson.id)) ?? courseModules[0];
  const quizModule = courseModules.find((module) => module.id === quizModuleId) ?? courseModules[0];
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const progressPercent = Math.round((completedLessonIds.length / allLessons.length) * 100);
  const passedModuleCount = Object.keys(moduleScores).filter((moduleId) => (moduleScores[moduleId] ?? 0) >= 4).length;
  const finalUnlocked = isAdminPreview || (completedLessonIds.length === allLessons.length && passedModuleCount === courseModules.length);

  useEffect(() => {
    document.title = 'Learning Hub | OneWeb';
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const updateViewport = () => setIsCompactViewport(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (isAdminPreview) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedLessonIds, moduleScores, finalScore }));
  }, [completedLessonIds, finalScore, isAdminPreview, moduleScores]);

  useEffect(() => {
    if (!isContentsOpen && !isTakeawaysOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsContentsOpen(false);
        setIsTakeawaysOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isContentsOpen, isTakeawaysOpen]);

  useEffect(() => {
    if (screen !== 'lesson') return;
    const previousOverflow = document.body.style.overflow;
    window.scrollTo({ top: 0 });
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [screen]);

  const selectLesson = (lesson: Lesson) => {
    const module = courseModules.find((item) => item.lessons.some((candidate) => candidate.id === lesson.id));
    setActiveLessonId(lesson.id);
    setCurrentSlide(0);
    setScreen('lesson');
    setIsContentsOpen(false);
    setIsTakeawaysOpen(false);
    if (module) setOpenModules((current) => new Set(current).add(module.id));
    window.scrollTo({ top: isCompactViewport ? 68 : 104, behavior: 'smooth' });
    window.setTimeout(() => lessonHeadingRef.current?.focus(), 350);
  };

  const selectQuiz = (moduleId: number) => {
    setQuizModuleId(moduleId);
    setScreen('quiz');
    setIsContentsOpen(false);
    setIsTakeawaysOpen(false);
    window.scrollTo({ top: 104, behavior: 'smooth' });
  };

  const showOverview = () => {
    setScreen('overview');
    setIsContentsOpen(false);
    setIsTakeawaysOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectFinal = () => {
    if (!finalUnlocked) {
      showOverview();
      return;
    }
    setScreen('final');
    setIsContentsOpen(false);
    setIsTakeawaysOpen(false);
    window.scrollTo({ top: 104, behavior: 'smooth' });
  };

  const goToAdjacentLesson = (offset: number) => {
    const nextLesson = allLessons[activeLessonIndex + offset];
    if (nextLesson) selectLesson(nextLesson);
  };

  const completeAndContinue = () => {
    playLessonCompleteSound();
    setCompletedLessonIds((current) => current.includes(activeLesson.id) ? current : [...current, activeLesson.id]);
    const isLastInModule = activeModule.lessons.at(-1)?.id === activeLesson.id;
    if (isLastInModule) {
      selectQuiz(activeModule.id);
    } else {
      goToAdjacentLesson(1);
    }
  };

  const slideTranscript = [
    `Lesson cover: ${activeLesson.title}.`,
    `Concept: ${activeLesson.summary}`,
    `Common barrier: ${activeLesson.barrier}`,
    `Accessible solution: ${activeLesson.solution}`,
  ][currentSlide];

  return (
    <div className={`learning-hub-page${screen === 'lesson' ? ' is-lesson-mode' : ''}`}>
      <a className="hub-skip-link" href="#learning-hub-main">Skip to course content</a>
      {screen !== 'lesson' && header}

      {screen === 'overview' && (
        <>
          <header className="hub-course-banner">
            <div className="hub-course-identity">
              <span className="hub-kicker"><Sparkles size={16} aria-hidden="true" /> OneWeb Accessibility Academy</span>
              <h1>Digital Accessibility Fundamentals</h1>
              <div className="hub-course-meta" aria-label="Course details">
                <span>Beginner</span><span>30 lessons</span><span>2–3 hours</span>
              </div>
            </div>
            <div className="hub-course-progress-card">
              <div><span>Your progress</span><strong>{completedLessonIds.length} of {allLessons.length}</strong></div>
              <ProgressBar value={progressPercent} label="Course progress" />
            </div>
          </header>

          <CourseOverview
            completedLessonIds={completedSet}
            moduleScores={moduleScores}
            finalScore={finalScore}
            finalUnlocked={finalUnlocked}
            onSelectLesson={selectLesson}
            onSelectQuiz={selectQuiz}
            onSelectFinal={selectFinal}
          />
        </>
      )}

      {screen === 'lesson' && (
        <>
          <header className="hub-lesson-toolbar">
            <button type="button" className="hub-back-to-map" onClick={showOverview}>
              <LayoutGrid size={19} aria-hidden="true" /> Course map
            </button>
            <div className="hub-lesson-toolbar-title">
              <p>Module {activeModule.id} · Lesson {activeLesson.number} · {activeLesson.minutes} min</p>
              <h1 id="hub-lesson-title" ref={lessonHeadingRef} tabIndex={-1}>{activeLesson.title}</h1>
            </div>
            <div className="hub-lesson-toolbar-actions">
              {isCompactViewport && (
                <>
                  <button type="button" onClick={() => setIsContentsOpen(true)} aria-label="Open course contents" aria-controls="hub-course-contents" aria-expanded={isContentsOpen}>
                    <PanelLeft size={20} aria-hidden="true" /><span>Course</span>
                  </button>
                  <button type="button" onClick={() => setIsTakeawaysOpen(true)} aria-label="Open lesson notes" aria-controls="hub-lesson-insights" aria-expanded={isTakeawaysOpen}>
                    <PanelRight size={20} aria-hidden="true" /><span>Lesson notes</span>
                  </button>
                </>
              )}
              <button type="button" className="hub-toolbar-complete" onClick={completeAndContinue}>
                <CheckCircle2 size={19} aria-hidden="true" />
                <span>{completedSet.has(activeLesson.id) ? 'Next lesson' : 'Complete lesson'}</span>
                <ArrowRight size={19} aria-hidden="true" />
              </button>
            </div>
          </header>

          {!isCompactViewport && !isContentsOpen && (
            <button
              type="button"
              className="hub-edge-tab hub-edge-tab-left"
              onClick={() => setIsContentsOpen(true)}
              aria-label="Open course contents"
              aria-controls="hub-course-contents"
              aria-expanded="false"
            >
              <PanelLeft size={34} aria-hidden="true" />
            </button>
          )}

          {!isCompactViewport && !isTakeawaysOpen && (
            <button
              type="button"
              className="hub-edge-tab hub-edge-tab-right"
              onClick={() => setIsTakeawaysOpen(true)}
              aria-label="Open lesson notes"
              aria-controls="hub-lesson-insights"
              aria-expanded="false"
            >
              <PanelRight size={30} aria-hidden="true" />
              <span>Notes</span>
            </button>
          )}

          {isCompactViewport && (isContentsOpen || isTakeawaysOpen) && (
            <button
              className="hub-drawer-scrim"
              type="button"
              onClick={() => {
                setIsContentsOpen(false);
                setIsTakeawaysOpen(false);
              }}
              aria-label="Close open course panel"
            />
          )}

          <main
            id="learning-hub-main"
            className={`hub-lesson-theater${isContentsOpen ? ' has-contents' : ''}${isTakeawaysOpen ? ' has-notes' : ''}`}
          >
            <CourseRail
              activeLessonId={activeLesson.id}
              completedLessonIds={completedSet}
              activeScreen="lesson"
              quizModuleId={quizModuleId}
              moduleScores={moduleScores}
              finalUnlocked={finalUnlocked}
              openModules={openModules}
              isOpen={isContentsOpen}
              mode={isCompactViewport ? 'drawer' : 'embedded'}
              onToggleModule={(moduleId) => setOpenModules((current) => {
                const next = new Set(current);
                if (next.has(moduleId)) next.delete(moduleId);
                else next.add(moduleId);
                return next;
              })}
              onSelectLesson={selectLesson}
              onSelectQuiz={selectQuiz}
              onSelectFinal={selectFinal}
              onClose={() => setIsContentsOpen(false)}
              onPointerLeave={() => undefined}
            />

            <article className="hub-visual-lesson" aria-labelledby="hub-lesson-title">
              <div
                className="hub-slide-workspace"
                tabIndex={0}
                aria-label="Four-slide visual lesson. Select the graphic to advance, or use the left and right arrow keys to change slides."
                onClick={() => setCurrentSlide((slide) => (slide + 1) % 4)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') setCurrentSlide((slide) => Math.max(0, slide - 1));
                  if (event.key === 'ArrowRight') setCurrentSlide((slide) => Math.min(3, slide + 1));
                }}
              >
                <div className="hub-slide-frame">
                  <img
                    key={`${activeLesson.id}-${currentSlide}`}
                    src={`/learning-hub/lessons/${activeLesson.sourceFolder}/${currentSlide + 1}.png`}
                    alt={`${activeLesson.title}, slide ${currentSlide + 1} of 4. ${slideTranscript}`}
                  />
                  <button
                    type="button"
                    className="hub-slide-arrow hub-slide-arrow-previous"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCurrentSlide((slide) => Math.max(0, slide - 1));
                    }}
                    disabled={currentSlide === 0}
                    aria-label="Previous lesson page"
                  >
                    <ArrowLeft aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="hub-slide-arrow hub-slide-arrow-next"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCurrentSlide((slide) => Math.min(3, slide + 1));
                    }}
                    disabled={currentSlide === 3}
                    aria-label="Next lesson page"
                  >
                    <ArrowRight aria-hidden="true" />
                  </button>
                  <span className="hub-slide-count">{currentSlide + 1} / 4</span>
                </div>
              </div>
            </article>

            <aside
              id="hub-lesson-insights"
              className={`hub-lesson-insights${isCompactViewport ? ' is-drawer' : ' is-embedded'}${isTakeawaysOpen ? ' is-open' : ''}`}
              aria-label="Lesson notes and takeaways"
              aria-hidden={!isTakeawaysOpen}
              inert={!isTakeawaysOpen}
            >
              <header className="hub-insights-heading">
                <div><span>Lesson notes</span><strong>{String(activeLesson.number).padStart(2, '0')} / {allLessons.length}</strong></div>
                <button type="button" onClick={() => setIsTakeawaysOpen(false)} aria-label="Close lesson notes"><X /></button>
              </header>

              <div className="hub-insights-body">
                <section className="hub-insight-card hub-takeaways">
                  <span className="hub-panel-icon"><Lightbulb aria-hidden="true" /></span>
                  <p className="hub-section-label">Remember</p>
                  <h2>Key takeaways</h2>
                  <ul>
                    {activeLesson.takeaways.map((takeaway) => <li key={takeaway}><Check size={18} aria-hidden="true" />{takeaway}</li>)}
                  </ul>
                </section>

                <section className="hub-insight-card">
                  <p className="hub-section-label">Concept</p>
                  <h2>The idea in plain language</h2>
                  <p>{activeLesson.summary}</p>
                </section>

                <section className="hub-insight-card hub-insight-barrier">
                  <p className="hub-section-label">Real barrier</p>
                  <p>{activeLesson.barrier}</p>
                </section>

                <section className="hub-insight-card hub-insight-solution">
                  <p className="hub-section-label">Accessible solution</p>
                  <p>{activeLesson.solution}</p>
                </section>
              </div>

            </aside>
          </main>
        </>
      )}

      {(screen === 'quiz' || screen === 'final') && (
        <>
          <header className="hub-assessment-toolbar">
            <button type="button" className="hub-back-to-map" onClick={showOverview}>
              <LayoutGrid size={19} aria-hidden="true" /> Course map
            </button>
            <div>
              <span>OneWeb Accessibility Academy</span>
              <strong>{screen === 'quiz' ? `Module ${quizModule.id} checkpoint` : 'Final assessment'}</strong>
            </div>
          </header>
          <main id="learning-hub-main" className="hub-assessment-page">
            {screen === 'quiz' ? (
              <QuizPanel
                key={quizModule.id}
                module={quizModule}
                savedScore={moduleScores[String(quizModule.id)]}
                onSaveScore={(score) => setModuleScores((current) => ({ ...current, [String(quizModule.id)]: Math.max(current[String(quizModule.id)] ?? 0, score) }))}
                onContinue={() => {
                  const nextModule = courseModules.find((module) => module.id === quizModule.id + 1);
                  if (nextModule) selectLesson(nextModule.lessons[0]);
                  else selectFinal();
                }}
              />
            ) : (
              <FinalAssessment
                savedScore={finalScore}
                completedCount={isAdminPreview ? allLessons.length : completedLessonIds.length}
                passedModuleCount={isAdminPreview ? courseModules.length : passedModuleCount}
                onSaveScore={(score) => setFinalScore((current) => Math.max(current ?? 0, score))}
              />
            )}
          </main>
        </>
      )}

      {screen !== 'lesson' && (
        <footer className="hub-footer">
          <p>© {new Date().getFullYear()} OneWeb. All rights reserved.</p>
        </footer>
      )}
    </div>
  );
}
