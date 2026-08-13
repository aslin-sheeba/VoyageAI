# VoyageAI API Documentation

All routes are protected by Firebase ID Token Authentication unless specified. Requests must include the following header:
`Authorization: Bearer <Firebase_ID_Token>`

---

## 1. User Management

### Sync User Profile
- **Method**: `POST`
- **URL**: `/api/users/sync`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "photoURL": "https://lh3.googleusercontent.com/..."
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "User synchronized successfully",
    "user": {
      "_id": "64b0f...",
      "uid": "firebase-uid-here",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "photoURL": "https://...",
      "createdAt": "2026-08-12T10:45:00Z",
      "updatedAt": "2026-08-12T10:50:00Z"
    }
  }
  ```

### Get User Profile
- **Method**: `GET`
- **URL**: `/api/users/profile`
- **Authentication**: Required
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "user": {
      "uid": "firebase-uid-here",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "photoURL": "https://..."
    }
  }
  ```

---

## 2. Trip Management

### Generate Intelligent Trip
- **Method**: `POST`
- **URL**: `/api/trips/generate`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "city": "Goa",
    "budget": 30000,
    "travelers": 2,
    "startDate": "2026-12-20",
    "endDate": "2026-12-25",
    "interests": "beaches, seafood, history",
    "preferences": "relaxation"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "savedTripId": "64b0f...",
    "trip": { ... }
  }
  ```

### Get User's Trips
- **Method**: `GET`
- **URL**: `/api/trips`
- **Authentication**: Required
- **Response** (200 OK):
  ```json
  [
    {
      "_id": "64b0f...",
      "userId": "firebase-uid-here",
      "tripName": "Goa Getaway",
      "city": "Goa",
      "days": 6,
      "budget": 30000,
      "members": 2,
      "locations": [ ... ],
      "itinerary": [ ... ],
      "budgetBreakdown": { ... }
    }
  ]
  ```

### Update Trip Parameters
- **Method**: `PUT`
- **URL**: `/api/trips/:id`
- **Authentication**: Required (Ownership verified)
- **Request Body**:
  ```json
  {
    "tripName": "Updated Goa Trip",
    "budget": 35000,
    "members": 3
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Trip updated successfully",
    "trip": { ... }
  }
  ```

### Delete Specific Trip
- **Method**: `DELETE`
- **URL**: `/api/trips/:id`
- **Authentication**: Required (Ownership verified)
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Trip deleted successfully"
  }
  ```

### Clear All User's Trips
- **Method**: `DELETE`
- **URL**: `/api/trips/clear`
- **Authentication**: Required
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "💥 All your trips have been deleted!"
  }
  ```

---

## 3. Place Discovery & Management

### Discover Real Places via Geoapify
- **Method**: `GET`
- **URL**: `/api/places/discover`
- **Authentication**: Required (Ownership verified for trip context)
- **Query Parameters**:
  - `tripId`: MongoDB Trip ID (required)
  - `category`: `attractions` | `beaches` | `restaurants` | `hotels` | `shopping` | `museums` | `parks` | `hospitals` | `police`
  - `query`: Keyword filter (optional)
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "results": [
      {
        "name": "Baga Beach",
        "address": "Baga, Goa, India",
        "category": "beaches",
        "lat": 15.5562,
        "lng": 73.7517,
        "cost": 0
      }
    ]
  }
  ```

### Add Place to Trip
- **Method**: `POST`
- **URL**: `/api/places/add`
- **Authentication**: Required (Ownership verified)
- **Request Body**:
  ```json
  {
    "tripId": "64b0f...",
    "type": "sight",
    "name": "Baga Beach",
    "lat": 15.5562,
    "lng": 73.7517,
    "cost": 0,
    "day": 1
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "trip": { ... }
  }
  ```

---

## 4. Expense Tracking

### Log New Expense
- **Method**: `POST`
- **URL**: `/api/expenses`
- **Authentication**: Required (Ownership verified)
- **Request Body**:
  ```json
  {
    "tripId": "64b0f...",
    "category": "food",
    "description": "Lunch at Britto's",
    "amount": 1500,
    "date": "2026-12-21T12:00:00.000Z",
    "notes": "Spicy crab was good"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "expense": { ... }
  }
  ```

### Get Trip Expenses
- **Method**: `GET`
- **URL**: `/api/expenses/trip/:tripId`
- **Authentication**: Required (Ownership verified)
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "expenses": [ ... ]
  }
  ```

### Update Logged Expense
- **Method**: `PUT`
- **URL**: `/api/expenses/:id`
- **Authentication**: Required (Ownership verified)
- **Request Body**:
  ```json
  {
    "amount": 1800,
    "notes": "Updated total"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "expense": { ... }
  }
  ```

### Delete Logged Expense
- **Method**: `DELETE`
- **URL**: `/api/expenses/:id`
- **Authentication**: Required (Ownership verified)
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Expense deleted successfully"
  }
  ```

---

## 5. AI Travel Assistant Chat & Action Routing

### Send Chat Message
- **Method**: `POST`
- **URL**: `/api/ai/chat`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "message": "Add a restaurant near Baga Beach",
    "tripId": "64b0f..."
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "reply": "Added Britto's to Day 1. It is a seafood spot.",
    "action": "ADD_PLACE",
    "payload": {
      "type": "food",
      "query": "Britto's Baga Beach",
      "day": 1
    },
    "updatedTrip": { ... }
  }
  ```

---

## 6. Safety & SOS Services

### Get Nearby Emergency Services
- **Method**: `GET`
- **URL**: `/api/guardian/nearby`
- **Authentication**: Required
- **Query Parameters**:
  - `lat`: User latitude coordinates (required)
  - `lng`: User longitude coordinates (required)
  - `type`: `hospital` | `police` | `fire` (default: hospital)
- **Response** (200 OK):
  ```json
  {
    "ok": true,
    "type": "hospital",
    "results": [
      {
        "name": "Manipal Hospital Goa",
        "lat": 15.4593,
        "lng": 73.8049,
        "address": "Dona Paula, Panaji, Goa",
        "categories": [ "healthcare.hospital" ]
      }
    ]
  }
  ```
