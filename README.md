# ai-english-coach

# AI English Voice Coach 👨‍🏫🎤

An immersive, voice-first English conversation platform designed to simulate home-based language tutoring sessions. Powered by advanced AI to help students build confidence and fluency through real-time role-playing.

## 🚀 Highlights

- **Voice-First Experience**: Designed as a "Phone Call" interface using Web Speech API (STT/TTS).
- **Dynamic Scenario Engine**: Randomly generates diverse conversational themes (e.g., Job Interview, Airport, Coffee Shop) to keep learning fresh.
- **On-Screen Scaffolding**: Automatically generates theme-specific vocabulary and key phrases for every session.
- **Socratic Teaching Strategy**: Employs role-playing and active questioning to maximize "Student Talk Time" and provide natural spoken corrections.
- **Progressive Difficulty**: Adapts speed and vocabulary based on selected level (Beginner, Intermediate, Advanced).

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Tailwind CSS + Custom Glassmorphism UI
- **AI Engine**: [OpenRouter API](https://openrouter.ai/) (Meta Llama-3.3-70B)
- **Voice**: Browser Web Speech API (Speech Recognition & Synthesis)

## 🏁 Quick Start

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd ai-english-teacher
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   OPENROUTER_API_KEY=your_sk_or_v1_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
