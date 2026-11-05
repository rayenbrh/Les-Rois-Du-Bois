# Test it on your PC and your phone

Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) on the PC.

1. In the project folder:
   ```bash
   docker compose -f docker-compose.local.yml up -d --build
   docker compose -f docker-compose.local.yml exec app node scripts/seedDatabase.js
   ```
   The second line creates the demo accounts below (run it once).
2. On the PC open **http://localhost:5000**
3. On your phone (same Wi-Fi), open **http://YOUR-PC-IP:5000**
   - Windows: run `ipconfig` and use the "IPv4 Address" (e.g. `192.168.1.20`)
   - Mac: System Settings → Wi-Fi → Details → IP address
   - If the phone can't connect, allow port 5000 in the PC firewall.

## Demo accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | admin@lesroisdesbois.com | admin123 | Admin dashboard |
| Sales rep | commercial1@lesroisdesbois.com | commercial123 | Commercial space |
| Cashier | cashier1@lesroisdesbois.com | cashier123 | Point of sale |
| Wholesale customer (gros) | client1@lesroisdesbois.com | client123 | Store, wholesale prices |
| Retail customer (détail) | create one with "إنشاء حساب" in the store | your choice | Store, retail prices |

Stop: `docker compose -f docker-compose.local.yml down` (add `-v` to erase the test data).
