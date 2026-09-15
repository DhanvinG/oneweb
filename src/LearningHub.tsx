import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  GraduationCap,
  Lightbulb,
  List,
  Menu,
  Printer,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { allLessons, courseModules, finalQuestionLessonIds, type CourseModule, type Lesson, type QuizQuestion } from './learningHubData';
import './learning-hub.css';

const STORAGE_KEY = 'oneweb-learning-hub-progress-v1';

type StoredProgress = {
  completedLessonIds: string[];
  moduleScores: Record<string, number>;
  finalScore: number | null;
  learnerName: string;
};

const emptyProgress: StoredProgress = {
  completedLessonIds: [],
  moduleScores: {},
  finalScore: null,
  learnerName: '',
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
      learnerName: typeof parsed.learnerName === 'string' ? parsed.learnerName : '',
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
        <span className="hub-assessment-icon"><Target aria-hidden="true" /></span>
        <div>
          <p>Module {module.id} checkpoint</p>
          <h2 id={`module-${module.id}-quiz-title`}>{module.title}</h2>
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
              <button className="hub-secondary-button" type="button" onClick={retake}>Retake checkpoint</button>
              {passed && (
                <button className="hub-primary-button" type="button" onClick={onContinue}>
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

function Certificate({ learnerName }: { learnerName: string }) {
  return (
    <section className="hub-certificate" aria-labelledby="certificate-title">
      <div className="hub-certificate-seal" aria-hidden="true"><Trophy /></div>
      <p>OneWeb Accessibility Academy</p>
      <h2 id="certificate-title">Certificate of Completion</h2>
      <span>This certifies that</span>
      <strong>{learnerName.trim() || 'Course learner'}</strong>
      <span>completed</span>
      <h3>Digital Accessibility Fundamentals</h3>
      <p>30 lessons · 6 module checkpoints · final assessment</p>
      <div className="hub-certificate-signature">
        <span>OneWeb</span>
        <span>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
    </section>
  );
}

function FinalAssessment({
  savedScore,
  completedCount,
  passedModuleCount,
  learnerName,
  onNameChange,
  onSaveScore,
}: {
  savedScore: number | null;
  completedCount: number;
  passedModuleCount: number;
  learnerName: string;
  onNameChange: (name: string) => void;
  onSaveScore: (score: number) => void;
}) {
  const questions = finalQuestionLessonIds
    .map((lessonId) => allLessons.find((lesson) => lesson.id === lessonId)?.quiz)
    .filter((question): question is QuizQuestion => Boolean(question));
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(savedScore);
  const passingScore = Math.ceil(questions.length * 0.8);
  const passed = result !== null && result >= passingScore;
  const certificateReady = passed && completedCount === allLessons.length && passedModuleCount === courseModules.length;

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
        <span className="hub-assessment-icon"><GraduationCap aria-hidden="true" /></span>
        <div>
          <p>Course finale</p>
          <h2 id="final-assessment-title">Final assessment</h2>
          <span>{questions.length} questions · Pass with 80%</span>
        </div>
      </header>

      <div className="hub-readiness-grid" aria-label="Certificate requirements">
        <div className={completedCount === allLessons.length ? 'is-ready' : ''}>
          <span>{completedCount}/{allLessons.length}</span>
          <p>Lessons complete</p>
        </div>
        <div className={passedModuleCount === courseModules.length ? 'is-ready' : ''}>
          <span>{passedModuleCount}/{courseModules.length}</span>
          <p>Checkpoints passed</p>
        </div>
        <div className={passed ? 'is-ready' : ''}>
          <span>{result === null ? '—' : `${Math.round((result / questions.length) * 100)}%`}</span>
          <p>Final assessment</p>
        </div>
      </div>

      {result !== null && (
        <div className={`hub-result-banner ${passed ? 'is-passed' : 'needs-review'}`} role="status">
          <strong>{passed ? 'Assessment passed' : 'Keep learning'}</strong>
          <span>You scored {result} out of {questions.length}.</span>
        </div>
      )}

      {certificateReady ? (
        <div className="hub-certificate-area">
          <label className="hub-name-field">
            <span>Name for your certificate</span>
            <input value={learnerName} onChange={(event) => onNameChange(event.target.value)} placeholder="Your name" />
          </label>
          <Certificate learnerName={learnerName} />
          <button className="hub-primary-button hub-print-button" type="button" onClick={() => window.print()}>
            <Printer size={19} aria-hidden="true" /> Print certificate
          </button>
        </div>
      ) : (
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
              <button className="hub-secondary-button" type="button" onClick={retake}>Retake assessment</button>
            )}
          </div>
        </form>
      )}
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
  onClose,
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
  onClose: () => void;
}) {
  return (
    <aside className={`hub-course-rail${isOpen ? ' is-open' : ''}`} aria-label="Course contents">
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

        <button type="button" className={`hub-final-link${activeScreen === 'final' ? ' is-active' : ''}`} onClick={onSelectFinal}>
          <GraduationCap aria-hidden="true" />
          <span>Final assessment<small>Unlock your certificate</small></span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </nav>
    </aside>
  );
}

