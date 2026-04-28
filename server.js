import dotenv from "dotenv";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = process.env.PORT || 3000;
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript"
};

const DIFF_NOTES = {
  easy:   "Use simple, direct questions. Test basic recall and definitions only.",
  medium: "Use moderately challenging questions. Test comprehension and relationships between concepts.",
  hard:   "Use difficult questions requiring deep understanding, inference, and application."
};

function callGroq(messages, maxTokens = 2000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: maxTokens });
    const opts = {
      hostname: "api.groq.com", path: "/openai/v1/chat/completions", method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Length": Buffer.byteLength(payload) }
    };
    const req = https.request(opts, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d).choices?.[0]?.message?.content || ""); } catch(e) { reject(new Error("Groq parse error")); } });
    });
    req.on("error", reject); req.write(payload); req.end();
  });
}

// Streaming version for tutor chat
function callGroqStream(messages, maxTokens, onChunk, onDone) {
  const payload = JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: maxTokens, stream: true });
  const opts = {
    hostname: "api.groq.com", path: "/openai/v1/chat/completions", method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Length": Buffer.byteLength(payload) }
  };
  const req = https.request(opts, res => {
    let buffer = "";
    res.on("data", chunk => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") { onDone(); return; }
        try { onChunk(data); } catch {}
      }
    });
    res.on("end", onDone);
  });
  req.on("error", err => onDone(err));
  req.write(payload); req.end();
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\[[\s\S]*\]/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  const m2 = text.match(/\{[\s\S]*\}/);
  if (m2) try { return JSON.parse(m2[0]); } catch {}
  throw new Error("Could not parse JSON from AI response");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => { try { resolve(JSON.parse(body)); } catch(e) { reject(new Error("Invalid JSON")); } });
  });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/api/quiz") {
    try {
      let { text, difficulty = "medium", length = 5, enhance = false, weaknessMode = false, weaknessQuestions = [], harder = false, questionType = "mixed" } = await readBody(req);
      if (!text && !weaknessMode) return send(res, 400, { error: "Missing text" });
      length = Math.min(Math.max(parseInt(length) || 5, 1), 15);
      const diffNote = DIFF_NOTES[difficulty] || DIFF_NOTES.medium;
      if (enhance && text) {
        text = await callGroq([{ role: "user", content: `Clean up and improve these study notes. Extract key ideas, remove noise, organize logically. Return ONLY the improved notes as plain text.\n\n${text}` }], 1500);
      }
      let prompt;
      if (weaknessMode && weaknessQuestions.length > 0) {
        const missed = weaknessQuestions.map((q, i) => `${i+1}. Concept: "${q.question}" (correct: ${q.answer})`).join("\n");
        prompt = `The student failed these questions. Generate ${length} NEW questions testing the SAME concepts but completely rephrased.\n${harder ? "Make them HARDER than the originals." : "Use similar difficulty."}\n\nMissed questions:\n${missed}\n\nReturn ONLY a valid JSON array — no markdown, no backticks. Each object must have a "topic" field:\n[{ "type": "mc", "topic": "Topic Label", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "explanation": "..." }]\nAll ${length} questions must be multiple choice. "answer" is just the letter.`;
      } else {
        let formatInstructions, countLine;
        if (questionType === "mc") {
          countLine = `Generate ${length} multiple choice questions`;
          formatInstructions = `All questions must be multiple choice:\n{ "type": "mc", "topic": "Topic Label", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "explanation": "..." }\n"answer" is just the letter (A/B/C/D).`;
        } else if (questionType === "tf") {
          countLine = `Generate ${length} true/false questions`;
          formatInstructions = `All questions must be true/false:\n{ "type": "tf", "topic": "Topic Label", "question": "...", "options": ["A. True", "B. False"], "answer": "A", "explanation": "..." }\n"answer" is A for True, B for False.`;
        } else if (questionType === "short") {
          countLine = `Generate ${length} free response questions`;
          formatInstructions = `All questions must be free response:\n{ "type": "short", "topic": "Topic Label", "question": "...", "answer": "correct answer in a few words", "explanation": "..." }`;
        } else {
          const mcCount = length - 1;
          countLine = `Generate ${mcCount} multiple choice questions and 1 short answer question`;
          formatInstructions = `Format:\n{ "type": "mc", "topic": "Topic Label", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "explanation": "..." }\n{ "type": "short", "topic": "Topic Label", "question": "...", "answer": "correct answer in a few words", "explanation": "..." }\nThe LAST item must be the short answer. MC "answer" is just the letter (A/B/C/D).`;
        }
        prompt = `${countLine} from the text below.\nDifficulty: ${difficulty.toUpperCase()}. ${diffNote}\n\nEach question MUST include a "topic" field: a short 2-4 word label for the concept being tested.\n\nReturn ONLY a valid JSON array — no markdown, no backticks:\n[\n  ${formatInstructions}\n]\n\nText:\n${text}`;
      }
      const raw = await callGroq([{ role: "user", content: prompt }], 3000);
      const questions = extractJSON(raw);
      send(res, 200, { questions, enhancedText: enhance ? text : null });
    } catch(e) { send(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === "POST" && req.url === "/api/modify") {
    try {
      const { question, action, text } = await readBody(req);
      if (!question || !action) return send(res, 400, { error: "Missing fields" });
      const actionMap = { regenerate: "Generate a COMPLETELY DIFFERENT question testing a different aspect of the same topic.", harder: "Rewrite this question to be significantly HARDER.", easier: "Rewrite this question to be significantly EASIER. Focus on basic recall." };
      const ctx = text ? `\nContext: ${text.slice(0, 600)}` : "";
      const isShort = question.type === "short", isTF = question.type === "tf";
      let fmt;
      if (isShort) fmt = `{ "type": "short", "topic": "${question.topic || 'General'}", "question": "...", "answer": "brief correct answer", "explanation": "..." }`;
      else if (isTF) fmt = `{ "type": "tf", "topic": "${question.topic || 'General'}", "question": "...", "options": ["A. True", "B. False"], "answer": "A", "explanation": "..." }`;
      else fmt = `{ "type": "mc", "topic": "${question.topic || 'General'}", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A", "explanation": "..." }`;
      const prompt = `Original question: "${question.question}"\n${actionMap[action] || actionMap.regenerate}${ctx}\n\nReturn ONLY a single JSON object — no markdown:\n${fmt}`;
      const raw = await callGroq([{ role: "user", content: prompt }], 600);
      send(res, 200, { question: extractJSON(raw) });
    } catch(e) { send(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === "POST" && req.url === "/api/evaluate") {
    try {
      const { question, userAnswer, correctAnswer } = await readBody(req);
      if (!question || !userAnswer) return send(res, 400, { error: "Missing fields" });
      const prompt = `Question: "${question}"\nCorrect answer: "${correctAnswer}"\nStudent's answer: "${userAnswer}"\n\nIs the student's answer correct or substantially correct? Reply ONLY with JSON (no markdown):\n{ "correct": true, "feedback": "Good answer! ..." }`;
      const raw = await callGroq([{ role: "user", content: prompt }], 250);
      send(res, 200, extractJSON(raw));
    } catch(e) { send(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === "POST" && req.url === "/api/deeper") {
    try {
      const { question, answer, explanation } = await readBody(req);
      if (!question) return send(res, 400, { error: "Missing question" });
      const prompt = `A student just answered this quiz question:\nQuestion: "${question}"\nCorrect answer: "${answer}"\nBasic explanation: "${explanation}"\n\nGive a deeper explanation in 3-4 sentences. Include:\n1. Why this is true (the underlying mechanism or reasoning)\n2. A concrete real-world example or analogy\n3. A common misconception to avoid\n\nWrite in plain prose — no bullet points, no headers. Keep it concise but substantive.\nReply ONLY with JSON (no markdown): { "deeper": "your explanation here" }`;
      const raw = await callGroq([{ role: "user", content: prompt }], 400);
      send(res, 200, extractJSON(raw));
    } catch(e) { send(res, 500, { error: e.message }); }
    return;
  }

  // STREAMING chat for AI tutor
  if (req.method === "POST" && req.url === "/api/chat") {
    try {
      const { messages } = await readBody(req);
      if (!messages || !Array.isArray(messages)) return send(res, 400, { error: "Missing messages" });
      const systemMsg = messages.find(m => m.role === "system");
      const conversation = messages.filter(m => m.role !== "system");
      const groqMessages = systemMsg ? [{ role: "system", content: systemMsg.content }, ...conversation] : conversation;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });

      let done = false;
      callGroqStream(groqMessages, 500,
        (chunkData) => {
          if (done) return;
          res.write(`data: ${chunkData}\n\n`);
        },
        (err) => {
          if (done) return;
          done = true;
          res.write("data: [DONE]\n\n");
          res.end();
        }
      );
    } catch(e) { if (!res.headersSent) send(res, 500, { error: e.message }); }
    return;
  }

  const filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`\n✅  PasteQuiz v6 → http://localhost:${PORT}\n`));
