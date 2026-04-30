# TheatreFlow

A web-based theatre management system built for high school and community theatre directors.

Live site: [theatreflow.vercel.app](https://theatreflow.vercel.app)

---

## What This Is

TheatreFlow started as a senior project to solve a real problem. A theatre director we know had been managing her productions for 15 years using a messy combination of paper notes, Google Sheets, sticky notes on her wall, an iPad, and a physical journal. Nothing worked together. Information got lost.

This app puts everything in one place. Cast lists, rehearsal schedules, attendance, scene breakdowns, prop inventories, and production files all live under one roof.

---

## What You Can Do

**Manage Cast and Crew**
Add students to a production. Assign them roles like Main Cast, Ensemble, or Crew. Track vocal parts for singers and specialties for tech crew.

**Schedule Events**
Put rehearsals, tech weeks, and performances on a calendar. Color coding makes it easy to see what kind of event is happening.

**Take Attendance**
Mark students as Present, Absent, Late, or Excused. Add notes about why someone missed. Save everything with one click.

**Break Down Scenes**
Create scenes for your show. Add which characters appear, what songs happen, what props are needed, and blocking notes. Also has a checklist for production tasks.

**Track Props and Costumes**
Log every item in your production. Keep track of quantity, condition, location, and who it's assigned to. Move items between Current Show and Drama Closet folders.

**Store Files**
Upload scripts, photos, and documents. Create folders to keep everything organized.

**Multiple Shows**
Create as many productions as you want. Switch between them easily. Duplicate an old show to use as a template for a new one.

**Dark Mode**
Toggle between dark and light themes. Dark mode is easier on the eyes during late rehearsals.

---

## How It Works Under the Hood

**Frontend:** Plain HTML, Tailwind CSS for styling, and vanilla JavaScript. No frameworks because we wanted to keep it simple and fast.

**Backend:** Supabase handles everything. It gives us a PostgreSQL database, user authentication, and file storage all in one service.

**Hosting:** Vercel. Free for students and connects directly to GitHub. Every time we push code, it deploys automatically.

**Version Control:** Git and GitHub. We used feature branches and pull requests to keep the main branch stable.

---

## Getting Started for Developers

If you want to run this locally or contribute, here's how.

### What You Need

- Node.js (version 16 or higher)
- A Supabase account (free tier works fine)
- Git

### Steps

1. **Clone the repo**

```bash
git clone https://github.com/yourusername/theatreflow.git
cd theatreflow