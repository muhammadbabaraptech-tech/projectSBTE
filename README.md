# projectSBTE

SBTE Student Evaluation Register — a complete, single-file student monthly performance portal.

## About

A self-contained HTML web application for managing student evaluation records. It supports two roles:

- **Admin** — manage students, edit scores, upload notes & simulations, seating planner, attendance, layout & settings
- **Student** — view their own report card, batch notes/sims, seating (own seat highlighted), and attendance

## Features

- Student Register dashboard with search, filters, sorting, KPI cards, and SVG charts
- Individual report cards with weighted scoring, rank, batch comparison, remarks, and print/CSV export
- Batch progress reports with standings, pass rate, and student rankings
- Notes & study materials upload (PDF, Office docs, images up to 5 MB)
- Practical simulations upload/run (HTML up to 2 MB)
- Interactive seating arrangement planner with image export
- Daily attendance register (P / Late / Leave / Absent / Holiday) with CSV & Excel export
- Evaluation policy & rubrics with standing bands and letter grades
- Dark/light theme and 5 design variants (Classic, Minimalism, Neumorphism, Glassmorphism, Brutalism)
- Firebase Realtime Database sync with local-only fallback
- Fully responsive, print-ready, no build step — open the HTML file in any browser

## Credentials (demo)

- Admin: username `admin`, password `123`
- Student: Student ID + password (default password is the student's name)

## Getting Started

1. Clone or download this repository.
2. Open `SBTE_Student_Portal c.html` in your browser.
3. No installation, no server, no dependencies required.

## File Structure

```
SBTE Website/
├── SBTE_Student_Portal c.html   # Complete application (HTML + CSS + JS + data)
└── README.md
```

## License

MIT