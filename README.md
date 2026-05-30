# ExpgloFund / PitchConnect — Backend

Complete backend for the Shark Tank meets TikTok platform.

**Stack:** Node.js + Express + MongoDB + Socket.io + Raw WebRTC + Cloudinary + Redis + Razorpay + FCM + Resend.

## Quick Start

```bash
npm install
copy .env.example .env
:: fill MONGODB_URI and JWT secrets at minimum
npm run dev
```

Health: `GET http://localhost:5000/api/health`
Verify all files load: `node scripts/verify.js`
Create initial admin: `node scripts/createAdmin.js admin@x.com Pass1234 "Admin"`

## Architecture — Modular Monolith

```
src/
  app.js                        Express + helmet + cors + rate-limit
  config/                       db, redis, cloudinary, firebase
  middlewares/                  auth, role, upload, rate-limit, error
  utils/                        ApiError, ApiResponse, JWT, email, SMS, OTP, Cloudinary
  socket/                       chat + call WebRTC signaling
  cron/                         pitch expiry, view flush, reminders
  routes/index.js               central API mount
  modules/
    auth                        register, login, refresh, OTPs, password reset
    user                        profile, avatar, KYC, search, blocking, profile views
    video                       upload, feed, like/save/skip, analytics, trending, search
    comment                     threaded comments + replies + likes
    chat                        rooms, messages, attachments, mutual-interest gate
    call                        WebRTC signaling, ICE servers, history
    investment                  stages, Razorpay order + verify
    notification                in-app + FCM + DB
    report                      user/video reporting + auto-pause
    activity                    role-based dashboard
    profileView                 track who viewed your profile
    audit                       admin action log
    admin                       full platform control
```

## API Surface — Every Endpoint

### Auth — `/api/auth`

| Method | Route             | Description             |
| ------ | ----------------- | ----------------------- |
| POST   | /register         | Founder/investor signup |
| POST   | /login            | Login + tokens          |
| POST   | /logout           | Clear tokens            |
| POST   | /refresh-token    | Rotate access token     |
| GET    | /me               | Current user            |
| POST   | /forgot-password  | Email reset link        |
| POST   | /reset-password   | Reset using token       |
| POST   | /change-password  | Change while logged in  |
| POST   | /send-email-otp   | Email OTP               |
| POST   | /verify-email-otp | → Level 1               |
| POST   | /send-phone-otp   | Phone OTP               |
| POST   | /verify-phone-otp | → Level 2               |

### User — `/api/user`

| Method | Route                | Description                            |
| ------ | -------------------- | -------------------------------------- |
| GET    | /profile             | My profile                             |
| PUT    | /profile             | Update profile                         |
| POST   | /avatar              | Upload avatar                          |
| POST   | /pitch-deck          | Upload pitch deck PDF                  |
| POST   | /documents           | KYC docs (PAN, Aadhar, business reg)   |
| GET    | /verification-status | All levels                             |
| PUT    | /fcm-token           | Save mobile push token                 |
| GET    | /search              | Search founders/investors with filters |
| GET    | /profile-viewers     | Who viewed me                          |
| GET    | /public/:userId      | Public profile (logs view)             |
| POST   | /block/:userId       | Block                                  |
| DELETE | /block/:userId       | Unblock                                |
| DELETE | /account             | Soft delete                            |

### Video — `/api/video`

| Method | Route               | Role        | Description                           |
| ------ | ------------------- | ----------- | ------------------------------------- |
| POST   | /upload             | founder L2+ | Upload pitch (multipart `video`)      |
| GET    | /my-pitches         | founder     | All my pitches                        |
| GET    | /:id/analytics      | founder     | Views, watch time, completion         |
| PUT    | /:id                | founder     | Edit metadata                         |
| DELETE | /:id                | founder     | Delete                                |
| POST   | /:id/renew          | founder     | Extend 30 days                        |
| POST   | /:id/pause-toggle   | founder     | Pause/resume                          |
| GET    | /feed               | investor    | Personalized cursor feed              |
| GET    | /saved              | investor    | Saved pitches                         |
| POST   | /:id/like           | investor    | Toggle like                           |
| POST   | /:id/save           | investor    | Toggle save                           |
| POST   | /:id/not-interested | investor    | Hide from feed                        |
| GET    | /trending           | both        | Top liked/saved last 7 days           |
| GET    | /search             | both        | Search by query/industry/stage/amount |
| GET    | /:id                | both        | Single video                          |
| POST   | /:id/view           | both        | Log view + watch time                 |

