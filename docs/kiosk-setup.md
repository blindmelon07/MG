# Setting up a kiosk PC

This turns a Windows PC into an ACI Smart Information Kiosk that shows **only
the kiosk**: no desktop, no other apps, no address bar and no other websites.
The kiosk runs its own copy of the system, so it keeps working when the
internet is down.

**You need:** a PC with Windows 10 or 11 **Pro, Enterprise or Education**
(Windows Home has no kiosk feature), a touchscreen, and an administrator
account on the PC.

---

## 1. Install the system on the PC

1. Install XAMPP and copy the system into `C:\xampp\htdocs\MG` (same as on
   the development PC), then run `composer install` and `php artisan migrate`.
2. In the project's `.env` file, set:

   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=http://localhost
   KIOSK_MODE=true
   ```

   `KIOSK_MODE=true` makes this copy serve only the kiosk pages. The staff
   login, dashboard, admin and settings pages show "not found", even if
   someone types their address. Staff keep using the main (cloud) server.

3. Point Apache's document root at `C:\xampp\htdocs\MG\public`, so
   `http://localhost/` opens the kiosk home screen.
4. Keep the database and web server private to this PC:
   - In `C:\xampp\mysql\bin\my.ini`, under `[mysqld]`, set
     `bind-address=127.0.0.1`.
   - In `C:\xampp\apache\conf\httpd.conf`, change `Listen 80` to
     `Listen 127.0.0.1:80`.
   - Give the MySQL `root` user a password and put it in `.env`.
5. Make Apache and MySQL start with Windows: open the XAMPP Control Panel
   **as administrator** and tick the **Svc** box next to Apache and MySQL.
6. Open `http://localhost/` in Edge and check the home map appears.

## 2. Lock Edge to the kiosk

Double-click `docs\kiosk-edge-policies.reg` and choose **Yes** (you must be
signed in as an administrator). This makes Edge:

- block every website except `http://localhost`;
- disable developer tools (F12), downloads, and saved passwords or forms.

To check: open `edge://policy` in Edge. `URLBlocklist` and `URLAllowlist`
should be listed with status OK.

## 3. Turn on Windows kiosk mode

This signs the PC straight into a locked kiosk account that can only run
Edge, full screen.

1. Open **Settings → Accounts → Other users** (on Windows 10:
   **Settings → Accounts → Family & other users**).
2. Under **Set up a kiosk**, choose **Get started**.
3. Name the account `Kiosk`.
4. Choose **Microsoft Edge** as the app.
5. Choose **As a digital sign or interactive display**. This is full screen
   with no address bar or tabs.
6. Enter the URL: `http://localhost/`
7. For **Restart after idle time**, choose **5 minutes**. The kiosk already
   returns to its home screen after 90 seconds and signs students out on its
   own; this is a backstop.
8. Restart the PC. It should sign in to `Kiosk` and open the home map full
   screen.

## 4. Keep it running

- **Never sleep:** Settings → System → Power → set Screen and Sleep to
  **Never**.
- **Power cuts:** in the PC's BIOS/UEFI, set "Restore on AC power loss" to
  **Power On**, so the kiosk comes back on its own.
- **Protect the data:** this PC holds a copy of students' grades. Turn on
  **BitLocker** (Settings → Privacy & security → Device encryption), and use
  a strong password on the administrator account.

## Maintenance

To leave kiosk mode, press **Ctrl + Alt + Del**, choose **Sign out**, then
sign in with the administrator account. Restart the PC to go back to the
kiosk.

To remove kiosk mode for good: **Settings → Accounts → Other users → Set up
a kiosk → Kiosk → Remove kiosk**.

## Checklist before handing over

- [ ] PC restarts straight into the kiosk home map, full screen.
- [ ] Swiping from the screen edges or pressing Windows/Alt+Tab doesn't
      reach the desktop or other apps.
- [ ] `http://localhost/login` and `http://localhost/dashboard` show "not
      found".
- [ ] Tapping a link to an outside website does nothing ("That link can't be
      opened on this kiosk").
- [ ] A student can sign in to My Acads, and is signed out after leaving it
      idle.
- [ ] Unplug the network cable: the map, directory and My Acads still work
      (showing the data from the last sync with the main server).
