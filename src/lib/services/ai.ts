import {
  AgentPlatformBackend,
  AIError,
  getAI,
  getGenerativeModel,
  type ChatSession,
  type GenerativeModel,
} from "firebase/ai";
import { firebaseApp } from "@/lib/firebase/client";
import { ValidationError } from "@/lib/errors";

/**
 * AI study assistant, powered by Gemini on Vertex AI (Google's "Agent Platform
 * Gemini API") through Firebase AI Logic. Requests go straight from the
 * browser to Google with the user's Firebase credentials — no API key is
 * shipped — and are protected by App Check when it is enabled.
 *
 * Setup: Firebase console → AI Logic → Get started → Vertex AI Gemini API
 * (requires the Blaze plan).
 */
export const AI_MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-3.8-flash";
const AI_LOCATION = process.env.NEXT_PUBLIC_AI_LOCATION || "global";

const MAX_LESSON_CHARS = 30_000;
const MAX_TRANSCRIPT_CHARS = 80_000;

function model(systemInstruction: string, maxOutputTokens: number): GenerativeModel {
  const ai = getAI(firebaseApp(), { backend: new AgentPlatformBackend(AI_LOCATION) });
  return getGenerativeModel(ai, {
    model: AI_MODEL,
    systemInstruction,
    generationConfig: { temperature: 0.4, maxOutputTokens },
  });
}

export interface LessonContext {
  courseTitle: string;
  moduleTitle?: string | null;
  lessonTitle: string;
  lessonType: "video" | "article";
  body?: string | null;
  transcript?: string | null;
  learnerName?: string;
}

