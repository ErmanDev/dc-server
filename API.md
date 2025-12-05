# DC Cakes API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_access_token>
```

## Endpoints

### Health & Status

#### GET /health
Health check endpoint (no auth required)

**Response:**
```json
{
  "status": "ok",
  "message": "DC Cakes Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/test-supabase
Test Supabase connection (no auth required)

**Response:**
```json
{
  "success": true,
  "message": "Successfully connected to Supabase",
  "supabaseUrl": "https://your-project.supabase.co...",
  "hasAdminKey": true
}
```

#### GET /api/supabase/status
Get Supabase configuration status (no auth required)

**Response:**
```json
{
  "configured": true,
  "connection": true,
  "message": "Successfully connected to Supabase",
  "environment": {
    "hasUrl": true,
    "hasAnonKey": true,
    "hasServiceKey": true,
    "url": "https://your-project.supabase.co..."
  }
}
```

---

### Authentication

#### POST /api/auth/register
Register a new viewer account (public endpoint)

**Security Note:** Passwords are automatically hashed by Supabase Auth using bcrypt. Passwords are never stored in plain text. This endpoint only allows viewer registration. Admin accounts must be created by existing admins.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "username": "johndoe"
}
```

**Response:**
```json
{
  "message": "Viewer registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "viewer"
  }
}
```

#### POST /api/auth/register-admin
Register a new admin account (public endpoint)

**Security Warning:** This endpoint is public. Consider adding additional security measures in production (e.g., invitation codes, admin approval workflow, etc.). Passwords are automatically hashed by Supabase Auth using bcrypt. Passwords are never stored in plain text.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword123",
  "username": "adminuser"
}
```

**Response:**
```json
{
  "message": "Admin registered successfully",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "adminuser",
    "role": "admin"
  }
}
```

**Error Responses:**
- `400` - Username already taken, password too short, or missing required fields
- `500` - Server error or admin client not configured
```

#### POST /api/auth/login
Login user and get JWT token

**Security Note:** Supabase compares the provided password with the hashed password stored in the database. The password is never transmitted or stored in plain text.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "viewer"
  },
  "session": {
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_at": 1234567890
  }
}
```

#### GET /api/auth/me
Get current user profile (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "role": "viewer",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/auth/profile
Update current user profile (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "username": "newusername"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "uuid",
    "username": "newusername",
    "role": "viewer",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/auth/logout
Logout user (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### POST /api/auth/create-viewer
Create a new viewer account (public endpoint)

**Security Note:** This endpoint is public. Passwords are automatically hashed by Supabase Auth using bcrypt. Passwords are never stored in plain text.

**Request Body:**
```json
{
  "username": "newviewer",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Viewer created successfully",
  "user": {
    "id": "uuid",
    "email": "newviewer@dccakes.local",
    "username": "newviewer",
    "role": "viewer"
  }
}
```

**Error Responses:**
- `400` - Username already taken, password too short, or missing required fields
- `500` - Server error or admin client not configured

---

### Orders

#### GET /api/orders
Get all orders (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` (optional) - Filter by status: `incoming`, `pending`, `accepted`, `declined`, `completed`
- `limit` (optional) - Number of results (default: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Example:**
```
GET /api/orders?status=pending&limit=10&offset=0
```

**Response:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "customer_name": "John Doe",
      "order_details": "Chocolate Cake - 1kg",
      "location": "123 Main St",
      "phone_number": "+1234567890",
      "pickup_date": "2024-12-25",
      "meta_business_link": "https://business.facebook.com/...",
      "status": "pending",
      "created_at": "2024-01-01T00:00:00.000Z",
      "completed_at": null,
      "created_by": "uuid",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### GET /api/orders/:id
Get order by ID (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "order": {
    "id": "uuid",
    "customer_name": "John Doe",
    "order_details": "Chocolate Cake - 1kg",
    "location": "123 Main St",
    "phone_number": "+1234567890",
    "pickup_date": "2024-12-25",
    "meta_business_link": "https://business.facebook.com/...",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00.000Z",
    "completed_at": null,
    "created_by": "uuid",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/orders
Create a new order (requires admin authentication)

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "customer_name": "John Doe",
  "order_details": "Chocolate Cake - 1kg, Vanilla Cupcakes - 12pcs",
  "location": "123 Main St, City",
  "phone_number": "+1234567890",
  "pickup_date": "2024-12-25",
  "meta_business_link": "https://business.facebook.com/messages/t/123456789",
  "status": "incoming"  // optional, defaults to "incoming"
}
```

**Response:**
```json
{
  "message": "Order created successfully",
  "order": {
    "id": "uuid",
    "customer_name": "John Doe",
    "order_details": "Chocolate Cake - 1kg, Vanilla Cupcakes - 12pcs",
    "location": "123 Main St, City",
    "phone_number": "+1234567890",
    "pickup_date": "2024-12-25",
    "meta_business_link": "https://business.facebook.com/messages/t/123456789",
    "status": "incoming",
    "created_at": "2024-01-01T00:00:00.000Z",
    "completed_at": null,
    "created_by": "uuid",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/orders/:id
Update an order (requires admin authentication)

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "customer_name": "Jane Doe",  // optional
  "order_details": "Updated order details",  // optional
  "location": "456 New St",  // optional
  "phone_number": "+0987654321",  // optional
  "pickup_date": "2024-12-26",  // optional
  "meta_business_link": "https://...",  // optional
  "status": "accepted"  // optional
}
```

**Response:**
```json
{
  "message": "Order updated successfully",
  "order": {
    // updated order object
  }
}
```

#### DELETE /api/orders/:id
Delete an order (requires admin authentication)

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response:**
```json
{
  "message": "Order deleted successfully"
}
```

#### GET /api/orders/stats/summary
Get order statistics (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "stats": {
    "total": 50,
    "incoming": 10,
    "pending": 15,
    "accepted": 10,
    "declined": 5,
    "completed": 10
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error, missing fields)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Example Usage

### 1. Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword",
    "username": "admin",
    "role": "admin"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword"
  }'
```

### 3. Get all orders (with authentication)
```bash
curl -X GET http://localhost:3000/api/orders \
  -H "Authorization: Bearer <your_access_token>"
```

### 4. Create an order (admin only)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "order_details": "Chocolate Cake - 1kg",
    "location": "123 Main St",
    "phone_number": "+1234567890",
    "pickup_date": "2024-12-25",
    "status": "pending"
  }'
```

