"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { QUIZ_PASS_SCORE_MAX, QUIZ_PASS_SCORE_MIN } from "@getownly/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { createQuiz, updateQuiz } from "@/lib/catalog/api";
import type { Quiz, QuizInput } from "@/lib/catalog/types";
import { authMessages } from "@/lib/messages/auth";
import { instructorMessages } from "@/lib/messages/instructor";
import { cn } from "@/lib/utils";

/**
 * The quiz authoring form (ทก.01 A7).
 *
 * Every rule enforced here also exists on the API — this only spares the
 * instructor a round trip, and the tests that matter fire at the endpoint
 * rather than at this file.
 *
 * The one rule the form owns outright is what it *offers*: once a quiz has
 * been sat, the question fields render read-only with an explanation rather
 * than as disabled inputs with no reason given.
 */

const MAX_QUESTIONS = 50;
const MAX_CHOICES = 6;
const MIN_CHOICES = 2;

interface DraftChoice {
  choiceText: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  questionText: string;
  choices: DraftChoice[];
}

interface Draft {
  title: string;
  passScore: number;
  questions: DraftQuestion[];
}

function blankQuestion(): DraftQuestion {
  return {
    questionText: "",
    choices: [
      { choiceText: "", isCorrect: true },
      { choiceText: "", isCorrect: false },
    ],
  };
}

function draftFrom(quiz: Quiz | null): Draft {
  if (!quiz) {
    return { title: "", passScore: QUIZ_PASS_SCORE_MIN, questions: [blankQuestion()] };
  }

  return {
    title: quiz.title,
    passScore: quiz.passScore,
    questions: quiz.questions.map((question) => ({
      questionText: question.questionText,
      choices: question.choices.map((choice) => ({
        choiceText: choice.choiceText,
        isCorrect: choice.isCorrect,
      })),
    })),
  };
}

/** Fills `{name}` placeholders in a message. */
function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

/**
 * The same checks the API makes, in the same order, so the message the
 * instructor sees before saving matches the one they would get after.
 * Returns the first problem, because fixing one at a time is how the form
 * is actually used.
 */
function firstProblem(draft: Draft): string | null {
  const { validation } = instructorMessages.quizzes;

  if (draft.title.trim().length === 0) {
    return validation.titleRequired;
  }
  if (draft.title.trim().length < 3) {
    return validation.titleTooShort;
  }
  if (draft.passScore < QUIZ_PASS_SCORE_MIN || draft.passScore > QUIZ_PASS_SCORE_MAX) {
    return fill(validation.passScoreRange, {
      min: QUIZ_PASS_SCORE_MIN,
      max: QUIZ_PASS_SCORE_MAX,
    });
  }
  if (draft.questions.length === 0) {
    return validation.noQuestions;
  }

  for (const [index, question] of draft.questions.entries()) {
    const position = index + 1;
    const text = question.questionText.trim();

    if (text.length === 0) {
      return fill(validation.questionRequired, { index: position });
    }
    if (text.length < 5) {
      return fill(validation.questionTooShort, { index: position });
    }

    const texts = question.choices.map((choice) => choice.choiceText.trim());
    if (texts.some((choice) => choice.length === 0)) {
      return fill(validation.choiceRequired, { index: position });
    }
    if (new Set(texts).size !== texts.length) {
      return fill(validation.choiceDuplicate, { index: position });
    }
    if (!question.choices.some((choice) => choice.isCorrect)) {
      return fill(validation.noCorrect, { index: position });
    }
  }

  return null;
}

