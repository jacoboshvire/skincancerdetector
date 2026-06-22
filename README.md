# SkinScan

A demo web app that screens photos of skin lesions for early signs of
skin cancer using a TensorFlow.js model trained on the
[HAM10000](https://www.kaggle.com/datasets/kmader/skin-cancer-mnist-ham10000)
dataset. Built with Next.js, protected by password + JWT + email-based MFA.

> **Not a medical device.** This is an educational demonstration of applying
> machine learning to dermoscopic images. It is not FDA-cleared, has not been
> clinically validated, and must never replace evaluation by a licensed
> dermatologist or physician.

## How it works

- **Landing page** (`/`) — explains the tool and links to sign up / log in.
- **Auth** (`/register`, `/login`, `/verify-otp`) — email + password
  accounts. After password verification, a 6-digit one-time code is emailed
  to the user (MFA); only after that code is verified does the server issue
  a signed JWT, stored as an httpOnly session cookie.
- **Dashboard** (`/dashboard`, JWT-protected) — upload a lesion photo, run
  classification entirely in the browser via TensorFlow.js, see a
  per-category probability breakdown plus an overall "malignant-category
  risk" score, and optionally save results — along with where on the body
  the lesion is and any symptom notes — to a per-account medical record.
- **Profile** (`/profile`, JWT-protected) — an editable medical-record form
  (name, date of birth, sex, family history of skin cancer, other notes)
  plus the full history of saved AI scan results, with malignant-category
  predictions visually flagged.

The classifier distinguishes the 7 HAM10000 categories: melanoma (`mel`),
basal cell carcinoma (`bcc`), and actinic keratoses (`akiec`) are flagged as
the malignant/pre-malignant group; melanocytic nevi (`nv`), benign
keratosis-like lesions (`bkl`), dermatofibroma (`df`), and vascular lesions
(`vasc`) are flagged benign.

## Project layout

```
src/app/                  Next.js App Router pages + API routes
src/lib/                  db, auth (JWT/bcrypt), OTP, email, model helpers
src/proxy.ts              route protection (redirects unauthenticated users away from /dashboard)
public/model/             trained TensorFlow.js model lives here (generated, not committed)
scripts/train_model/      Python pipeline: HAM10000 -> trained model -> public/model/
```

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `JWT_SECRET` — required for production; generate with `openssl rand -base64 32`.
  In development, an insecure default is used automatically if unset (a
  warning is printed).
- `SMTP_*` — optional. If left unset, MFA codes are printed to the server
  console instead of emailed, so you can test the full flow with zero email
  setup. Configure these to send real emails.
- `DATABASE_PATH` — optional, defaults to `./data/app.db` (SQLite).

```bash
npm run dev
```

Open http://localhost:3000.

## Training the model

The app ships without a trained model — `public/model/` is empty by design.
The dashboard detects this and tells you to run the training pipeline rather
than failing silently.

```bash
cd scripts/train_model
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python download_data.py     # fetch HAM10000 via kagglehub (needs a Kaggle account)
python prepare_data.py      # build train/val manifests
python train.py             # transfer-learn MobileNetV2 -> model.h5
python convert_to_tfjs.py   # convert model.h5 -> ../../public/model/
```

Full details, including expected accuracy and why preprocessing must stay in
sync between Python and the browser, are in `scripts/train_model/README.md`.
Refresh the dashboard once conversion finishes — no rebuild needed in dev.

## Using the app

1. **Sign up** at `/register` with an email and password (8+ characters).
2. **Log in** at `/login`. MFA is off by default (`MFA_ENABLED=false` in
   `.env`) — you're sent straight to `/dashboard`. With `MFA_ENABLED=true`,
   you're sent to `/verify-otp` after your password is verified instead.
3. **If MFA is on, check for your code.** If you configured SMTP, check your
   inbox. If not, check the terminal running `npm run dev` — it prints
   `OTP code for <email> is: <code>`. Enter the 6-digit code; codes expire
   after 5 minutes and lock out after 5 wrong attempts — use "Resend code"
   if needed. Either way, you end up with a JWT session cookie (valid 12
   hours).
4. **On the dashboard**, upload a photo of a skin lesion and click
   "Analyze image". You'll see the top predicted category, an overall
   malignant-category risk percentage, and a full breakdown across all 7
   HAM10000 categories. Optionally select where on the body the lesion is
   and add symptom notes, then click "Save to medical record" to persist
   it to your account.
5. **Visit `/profile`** (linked from the dashboard header) to fill in
   background medical-record details (name, date of birth, sex, family
   history of skin cancer) and to see your full scan history — every saved
   result with its date, location, confidence, malignant-category risk, and
   notes, with malignant-flagged entries highlighted.
6. **Log out** via the button in the header, which clears the session
   cookie server-side.

## Security notes

- Passwords are hashed with bcrypt (cost factor 12); OTP codes are hashed
  with bcrypt before storage, never stored or logged in plaintext (outside
  the explicit dev-mode console fallback when SMTP isn't configured).
- Sessions are JWTs signed with `JWT_SECRET`, stored in httpOnly, `SameSite=Lax`
  cookies — inaccessible to client-side JavaScript and not sent cross-site.
- `src/proxy.ts` enforces authentication on `/dashboard/*` and `/profile/*`
  at the routing layer, independent of any client-side checks.
- Login and resend-OTP responses are intentionally shaped to avoid revealing
  whether an email is registered.
