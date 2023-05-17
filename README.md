# Fictional-Online-Store

This project is an API that provides endpoints for managing user's login and registration, adding, deleting, reading and creating products, adding and removing products from cart and placing orders.

## Prerequisites

Before running the API, ensure that you have the following software installed on your machine.

-Node.js (v14 or higher)
-MongoDB (Community Edition or MongoDB Atlas account)

## Getting Started

Steps to set up and run the API on local machine.

### 1. Clone the Repository

Clone this repository to your local machine using the following command:

git clone `https://github.com/TheStArShAdE/Fictional-Online-Store.git`

### 2. Install Dependencies

Navigate to the project directory and install the dependencies by running the following commands:

cd Fictional-Online-Store
npm install

### 3. Configure Environment Variables

Create a `.env` file in the project root directory and configure the following environment variables:

PORT = 3000
MONGODB_URI = your-connection-string
DB_NAME = your-database-name
JWT_SECRET = your-secret-key
JWT_EXPIRES_IN = 30

Replace the strings with the required tuples.
secret-key can be any string of 32 or more characters.

### 4. Start MongoDB

Ensure that MongoDB is running on local machine or provide the appropriate MongoDB connection URI in the `.env` file.

### 5. Run the API

Start the API server by running the following command:

npm start

The API will start running on `http://localhost:3000`.

### 6. Testing the API

You can use tools like Postman or cURL to test the API endpoints. Here are all of API endpoints:

- `POST /api/users/register` - Register a user with username and password provided through request body.

- `POST /api/users/login` - User login with username and password provided in request body after comparing it with the stored username and password.

- `POST /api/cart` - Adding products to the shopping cart by providing product ID and quantity in request body and an 'Authorization' with Bearer as a prefix and token as a value. The token is provided when a user successfully logs in the system. The authorization is provided as request header.

- `POST /api/orders` - Placing the orders for the products that are in the shopping cart. After placing order, the shopping cart is emptied. This endpoint only requires authorization in the request header.

- `GET /api/products/search` - Searching products by name, description, or category. This endpoint requires a search query provided in the params query.

- `POST /api/products` - Create a new product. This endpoint takes name, description, category, and price from request body.

- `GET /api/products` - Retrieve all products. This endpoint also has the page and limit options that allow user to fetch data according to pages and data per page.

- `PUT /api/products/:id` - Update a producy by ID. This endpoint requires name, description, category, or price that has to be updated through request body and product ID through param query.

- `DELETE /api/products/:id` - Delete a product by ID. ID is provided in the param query.

- `GET /api/orders` - Retrieve all orders. This endpoint has options for page and limit which are initially set to 1 and 10 respectively. page and limit are provided as param query.

- `DELETE /api/cart/:id` - Delete a product from shopping cart by ID. This endpoint requires authorization through request header and product id through request params. 