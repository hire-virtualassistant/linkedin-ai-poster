# AI LinkedIn Auto Poster — Netlify Version

Yeh original Python app ka Netlify-ready version hai. Ab yeh:
- **Frontend**: static site (`public/` folder) — Netlify khud host karta hai.
- **Backend**: Netlify Functions (Node.js) — `/api/*` calls yahan jaati hain.
- **Database**: Netlify Blobs (built-in, koi alag signup/DB nahi chahiye).
- **Auto-publish**: Netlify Scheduled Function har 1 minute me check karta hai
  aur jin posts ka waqt aa chuka ho unhe LinkedIn par khud publish kar deta hai —
  aapko kuch nahi karna, bas schedule karke chhor dein.

## Deploy kaise karein (5 minute)

### Option 1 — Netlify site se seedha zip upload (sab se aasan)
1. https://app.netlify.com par login karein.
2. "Add new site" → "Deploy manually" par click karein.
3. Is poore folder (`linkedin_ai_poster_netlify`) ko zip karke, ya seedha
   folder ko drag-drop kar dein (Netlify khud `netlify.toml` padh lega).
4. Deploy hote hi site live ho jayegi.

### Option 2 — GitHub se (recommended, auto-deploy ke liye)
```bash
cd linkedin_ai_poster_netlify
git init
git add .
git commit -m "Netlify version"
git remote add origin <aapka-github-repo-url>
git push -u origin main
```
Phir Netlify dashboard me "Import from Git" se yeh repo connect kar dein.
Build command khali chhod dein, publish directory `public` already
`netlify.toml` me set hai.

## Pehli baar setup (deploy ke baad)
1. Site khulne ke baad `/settings` page par jayein.
2. Apni **Gemini API key** save karein.
3. Apna **LinkedIn access token** save karein aur "Test & Connect" dabayein.
4. Home page par jayein, keywords likh kar **"Generate Best Post"** dabayein.
5. **"Generate Best Time"** dabayein — ab aapko:
   - Sab se acha (peak) suggested waqt milega,
   - Neeche **poore hafte ke slots** (Friday, Saturday, sab din) dikhenge,
   - Jo bhi din/waqt pasand ho, us ke saamne "Ye waqt choose karein" dabayein.
6. **Submit Post** dabayein — post schedule ho jayegi.
7. Bas — jaise hi wo waqt aayega, scheduled function khud LinkedIn par
   publish kar degi. Aapko kuch karne ki zaroorat nahi.

## Zaroori note
- Netlify Blobs data site ke sath hi jura rehta hai — agar aap site delete
  karenge to data bhi chala jayega.
- LinkedIn access token expire ho sakta hai (LinkedIn OAuth tokens usually
  ~60 din chalte hain) — expire hone par settings me naya token dalna hoga.
- Scheduled function ki minimum frequency 1 minute hai, is liye publish
  waqt +/- 1 minute tak thora idhar-udhar ho sakta hai.