export function QuizForm({
  lessonId,
  quiz,
  attemptCount,
  onSaved,
  onCancel,
}: {
  lessonId: string;
  /** Null when authoring a new quiz. */
  quiz: Quiz | null;
  /** Above zero, the paper is frozen and only the heading may change. */
  attemptCount: number;
  onSaved: (saved: Quiz) => void;
  onCancel: () => void;
}) {
  const messages = instructorMessages.quizzes;
  const form = messages.form;
  const toast = useToast();

  const [draft, setDraft] = useState<Draft>(() => draftFrom(quiz));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = attemptCount > 0;
  const initial = useMemo(() => JSON.stringify(draftFrom(quiz)), [quiz]);
  const isDirty = JSON.stringify(draft) !== initial;

  // Closing the tab with unsaved edits asks first. The browser supplies its
  // own wording; the message below is what an in-app cancel shows.
  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function patchQuestion(index: number, patch: Partial<DraftQuestion>) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, position) =>
        position === index ? { ...question, ...patch } : question,
      ),
    }));
  }

  function patchChoice(questionIndex: number, choiceIndex: number, choiceText: string) {
    const question = draft.questions[questionIndex];
    patchQuestion(questionIndex, {
      choices: question.choices.map((choice, position) =>
        position === choiceIndex ? { ...choice, choiceText } : choice,
      ),
    });
  }

  /** Exactly one right answer per question, so picking one clears the rest. */
  function markCorrect(questionIndex: number, choiceIndex: number) {
    const question = draft.questions[questionIndex];
    patchQuestion(questionIndex, {
      choices: question.choices.map((choice, position) => ({
        ...choice,
        isCorrect: position === choiceIndex,
      })),
    });
  }

  function addChoice(questionIndex: number) {
    const question = draft.questions[questionIndex];
    if (question.choices.length >= MAX_CHOICES) {
      setError(fill(form.maxChoicesReached, { max: MAX_CHOICES }));
      return;
    }
    patchQuestion(questionIndex, {
      choices: [...question.choices, { choiceText: "", isCorrect: false }],
    });
  }

  function removeChoice(questionIndex: number, choiceIndex: number) {
    const question = draft.questions[questionIndex];
    if (question.choices.length <= MIN_CHOICES) {
      setError(fill(form.minChoicesReached, { min: MIN_CHOICES }));
      return;
    }

    const remaining = question.choices.filter((_, position) => position !== choiceIndex);
    // Removing the right answer would leave the question with none, so the
    // first survivor inherits it rather than the form entering a state the
    // API would refuse.
    if (!remaining.some((choice) => choice.isCorrect)) {
      remaining[0] = { ...remaining[0], isCorrect: true };
    }
    patchQuestion(questionIndex, { choices: remaining });
  }

  function addQuestion() {
    if (draft.questions.length >= MAX_QUESTIONS) {
      setError(fill(form.maxQuestionsReached, { max: MAX_QUESTIONS }));
      return;
    }
    setDraft((current) => ({ ...current, questions: [...current.questions, blankQuestion()] }));
  }

  function removeQuestion(index: number) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.filter((_, position) => position !== index),
    }));
  }

  async function save() {
    const problem = firstProblem(draft);
    if (problem !== null) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    const payload: QuizInput = {
      title: draft.title.trim(),
      passScore: draft.passScore,
      questions: draft.questions.map((question) => ({
        questionText: question.questionText.trim(),
        choices: question.choices.map((choice) => ({
          choiceText: choice.choiceText.trim(),
          isCorrect: choice.isCorrect,
        })),
      })),
    };

    try {
      const saved = quiz
        ? // A frozen quiz sends only its heading; sending questions it cannot
          // change would be refused, and refused for the right reason.
          await updateQuiz(
            quiz.id,
            locked ? { title: payload.title, passScore: payload.passScore } : payload,
          )
        : await createQuiz(lessonId, payload);

      toast.success(form.saved);
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (isDirty && !window.confirm(form.unsavedWarning)) {
      return;
    }
    onCancel();
  }

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-foreground">
        {quiz ? form.editTitle : form.createTitle}
      </h3>

      {locked && (
        <Alert tone="pending">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {fill(messages.lockedBody, { count: attemptCount })}
            <span className="mt-1 block text-xs">{messages.lockedFieldsNote}</span>
          </span>
        </Alert>
      )}

      {error !== null && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field id="quiz-title" label={form.titleLabel}>
          <Input
            id="quiz-title"
            value={draft.title}
            placeholder={form.titlePlaceholder}
            maxLength={150}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>

        <Field
          id="quiz-pass-score"
          label={form.passScoreLabel}
          hint={fill(form.passScoreHint, {
            min: QUIZ_PASS_SCORE_MIN,
            max: QUIZ_PASS_SCORE_MAX,
          })}
        >
          <Input
            id="quiz-pass-score"
            type="number"
            inputMode="numeric"
            className="sm:w-32"
            min={QUIZ_PASS_SCORE_MIN}
            max={QUIZ_PASS_SCORE_MAX}
            value={draft.passScore}
            onChange={(event) =>
              setDraft({ ...draft, passScore: Number(event.target.value) || 0 })
            }
          />
        </Field>
      </div>

      {locked && <p className="text-xs text-muted">{messages.passScoreAppliesNext}</p>}

      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-foreground">{form.questionsHeading}</h4>

        {draft.questions.map((question, questionIndex) => (
          <fieldset
            key={questionIndex}
            className="flex flex-col gap-3 rounded-card border border-border bg-background p-4"
          >
            <legend className="px-1 text-xs font-medium text-muted">
              {form.questionLabel} {questionIndex + 1}
            </legend>

            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                value={question.questionText}
                readOnly={locked}
                placeholder={form.questionPlaceholder}
                maxLength={500}
                aria-label={`${form.questionLabel} ${questionIndex + 1}`}
                className={cn("flex-1", locked && "bg-card text-muted")}
                onChange={(event) =>
                  patchQuestion(questionIndex, { questionText: event.target.value })
                }
              />
              {!locked && draft.questions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={form.removeQuestion}
                  title={form.removeQuestion}
                  onClick={() => removeQuestion(questionIndex)}
                >
                  <Trash2 aria-hidden className="size-4 text-destructive" />
                </Button>
              )}
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">
                {form.choiceLabel} {questionIndex + 1}
              </legend>
              <p className="text-xs text-subtle">{form.correctHint}</p>

              {question.choices.map((choice, choiceIndex) => (
                <div key={choiceIndex} className="flex items-center gap-2">
                  {/* A radio group per question is the control that already
                      means "exactly one of these", so the rule is expressed by
                      the widget rather than policed after the fact. */}
                  <input
                    type="radio"
                    name={`correct-${questionIndex}`}
                    checked={choice.isCorrect}
                    disabled={locked}
                    aria-label={`${form.correctLabel} ${choiceIndex + 1}`}
                    className="size-4 shrink-0 accent-primary"
                    onChange={() => markCorrect(questionIndex, choiceIndex)}
                  />
                  <Input
                    value={choice.choiceText}
                    readOnly={locked}
                    placeholder={`${form.choicePlaceholder} ${choiceIndex + 1}`}
                    maxLength={300}
                    aria-label={`${form.choiceLabel} ${choiceIndex + 1}`}
                    className={cn("flex-1", locked && "bg-card text-muted")}
                    onChange={(event) =>
                      patchChoice(questionIndex, choiceIndex, event.target.value)
                    }
                  />
                  {!locked && question.choices.length > MIN_CHOICES && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={form.removeChoice}
                      title={form.removeChoice}
                      onClick={() => removeChoice(questionIndex, choiceIndex)}
                    >
                      <Trash2 aria-hidden className="size-4 text-subtle" />
                    </Button>
                  )}
                </div>
              ))}

              {!locked && question.choices.length < MAX_CHOICES && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => addChoice(questionIndex)}
                >
                  <Plus aria-hidden className="size-4" />
                  {form.addChoice}
                </Button>
              )}
            </fieldset>
          </fieldset>
        ))}

        {!locked && (
          <Button variant="outline" className="self-start" onClick={addQuestion}>
            <Plus aria-hidden className="size-4" />
            {form.addQuestion}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={cancel} disabled={saving}>
          {form.cancel}
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? form.saving : form.save}
        </Button>
      </div>
    </div>
  );
}