function tutorInstruction(ctx: LessonContext): string {
  const body = (ctx.body ?? "").trim().slice(0, MAX_LESSON_CHARS);
  const transcript = (ctx.transcript ?? "").trim().slice(0, MAX_TRANSCRIPT_CHARS);
  return [
    `You are a friendly, precise study assistant inside a learning platform. You are helping ${ctx.learnerName || "a learner"} with one specific lesson.`,
    "",
    `Course: ${ctx.courseTitle}`,
    ctx.moduleTitle ? `Module: ${ctx.moduleTitle}` : "",
    `Lesson: ${ctx.lessonTitle} (${ctx.lessonType === "video" ? "video lesson" : "reading"})`,
    "",
    "How to help:",
    "- Ground your answers in the lesson material below. When the material doesn't cover something, say so, then give a brief, clearly-labelled general explanation.",
    "- Explain step by step in plain language; use short paragraphs, bullet points and examples. Use Markdown.",
    "- For a video lesson you can only use the transcript/notes below — you cannot see the video itself. When the transcript has timestamps, cite them (e.g. “around 03:20”). If no transcript is provided, say you can't see the video and answer from the written notes.",
    "- Messages may start with the learner's current position in the video, like [Video position 03:25]; use it to work out what “this part” or “what he just said” refers to.",
    "- If asked to quiz the learner, ask one question at a time and wait for the answer.",
    "- Never write graded coursework or assignment submissions for the learner — coach them towards their own answer instead.",
    "- Safety-critical topics (e.g. high-voltage work): always remind the learner to follow their instructor's procedures and workshop safety rules.",
    "- Keep answers focused; stay on the course subject and politely decline unrelated requests.",
    "",
    "=== LESSON NOTES ===",
    body || "(no written notes for this lesson)",
    "",
    "=== VIDEO TRANSCRIPT ===",
    transcript || "(no transcript available)",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Start a tutoring conversation for a lesson. */
export function startLessonChat(ctx: LessonContext): ChatSession {
  return model(tutorInstruction(ctx), 2048).startChat();
}

/** Send a message and stream the reply; `onText` receives the accumulated answer. */
export async function askTutor(chat: ChatSession, message: string, onText: (text: string) => void): Promise<string> {
  const result = await chat.sendMessageStream(message);
  let answer = "";
  for await (const chunk of result.stream) {
    answer += chunk.text();
    onText(answer);
  }
  return answer;
}

/** gs:// URI + mime type for a video uploaded to this project's Cloud Storage. */
export function storageVideoUri(url: string | null | undefined): { uri: string; mimeType: string } | null {
  if (!url) return null;
  const match = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
  if (!match) return null;
  const path = decodeURIComponent(match[2]);
  const mimeType = /\.webm$/i.test(path) ? "video/webm" : /\.mp4$/i.test(path) ? "video/mp4" : null;
  return mimeType ? { uri: `gs://${match[1]}/${path}`, mimeType } : null;
}

/**
 * Generate a timestamped transcript for an uploaded lesson video (staff
 * tooling). The transcript is saved with the lesson and is what the study
 * assistant uses to answer questions about the video.
 */
export async function generateTranscript(videoUrl: string, onText: (text: string) => void): Promise<string> {
  const video = storageVideoUri(videoUrl);
  if (!video) {
    throw new ValidationError(
      "AI transcripts can be generated for videos uploaded to the platform. For YouTube or Vimeo videos, paste the transcript instead.",
    );
  }
  const result = await model(
    "You are a meticulous transcriber for educational videos. Output plain text only.",
    16_000,
  ).generateContentStream([
    { type: "fileData", fileData: { mimeType: video.mimeType, fileUri: video.uri } },
    {
      type: "text",
      text:
        "Transcribe this lesson video for learners. Start a new line roughly every 20–40 seconds, each beginning with a [MM:SS] timestamp. " +
        "Include what is said and, in (parentheses), briefly describe anything important that is only shown on screen — diagrams, readings, code or demonstrations. " +
        "Do not add an introduction or a summary.",
    },
  ]);
  let transcript = "";
  for await (const chunk of result.stream) {
    transcript += chunk.text();
    onText(transcript);
  }
  return transcript.trim();
}

/** User-facing message for an AI failure. */
export function aiErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  // The raw error helps administrators diagnose setup problems (browser console).
  console.warn("[AI assistant]", error);
  const text = (error instanceof Error ? `${(error as AIError).code ?? ""} ${error.message}` : String(error)).toLowerCase();

  if (text.includes("genai config not found") || text.includes("api-not-enabled") || text.includes("not been used") || text.includes("is disabled")) {
    return "The AI assistant isn't set up yet. An administrator needs to open Firebase console → AI Logic → Get started and choose the Vertex AI Gemini API.";
  }
  if (text.includes("app check") || text.includes("appcheck")) {
    return "The AI assistant requires App Check. An administrator needs to set NEXT_PUBLIC_RECAPTCHA_SITE_KEY (or relax App Check enforcement for AI Logic).";
  }
  if (text.includes("was not found or your project does not have access") || text.includes("publisher model") || text.includes("model not found")) {
    return `The AI model "${AI_MODEL}" isn't available in this project/location. An administrator should check NEXT_PUBLIC_GEMINI_MODEL and use NEXT_PUBLIC_AI_LOCATION=global.`;
  }
  if (text.includes("are blocked") || text.includes("api key not valid") || text.includes("caller does not have permission")) {
    return "The app's Firebase API key can't use AI Logic. An administrator should allow the “Firebase AI Logic API” on the key (Google Cloud → APIs & Services → Credentials) and check the Firebase config.";
  }
  if (text.includes("billing")) {
    return "The AI assistant needs the Firebase Blaze (pay-as-you-go) plan with the Vertex AI Gemini API.";
  }
  if (text.includes("429") || text.includes("quota") || text.includes("resource_exhausted") || text.includes("resource exhausted")) {
    return "The AI assistant is busy right now. Please try again in a moment.";
  }
  if (text.includes("safety") || text.includes("blocked")) {
    return "The assistant couldn't answer that. Try rephrasing your question.";
  }
  if (text.includes("permission_denied") || text.includes("403")) {
    return "The AI assistant isn't allowed to run in this project yet. An administrator should check the Firebase AI Logic setup.";
  }
  return "The AI assistant couldn't respond. Check your connection and try again.";
}