### Comment — `/api/comment`

| Method | Route           | Description                       |
| ------ | --------------- | --------------------------------- |
| POST   | /               | Comment or reply (set `parentId`) |
| GET    | /video/:videoId | List comments (cursor)            |
| PUT    | /:id            | Edit own comment                  |
| DELETE | /:id            | Soft delete own comment           |
| POST   | /:id/like       | Toggle like on comment            |

### Chat — `/api/chat`

| Method | Route               | Description                                     |
| ------ | ------------------- | ----------------------------------------------- |
| POST   | /start              | Investor starts (must like founder pitch first) |
| GET    | /list               | All my chats                                    |
| GET    | /unread-total       | Total unread badge                              |
| GET    | /:chatId/messages   | Cursor paginated                                |
| POST   | /:chatId/messages   | Send                                            |
| POST   | /:chatId/attachment | Upload image/file (multipart `file`)            |
| PUT    | /:chatId/read       | Mark read                                       |
| DELETE | /:chatId            | Soft delete                                     |

### Call — `/api/call`

| Method | Route            | Description               |
| ------ | ---------------- | ------------------------- |
| POST   | /initiate        | Create call + ICE servers |
| PUT    | /:callId/accept  | Receiver accepts          |
| PUT    | /:callId/decline | Receiver declines         |
| PUT    | /:callId/end     | End call                  |
| GET    | /history         | My call history           |
| GET    | /ice-servers     | STUN/TURN config          |
| GET    | /:callId         | Single call               |

### Investment — `/api/investment`

| Method | Route               | Description              |
| ------ | ------------------- | ------------------------ |
| POST   | /express-interest   | Investor interest        |
| PUT    | /:id/stage          | Update stage             |
| POST   | /:id/pay            | Razorpay order (L3 only) |
| POST   | /:id/verify-payment | Verify HMAC signature    |
| GET    | /my-deals           | Both sides               |
| GET    | /:id                | Single                   |

### Notification — `/api/notification`

| Method | Route         | Description      |
| ------ | ------------- | ---------------- |
| GET    | /list         | Cursor paginated |
| GET    | /unread-count | Badge            |
| PUT    | /read-all     |                  |
| PUT    | /:id/read     |                  |
| DELETE | /:id          |                  |

### Report — `/api/report`

| Method | Route       | Description       |
| ------ | ----------- | ----------------- |
| POST   | /           | Report user/video |
| GET    | /my-reports |                   |

### Activity — `/api/activity`

| Method | Route      | Description                |
| ------ | ---------- | -------------------------- |
| GET    | /dashboard | Role-aware dashboard stats |

### Admin — `/api/admin` (admin role only)

**Dashboard**
| Method | Route | Description |
|---|---|---|
| GET | /dashboard | Full platform stats |
| GET | /stats?days=30 | Time series for charts |

**User Management — full control**
| Method | Route | Description |
|---|---|---|
| GET | /users | List + filter (role, status, verified, search) |
| GET | /users/:id | Full user details (pitches, deals, reports) |
| PUT | /users/:id | Edit any field |
| PUT | /users/:id/ban | Ban with reason |
| PUT | /users/:id/unban | |
| PUT | /users/:id/reset-password | Force-reset password |
| PUT | /users/:id/promote | Make admin |
| PUT | /users/:id/demote | Remove admin |
| DELETE | /users/:id | Hard delete (cleanup videos, chats, etc.) |

**Video Management**
| Method | Route | Description |
|---|---|---|
| GET | /videos | List with filters |
| GET | /videos/pending | Processing queue |
| PUT | /videos/:id/approve | Make active |
| PUT | /videos/:id/reject | Reject with reason |
| POST | /videos/:id/boost | Boost in feed (days) |
| DELETE | /videos/:id/boost | Remove boost |
| DELETE | /videos/:id | Force delete + cleanup Cloudinary |

**KYC**
| Method | Route | Description |
|---|---|---|
| GET | /documents/pending | Queue |
| PUT | /documents/:userId/approve | Grant Level 3 + blue tick |
| PUT | /documents/:userId/reject | Reject with reason |

**Reports**
| Method | Route | Description |
|---|---|---|
| GET | /reports | Filter by status/type |
| PUT | /reports/:id/resolve | Mark resolved/dismissed |

