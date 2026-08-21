require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const apiKey = process.env.GEMINI_API_KEY;
console.log("Key loaded:", apiKey ? "Yes ✅" : "No ❌");
app.get('/test-ai', async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in one line" }] }]
        })
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/match', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    const prompt = `You are a job matching assistant. Compare the resume and job description below.
Resume: ${resume}
Job Description: ${jobDescription}

Give a match score out of 100, and a 2-line reason. Reply ONLY in this JSON format:
{"score": number, "reason": "string"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text;
    res.json({ result: aiText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});