# Mobile Setup Guide – Texas Land & Tax Sale Finder

This guide walks you through running the tax liens app on your mobile phone so you can search properties and manage deals on the go.

## Quick Start: Run Locally

No installation needed! The app uses Python 3 (built-in on macOS/Linux).

```bash
# From the repo root
python3 app/server.py
```

The app will start on `http://localhost:8000`. Your phone can access it if on the same WiFi network.

## Connect Your Phone to the App

### Find Your Computer's IP Address

**macOS / Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for something like: inet 192.168.1.50
```

**Windows (PowerShell):**
```powershell
ipconfig
# Look for "IPv4 Address" under your WiFi adapter
```

### Open the App on Your Phone

1. On your **phone's browser**, enter:
   ```
   http://YOUR_IP_ADDRESS:8000
   ```
   Replace `YOUR_IP_ADDRESS` with the address from above (e.g., `http://192.168.1.50:8000`)

2. Bookmark the page for quick access

3. **(Optional) Install as an App:**
   - **iOS Safari:** Tap Share → Add to Home Screen → Add
   - **Android Chrome:** Tap ⋮ → Install app (or "Add to Home Screen")

## Use on Mobile

All features work on mobile:

- **Search counties** — type to find by name, region, metro area
- **View county details** — tap a county row to see phone numbers and links
- **Deal Dashboard** — add properties, calculate max bids, track your GO/HOLD/PASS list
- **Favorites** — star counties, filter by favorites
- **Export data** — CSV export works on mobile; import from desktop, or enter data directly
- **Offline-first** — once loaded, data stays in your browser (no internet needed to review past properties)

## Advanced: Network Access

### Option 1: Same WiFi (Easiest)
Phone and computer on same WiFi → just use the local IP address above.

### Option 2: Mobile Hotspot from Computer
1. On your computer, create a WiFi hotspot (built-in on most OSes)
2. Connect phone to that hotspot
3. Run the server on that computer
4. Phone sees the local network IP address

### Option 3: Secure Remote Access (Advanced)
For use outside your home network:

**ngrok (free, temporary tunnels):**
```bash
# Install from https://ngrok.com
ngrok http 8000
# Look for the HTTPS URL (e.g., https://abc123.ngrok.io)
# Share that link with your phone
```

**Cloudflare Tunnel (free, no installation):**
```bash
# Download cloudflared
# Run: cloudflared tunnel --url http://localhost:8000
# You get a public HTTPS URL
```

**Port forward (home network only):**
- Forward port 8000 on your router to your computer's local IP
- Phone accesses via `http://YOUR_PUBLIC_IP:8000` (check your router)
- ⚠ Not recommended for production; adds security risk

## Performance & Battery Tips

- **Sync data before going out** — export your property list to CSV, then import on mobile
- **Keep phone on WiFi** — local network is faster and uses less battery
- **Airplane mode + local WiFi** — to avoid cell radio drain (turn WiFi back on)
- **Disable auto-refresh** — the app doesn't auto-update, so no battery drain from polling

## Troubleshooting

**Phone can't reach the server:**
- Check phone and computer are on same WiFi
- Confirm IP address is correct (test on computer first: `curl http://localhost:8000`)
- Some networks block device-to-device traffic; try a personal hotspot instead

**Changes aren't saving:**
- The app stores data in browser `localStorage`, which is per-device
- Export CSV on desktop, import on mobile (or vice versa)
- Use the same device for reliable persistence

**Port 8000 is in use:**
```bash
PORT=8080 python3 app/server.py
# Then use http://YOUR_IP:8080
```

**App is slow on mobile:**
- Mobile browsers are slower; tap once and wait
- Disable tabs/background apps on your phone
- Use 5GHz WiFi if available

## Data Privacy

- **No cloud, no tracking** — the app runs locally on your network
- **Browser storage only** — your property records stay on your phone unless you export
- **Clear browser data** — erases all stored properties and settings
- **Offline works** — after first load, the app works without internet

## Use with Agency Swarm

Once you've researched counties and built your deal pipeline on mobile:

1. **Export CSV** — tap the Export button in Deal Dashboard
2. **Share with Agency Swarm** — email or upload the CSV
3. **Agency Swarm processes it** — screening, diligence automation, API calls
4. **Import results back** — CSV import on mobile with updated flags/recommendations

This workflow lets you research anywhere, then hand off to automated processing.

## Deployment to Production

For a persistent, always-on setup:

- **Shared server** — run on a small VPS (AWS, Heroku, DigitalOcean) with `python3 app/server.py`
- **Docker container** — wrap it in a container for easy hosting
- **Systemd service** — on Linux, run as a background service so it persists across reboots

Example systemd service file (create `/etc/systemd/system/tx-tax-sales.service`):
```ini
[Unit]
Description=Texas Tax Sales App
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/repo/app
ExecStart=/usr/bin/python3 server.py
Restart=on-failure
User=www-data
Environment="PORT=8000"

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable tx-tax-sales
sudo systemctl start tx-tax-sales
```

## Questions?

- **CSV workflow** — see README.md § CSV workflow
- **Dashboard calculations** — see README.md § Maximum-bid calculation
- **County data** — see README.md § Data refresh
- **Tests** — run `python3 -m unittest discover -s tests -v`