**Comments**
| Method | Route | Description |
|---|---|---|
| GET | /comments | All comments, filter by video |
| PUT | /comments/:id/hide | Hide from public |
| PUT | /comments/:id/unhide | |
| DELETE | /comments/:id | Permanent delete |

**Investments**
| Method | Route | Description |
|---|---|---|
| GET | /investments | Filter by status/stage |
| POST | /investments/:id/refund | Mark as refunded |

**Calls / Chats overview**
| Method | Route | Description |
|---|---|---|
| GET | /calls | All calls history |
| GET | /chats | All conversations |
| GET | /chats/:chatId/messages | Read any conversation |

**Broadcast**
| Method | Route | Description |
|---|---|---|
| POST | /broadcast | Send notification to all/role with optional email |

**Audit log**
| Method | Route | Description |
|---|---|---|
| GET | /audit | All admin actions logged |

## Socket.io Events

### Chat

- emit: `join_chat` `leave_chat` `send_message` `typing` `stop_typing` `mark_read` `heartbeat`
- listen: `new_message` `user_typing` `user_stop_typing` `messages_read` `online_status` `notification`

### Call (WebRTC)

- emit: `call_initiate` `call_accept` `call_decline` `call_end` `webrtc_offer` `webrtc_answer` `ice_candidate`
- listen: `incoming_call` `call_accepted` `call_declined` `call_ended` `call_no_answer` `webrtc_offer` `webrtc_answer` `ice_candidate`

## Verification System

| Level | Requirement           | Unlocks                            |
| ----- | --------------------- | ---------------------------------- |
| 0     | Just registered       | Browse only                        |
| 1     | Email OTP verified    | Profile views                      |
| 2     | Phone OTP verified    | Founder upload, Investor chat/call |
| 3     | KYC approved by admin | Investment flow + blue tick        |

## WebRTC ICE Servers

Returned by the call service:

- Google STUN (free, unlimited)
- Metered.ca TURN (free 0.5GB/month, set `METERED_USERNAME` + `METERED_CREDENTIAL`)

## Security

- JWT access (15min) + refresh (7d) with rotation
- Bcrypt password hashing (12 rounds)
- Login lockout: 5 fails → 15 min lock
- helmet + cors + mongo-sanitize + hpp + compression
- Rate limit: 100 req/15min global, 5 req/15min auth
- httpOnly cookies for web, Bearer tokens for mobile
- Role + verification-level middleware on sensitive routes
- Razorpay HMAC signature verification
- Audit log for every admin action

## Cron Jobs

- Hourly: expire pitches past 30 days
- Every 5 min: flush Redis view counters → MongoDB
- Daily 9am: 3-day expiry reminder

## Free Tier Stack — Cost at Launch

| Service         | Free                 | When you hit it      |
| --------------- | -------------------- | -------------------- |
| Vercel (web)    | Forever              | Never                |
| Firebase FCM    | Forever              | Never                |
| Google STUN     | Forever              | Never                |
| Cloudinary      | 25GB bandwidth/mo    | ~500 video views/day |
| MongoDB Atlas   | 512MB                | ~2000 users          |
| Upstash Redis   | 10k req/day          | ~300 DAU             |
| Resend          | 3k emails/mo         | ~100 signups/day     |
| Metered.ca TURN | 0.5GB/mo             | ~50 video calls      |
| Railway         | $5 credit            | ~1 month             |
| Razorpay        | per-transaction only | always               |
| MSG91           | ~₹0.15/OTP           | always               |

**Total at launch: ~₹50-200/month for OTPs.**

## Build Status

- ✅ Auth + OTPs + Password reset + KYC
- ✅ User profile + Avatar + Pitch deck + Search + Profile views + Block
- ✅ Video upload + HLS + Feed + Trending + Search + Analytics + Expiry
- ✅ Like + Save + Not Interested + View tracking
- ✅ Comments + replies + likes
- ✅ Chat + attachments + mutual-interest gate
- ✅ Raw WebRTC calls (audio + video) + ICE servers
- ✅ Investment + Razorpay + Refund
- ✅ Notifications (in-app + FCM + DB)
- ✅ Reports + auto-pause threshold
- ✅ Activity dashboard (founder + investor)
- ✅ Admin: dashboard, users (CRUD/ban/promote/reset), videos (approve/reject/boost/delete), KYC, reports, comments, investments (refund), chats overview, calls overview, broadcast, audit log
- ✅ Cron jobs: expiry, view flush, reminders
- ✅ Socket.io chat + WebRTC signaling
