# QR Code Auto-Login Implementation

## 📋 Overview

This implementation allows users to login automatically by scanning a QR code that contains encoded credentials in the URL.

## 🚀 Setup Steps

### Step 1: Create QR User in Database

Run the script to create the QR code user with hashed password:

```bash
cd backend
npm run create-qr-user
```

This will:
- Create a user with email: `QR_code@lesroisdubois.com`
- Hash the password: `QrP@ssw0rd!2025`
- Set role to `client`
- Display the QR login URL

### Step 2: Generate QR Code

Use the following URL in any QR code generator:

```
https://lesroisdubois.com/login?u=QR_code@lesroisdubois.com&p=QrP@ssw0rd!2025
```

**Popular QR Code Generators:**
- https://www.qr-code-generator.com/
- https://www.qrcode-monkey.com/
- https://www.the-qrcode-generator.com/

### Step 3: Test the Implementation

1. Scan the QR code with your phone
2. It will open the login page
3. The form will auto-fill with credentials
4. The form will auto-submit after 300ms
5. User will be redirected to `/dashboard` (or appropriate page based on role)

## 🔧 How It Works

### Backend

1. **User Creation Script** (`backend/scripts/createQRUser.js`):
   - Creates user with email `QR_code@lesroisdubois.com`
   - Password is automatically hashed by the User model's pre-save hook
   - Role is set to `client`

2. **Authentication** (`backend/controllers/auth.controller.js`):
   - Normal login endpoint processes the credentials
   - Password is verified using bcrypt comparison
   - JWT token is generated on success
   - Works with any user role including `client`

### Frontend

1. **Login Page** (`frontend/src/pages/Login.jsx`):
   - Reads `u` (username/email) and `p` (password) from URL query parameters
   - Auto-fills the email and password fields
   - Auto-submits the form if both parameters exist
   - Prevents multiple auto-submits using `useRef`
   - Clears URL parameters after successful login

2. **Auto-Submit Logic**:
   - Only triggers if both `u` and `p` parameters exist
   - 300ms delay ensures state is updated before submission
   - Handles errors gracefully (resets auto-submit flag on failure)

## 📱 QR Login URL Format

```
https://lesroisdubois.com/login?u=EMAIL&p=PASSWORD
```

**Example:**
```
https://lesroisdubois.com/login?u=QR_code@lesroisdubois.com&p=QrP@ssw0rd!2025
```

## 🔒 Security Notes

- **HTTPS Required**: Always use HTTPS in production
- **Password Hashing**: Passwords are hashed using bcrypt (10 salt rounds)
- **URL Encoding**: Email and password are URL-encoded in the QR code
- **Auto-Submit Only**: Auto-submit only works if URL parameters exist
- **JWT Tokens**: Standard JWT authentication after login

## 🧪 Testing

### Manual Test

1. Open browser console
2. Navigate to: `https://lesroisdubois.com/login?u=QR_code@lesroisdubois.com&p=QrP@ssw0rd!2025`
3. Watch console logs:
   - `📱 [QR CODE] Detected QR code login parameters`
   - `📱 [QR CODE] Auto-submitting login form...`
   - `✅ [QR CODE] Auto-login successful` (on success)

### QR Code Test

1. Generate QR code with the URL above
2. Scan with phone camera
3. Should auto-login and redirect

## 📝 Files Modified/Created

### Created Files:
- `backend/scripts/createQRUser.js` - Script to create QR user
- `QR_LOGIN_IMPLEMENTATION.md` - This documentation

### Modified Files:
- `frontend/src/pages/Login.jsx` - Added QR code auto-fill and auto-submit
- `backend/package.json` - Added `create-qr-user` script

## 🎯 Expected Behavior

1. **QR Code Scan** → Opens login page
2. **Auto-Fill** → Form fields populate automatically
3. **Auto-Submit** → Form submits automatically (300ms delay)
4. **Authentication** → Backend verifies credentials
5. **JWT Generation** → Token created and stored
6. **Redirect** → User redirected to appropriate dashboard based on role

## 🔄 Updating QR User Password

To update the QR user password, simply run the script again:

```bash
npm run create-qr-user
```

The script will detect the existing user and update the password.

## ⚠️ Important Notes

- The QR code contains credentials in plain text (URL encoded)
- Keep QR codes secure and limit access
- Consider using temporary tokens for enhanced security in the future
- The implementation is simple and straightforward as requested




