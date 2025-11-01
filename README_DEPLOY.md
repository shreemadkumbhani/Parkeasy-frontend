# ParkEasy Frontend – Deploying to Vercel

This repo is a Vite + React app. Vercel will auto-detect the framework.

## Build settings
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## Environment variables (required)
Set the following in Vercel Project Settings → Environment Variables for Production (and Preview if desired):

- `VITE_API_BASE` = `https://<your-backend-on-render>.onrender.com`

The frontend reads this at build/runtime to call the backend.

## Local development
```
npm install
npm run dev
```

If testing on phone, open the LAN URL printed by Vite. The app will call `http://<your-machine-ip>:8080` by default when `VITE_API_BASE` is not set.
