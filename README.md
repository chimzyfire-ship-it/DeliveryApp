# 📦 OTG Logistics (v1.0)

**The Next-Generation Last-Mile Delivery Infrastructure.** Built for speed, scale, and real-time fleet command.

<img width="642" height="1389" alt="IMG_3393" src="https://github.com/user-attachments/assets/73435500-0de6-4bc0-a0e6-f45b1e601d51" />
<img width="642" height="1389" alt="IMG_3394" src="https://github.com/user-attachments/assets/d0a6ae39-0963-466d-9d4f-f1175fa96064" />
## 🚀 Overview

**OTG (On The Go)** is a full-stack, role-based logistics platform designed to connect Customers, Riders, and Administrators in real-time. Unlike standard courier apps, OTG utilizes a **"Titanium 2025" Dark UI**, persistent local state, and OSRM routing algorithms to deliver a seamless, native experience without heavy API costs.

### 📱 One Codebase, Three Ecosystems
The app intelligently renders different interfaces based on the user's secure role:
1.  **🦅 Admin Command Center:** A God-mode view of the entire fleet, revenue, and active missions.
2.  **🛵 Rider Workstation:** A focused, map-based interface for job acceptance, navigation, and earnings.
3.  **📦 Customer Portal:** A clean, glassmorphic interface for booking goods/document delivery and live tracking.

---

## ✨ Key Features

### 🦅 Admin Side (Command Center)
* **Live Fleet Tracking:** Monitor riders in real-time on a global map (🟢 Online / ⚪️ Offline).
* **Retractable Command Deck:** Fluid sliding panel to toggle between Map View and Data Tables.
* **Revenue Analytics:** Real-time KPI cards for Revenue, Active Missions, and Fleet Size.
* **Mission History:** Complete ledger of all accepted, pending, and completed jobs.
<img width="642" height="1389" alt="IMG_3395" src="https://github.com/user-attachments/assets/1d00b66e-c323-41aa-87e2-0455f3bb9eaa" />
<img width="642" height="1389" alt="IMG_3396" src="https://github.com/user-attachments/assets/07fbb972-8f47-46ac-ae6c-543fa177c860" />

### 🛵 Rider Side (Logistics Partner)
* **Ghost Mode Map:** Always-on map background that dims when Offline.
* **Smart Job Queue:** Proximity-based job sorting (e.g., "Pickup is 2.4km away").
* **Real-Time Earnings:** Weekly performance graphs and acceptance rate stats based on actual completed jobs.
* **Persistent State:** App remembers "Online/Offline" status even after restarts (AsyncStorage).
<img width="642" height="1389" alt="IMG_3406" src="https://github.com/user-attachments/assets/2661179c-0fb6-43d5-83b9-b5b180ddabce" />
<img width="642" height="1389" alt="IMG_3407" src="https://github.com/user-attachments/assets/e237ca0c-0199-43ab-a6b3-a978a81b6a84" />
<img width="642" height="1389" alt="IMG_3407" src="https://github.com/user-attachments/assets/1eafa14d-152e-411b-b463-e96b22b826bf" />

### 📦 Customer Side (Client)
* **Smart Routing:** Real road geometry drawing using OSRM (Open Source Routing Machine).
* **Fare Engine:** Automatic price calculation based on real-time distance.
* **Live Order Tracking:** Step-by-step timeline (Pending -> Assigned -> Arrived -> Completed).
* **Secure Profile:** Biometric login support and secure Email/Password management.
<img width="642" height="1389" alt="IMG_3401" src="https://github.com/user-attachments/assets/3c733c6b-bb31-49de-a70b-cc4d4dcd8ff1" />
<img width="642" height="1389" alt="IMG_3402" src="https://github.com/user-attachments/assets/17dd2aac-830f-4554-ac55-27d19cd860d4" />
<img width="642" height="1389" alt="IMG_3403" src="https://github.com/user-attachments/assets/59084d08-0f48-4697-ab8e-dd22600bf6f8" />
<img width="642" height="1389" alt="IMG_3404" src="https://github.com/user-attachments/assets/d79fa4c5-c67d-4ddb-a8d0-05cb8d86f399" />
<img width="642" height="1389" alt="IMG_3405" src="https://github.com/user-attachments/assets/adc8c48b-9cf6-41df-8b00-9b92cb6b6dbd" />

---

## 🛠 Tech Stack

* **Framework:** [React Native](https://reactnative.dev/) (via [Expo](https://expo.dev))
* **Backend / Database:** [Supabase](https://supabase.com) (PostgreSQL + Realtime)
* **Maps & Geospatial:** `react-native-maps`, `expo-location`, OSRM API
* **State Persistence:** `@react-native-async-storage/async-storage`
* **UI/UX:** Custom "Titanium" Theme, Glassmorphism, Haptic Feedback, LayoutAnimation

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/chimzyfire-ship-it/DeliveryApp.git](https://github.com/chimzyfire-ship-it/DeliveryApp.git)
cd DeliveryApp
#### 2. Install dependencies
npm install
# or
npx expo install
### 3. configure supabase
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
### 4. Database Schema
-- Profiles Table
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  phone_number text,
  role text check (role in ('customer', 'driver', 'admin')),
  avatar_url text,
  home_address text,
  home_lat float,
  home_lng float,
  work_address text,
  work_lat float,
  work_lng float,
  is_online boolean default false
);

-- Missions (Orders) Table
create table public.missions (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  pickup text,
  pickup_lat float,
  pickup_lng float,
  dropoff text,
  dropoff_lat float,
  dropoff_lng float,
  price text,
  distance_km float,
  status text default 'pending', -- pending, in_progress, arrived, completed
  driver_id uuid references public.profiles(id),
  delivery_pin text,
  rating int default 5
);
### Run the App
npx expo start
