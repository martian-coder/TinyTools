<p align="center">
  <img src="./banner.png" alt="CodeBlaster Banner" width="100%">
</p>

# 🚀 CodeBlaster

> Shoot the syntax · Survive the vibe coding era — an arcade game where code asteroids rain down and you blast them with the correct keyword.

**Think Space Invaders meets LeetCode.** Asteroids fall with code snippets that have a missing keyword — pick the right answer to fire it into the blank and destroy the asteroid. Miss 3 and it's game over.

---

## ✨ Features

- 🎮 **Full arcade experience** — Canvas-rendered spaceship, asteroids, particles, confetti explosions
- 💻 **6 languages** — Python, TypeScript, Go, Rust, C#, JavaScript
- 🔥 **Combo system** — Chain correct answers for streak multipliers up to 8×
- ❤️ **Lives & levels** — 3 lives, progressive difficulty, level-ups every 500 points
- ⚡ **Speed control** — 5 speed settings from "very slow" to "insane"
- 🎯 **Keyword bullets** — Your answer literally flies from your ship into the asteroid's blank slot
- 📊 **Mistake review** — Game over screen shows every wrong answer so you actually learn
- 🌟 **Zero dependencies** — Single HTML file, no build step, no npm, just open in a browser

---

## 🎯 How to Play

```bash
# Just open it in any browser
start codeblaster.html        # Windows
open codeblaster.html         # macOS
xdg-open codeblaster.html     # Linux
```

### Controls

| Action | How |
|--------|-----|
| **Steer ship** | Move your mouse |
| **Answer** | Click a button or press `1-4` keys |
| **Speed** | Adjust the slider at the bottom |

### Gameplay

1. An asteroid falls with code like `const x = ___ fetch(url)`
2. Four answer buttons appear: `await`, `async`, `yield`, `defer`
3. Click the right one → keyword bullet flies from your ship into the blank
4. **Correct** → asteroid explodes with confetti 🎊, score multiplied by combo
5. **Wrong** → you lose a life ❤️, asteroid shakes red
6. **Missed** → asteroid hits the bottom, you lose a life

---

## 🧠 Question Bank

| Language | Questions | Color |
|----------|-----------|-------|
| Python | `range`, `open`, `is`, `Optional`, `staticmethod`, ... | 🟢 Green |
| TypeScript | `string`, `Array`, `unknown`, `=>`, `enum`, ... | 🔵 Cyan |
| Go | `if`, `WaitGroup`, `make`, `struct`, `defer`, ... | 🔷 Blue |
| Rust | `i32`, `->`, `Display`, `Vec`, `let`, ... | 🔴 Red |
| C# | `static`, `Delay`, `null`, `record`, `FirstOrDefault`, ... | 🟡 Yellow |
| JavaScript | `await`, `map`, `const`, `??`, `Promise.all`, `yield`, ... | 🟣 Purple |

---

## 🏗️ Architecture

Single-file, zero-dependency game — everything in one `codeblaster.html`:

```
codeblaster.html
├── HTML — HUD, start screen, game over screen, choice buttons
├── CSS — Dark arcade theme, Orbitron font, neon animations
└── JavaScript (750 lines)
    ├── Canvas rendering (ship, asteroids, bullets, particles, stars)
    ├── Physics (wobble, gravity, easing, collision)
    ├── Question bank (35+ questions across 6 languages)
    ├── Scoring (combos, streaks, levels, high score)
    └── Game state machine (idle → playing → over)
```

---

## 🔧 Requirements

- Any modern browser (Chrome, Firefox, Edge, Safari)
- That's it. Seriously.

---

## 📄 License

[MIT](../LICENSE)