export default function LearningHub({ header }: { header: React.ReactNode }) {
  const initialProgress = useMemo(loadProgress, []);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(initialProgress.completedLessonIds);
  const [moduleScores, setModuleScores] = useState<Record<string, number>>(initialProgress.moduleScores);
  const [finalScore, setFinalScore] = useState<number | null>(initialProgress.finalScore);
  const [learnerName, setLearnerName] = useState(initialProgress.learnerName);
  const [activeLessonId, setActiveLessonId] = useState(allLessons[0].id);
  const [screen, setScreen] = useState<'lesson' | 'quiz' | 'final'>('lesson');
  const [quizModuleId, setQuizModuleId] = useState(1);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openModules, setOpenModules] = useState<Set<number>>(new Set([1]));
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);

  const activeLesson = allLessons.find((lesson) => lesson.id === activeLessonId) ?? allLessons[0];
  const activeLessonIndex = allLessons.findIndex((lesson) => lesson.id === activeLesson.id);
  const activeModule = courseModules.find((module) => module.lessons.some((lesson) => lesson.id === activeLesson.id)) ?? courseModules[0];
  const quizModule = courseModules.find((module) => module.id === quizModuleId) ?? courseModules[0];
  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const progressPercent = Math.round((completedLessonIds.length / allLessons.length) * 100);
  const passedModuleCount = Object.values(moduleScores).filter((score) => score >= 4).length;

  useEffect(() => {
    document.title = 'Learning Hub | OneWeb';
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedLessonIds, moduleScores, finalScore, learnerName }));
  }, [completedLessonIds, finalScore, learnerName, moduleScores]);

  useEffect(() => {
    if (!isContentsOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsContentsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isContentsOpen]);

  const selectLesson = (lesson: Lesson) => {
    const module = courseModules.find((item) => item.lessons.some((candidate) => candidate.id === lesson.id));
    setActiveLessonId(lesson.id);
    setCurrentSlide(0);
    setScreen('lesson');
    setIsContentsOpen(false);
    if (module) setOpenModules((current) => new Set(current).add(module.id));
    window.scrollTo({ top: 104, behavior: 'smooth' });
    window.setTimeout(() => lessonHeadingRef.current?.focus(), 350);
  };

  const selectQuiz = (moduleId: number) => {
    setQuizModuleId(moduleId);
    setScreen('quiz');
    setIsContentsOpen(false);
    window.scrollTo({ top: 104, behavior: 'smooth' });
  };

  const goToAdjacentLesson = (offset: number) => {
    const nextLesson = allLessons[activeLessonIndex + offset];
    if (nextLesson) selectLesson(nextLesson);
  };

  const completeAndContinue = () => {
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
    <div className="learning-hub-page">
      <a className="hub-skip-link" href="#learning-hub-main">Skip to course lesson</a>
      {header}

      <header className="hub-course-banner">
        <div className="hub-course-identity">
          <span className="hub-kicker"><Sparkles size={16} aria-hidden="true" /> OneWeb Accessibility Academy</span>
          <h1>Digital Accessibility Fundamentals</h1>
          <div className="hub-course-meta" aria-label="Course details">
            <span>Beginner</span><span>30 lessons</span><span>2–3 hours</span><span>Free</span>
          </div>
        </div>
        <div className="hub-course-progress-card">
          <div><span>Your progress</span><strong>{completedLessonIds.length} of {allLessons.length}</strong></div>
          <ProgressBar value={progressPercent} label="Course progress" />
        </div>
        <button className="hub-contents-button" type="button" onClick={() => setIsContentsOpen(true)} aria-expanded={isContentsOpen}>
          <Menu size={20} aria-hidden="true" /> Contents
        </button>
      </header>

      {isContentsOpen && <button className="hub-drawer-scrim" type="button" onClick={() => setIsContentsOpen(false)} aria-label="Close course contents" />}

      <main id="learning-hub-main" className="hub-course-layout">
        <CourseRail
          activeLessonId={activeLesson.id}
          completedLessonIds={completedSet}
          activeScreen={screen}
          quizModuleId={quizModuleId}
          moduleScores={moduleScores}
          openModules={openModules}
          isOpen={isContentsOpen}
          onToggleModule={(moduleId) => setOpenModules((current) => {
            const next = new Set(current);
            if (next.has(moduleId)) next.delete(moduleId);
            else next.add(moduleId);
            return next;
          })}
          onSelectLesson={selectLesson}
          onSelectQuiz={selectQuiz}
          onSelectFinal={() => {
            setScreen('final');
            setIsContentsOpen(false);
            window.scrollTo({ top: 104, behavior: 'smooth' });
          }}
          onClose={() => setIsContentsOpen(false)}
        />

        <div className="hub-learning-surface">
          {screen === 'lesson' && (
            <article className="hub-lesson" aria-labelledby="hub-lesson-title">
              <header className="hub-lesson-header">
                <div>
                  <p>Module {activeModule.id} · Lesson {activeLesson.number} of {allLessons.length}</p>
                  <h2 id="hub-lesson-title" ref={lessonHeadingRef} tabIndex={-1}>{activeLesson.title}</h2>
                  <span><Clock3 size={17} aria-hidden="true" /> {activeLesson.minutes} minutes</span>
                </div>
                <div className="hub-lesson-stepper" aria-label="Lesson navigation">
                  <button type="button" onClick={() => goToAdjacentLesson(-1)} disabled={activeLessonIndex === 0} aria-label="Previous lesson"><ArrowLeft /></button>
                  <span>{String(activeLesson.number).padStart(2, '0')} / {allLessons.length}</span>
                  <button type="button" onClick={() => goToAdjacentLesson(1)} disabled={activeLessonIndex === allLessons.length - 1} aria-label="Next lesson"><ArrowRight /></button>
                </div>
              </header>

              <div
                className="hub-slide-workspace"
                tabIndex={0}
                aria-label="Four-slide visual lesson. Use the left and right arrow keys to change slides."
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
                  <span className="hub-slide-count">{currentSlide + 1} / 4</span>
                </div>
                <div className="hub-slide-controls">
                  <button type="button" onClick={() => setCurrentSlide((slide) => Math.max(0, slide - 1))} disabled={currentSlide === 0}>
                    <ArrowLeft size={20} aria-hidden="true" /> Previous
                  </button>
                  <div className="hub-slide-dots" aria-label="Choose a lesson slide">
                    {[0, 1, 2, 3].map((slide) => (
                      <button
                        key={slide}
                        type="button"
                        className={currentSlide === slide ? 'is-active' : ''}
                        onClick={() => setCurrentSlide(slide)}
                        aria-label={`Slide ${slide + 1}`}
                        aria-current={currentSlide === slide ? 'true' : undefined}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => setCurrentSlide((slide) => Math.min(3, slide + 1))} disabled={currentSlide === 3}>
                    Next <ArrowRight size={20} aria-hidden="true" />
                  </button>
                </div>
                <details className="hub-slide-transcript">
                  <summary>Accessible summary for this graphic</summary>
                  <p>{slideTranscript}</p>
                </details>
              </div>

              <section className="hub-concept-block" aria-labelledby="lesson-concept-title">
                <p className="hub-section-label">Concept</p>
                <h3 id="lesson-concept-title">The idea in plain language</h3>
                <p>{activeLesson.summary}</p>
                <div className="hub-barrier-solution">
                  <div>
                    <span>Real barrier</span>
                    <p>{activeLesson.barrier}</p>
                  </div>
                  <div>
                    <span>Accessible solution</span>
                    <p>{activeLesson.solution}</p>
                  </div>
                </div>
              </section>
            </article>
          )}

          {screen === 'quiz' && (
            <QuizPanel
              key={quizModule.id}
              module={quizModule}
              savedScore={moduleScores[String(quizModule.id)]}
              onSaveScore={(score) => setModuleScores((current) => ({ ...current, [String(quizModule.id)]: Math.max(current[String(quizModule.id)] ?? 0, score) }))}
              onContinue={() => {
                const nextModule = courseModules.find((module) => module.id === quizModule.id + 1);
                if (nextModule) selectLesson(nextModule.lessons[0]);
                else setScreen('final');
              }}
            />
          )}

          {screen === 'final' && (
            <FinalAssessment
              savedScore={finalScore}
              completedCount={completedLessonIds.length}
              passedModuleCount={passedModuleCount}
              learnerName={learnerName}
              onNameChange={setLearnerName}
              onSaveScore={(score) => setFinalScore((current) => Math.max(current ?? 0, score))}
            />
          )}
        </div>

        {screen === 'lesson' && (
          <aside className="hub-practice-panel" aria-label="Lesson practice">
            <section className="hub-takeaways">
              <span className="hub-panel-icon"><Lightbulb aria-hidden="true" /></span>
              <p className="hub-section-label">Remember</p>
              <h3>Key takeaways</h3>
              <ul>
                {activeLesson.takeaways.map((takeaway) => <li key={takeaway}><Check size={18} aria-hidden="true" />{takeaway}</li>)}
              </ul>
            </section>

            <button className="hub-complete-button" type="button" onClick={completeAndContinue}>
              {completedSet.has(activeLesson.id) ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
              <span>{completedSet.has(activeLesson.id) ? 'Continue' : 'Complete & continue'}<small>{activeModule.lessons.at(-1)?.id === activeLesson.id ? 'Go to module checkpoint' : 'Go to next lesson'}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
          </aside>
        )}
      </main>

      <footer className="hub-footer">
        <span>OneWeb Accessibility Academy</span>
        <p>Learn the fundamentals. Practice one barrier at a time.</p>
        <a href="/">Back to OneWeb</a>
      </footer>
    </div>
  );
}
