# LMS SLA Issue Tracker

A premium, high-performance operational management dashboard for tracking system availability, response windows, and resolution metrics under SLA (Service Level Agreement) terms.

## Features

- **Local-First Cached Sync**: Operates entirely offline using browser LocalStorage for instant loads and background replicates to Supabase.
- **Supabase Cloud Integration**: Central database syncing via credentials configured in `js/config.js`.
- **Premium Light Theme**: High-contrast, vibrant UI elements aligned with standard accessibility guidelines.
- **SLA Countdown Trackers**: Real-time business-hour countdown timers for Critical (P1), Medium (P2), and Low (P3) support windows.
- **Excel Report Generator**: One-click download containing all tickets, uptime statistics, and penalty breakdowns powered by SheetJS.

## Installation & Deployment

1. Set your Supabase URL and Key in `js/config.js`.
2. Push your project folder to your GitHub repository.
3. Enable GitHub Pages in your repository settings under the `main` branch.
